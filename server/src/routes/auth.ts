import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import {
  userQueries, accessRequestQueries, loginApprovalQueries,
} from '../db/database';
import {
  signToken, authMiddleware, AuthRequest,
  recordLoginFailure, checkLoginLocked, clearLoginFailures,
} from '../middleware/auth';
import {
  sendAccessRequestToAdmin, sendLoginApprovalRequest,
} from '../services/emailService';
import { generateSecureToken } from '../utils/encryption';

const router = Router();
const SERVER_URL = process.env.SERVER_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`;

// ─── Qeydiyyat ───────────────────────────────────────────────────────────────
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').trim().notEmpty().isLength({ max: 100 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const { email, password, name } = req.body;
    const existing = await userQueries.findByEmail(email);
    if (existing) { res.status(409).json({ error: 'Bu email artıq qeydiyyatdan keçib' }); return; }

    const id = uuidv4();
    const hash = await bcrypt.hash(password, 12);
    await userQueries.create({ id, email, password_hash: hash, name, role: 'user', status: 'pending', chat_access: 'none' });

    const approveToken = generateSecureToken();
    const denyToken = generateSecureToken();
    const requestId = uuidv4();
    await accessRequestQueries.create({ id: requestId, user_id: id, user_email: email, user_name: name, type: 'account', token: approveToken });
    await accessRequestQueries.create({ id: uuidv4(), user_id: id, user_email: email, user_name: name, type: 'account', token: denyToken });

    try {
      await sendAccessRequestToAdmin({ userId: id, userEmail: email, userName: name, requestId, approveToken, denyToken, type: 'account' });
    } catch (e) { console.error('[Email] register request:', e); }

    res.status(201).json({ message: 'Qeydiyyat tamamlandı. Admin təsdiqini gözləyin.' });
  }
);

// ─── Giriş: email + şifrə → adminə təsdiq sorğusu ───────────────────────────
router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const ip = (req.ip || req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, '');
    const lockCheck = checkLoginLocked(ip);
    if (lockCheck.locked) {
      const secs = Math.ceil(lockCheck.retryAfterMs / 1000);
      res.status(429).json({ error: `Çox sayda uğursuz cəhd. ${secs} saniyə sonra yenidən cəhd edin.` });
      return;
    }

    const { email, password } = req.body;
    const user = await userQueries.findByEmail(email);

    const dummyHash = '$2a$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const valid = await bcrypt.compare(password, user?.password_hash || dummyHash);

    if (!user || !valid) {
      const result = recordLoginFailure(ip);
      const msg = result.locked
        ? 'Çox sayda uğursuz cəhd. 15 dəqiqə sonra yenidən cəhd edin.'
        : `Email və ya şifrə yanlışdır. ${result.remaining} cəhd qalıb.`;
      res.status(401).json({ error: msg });
      return;
    }
    if (user.status === 'pending') { res.status(403).json({ error: 'Hesabınız hələ təsdiqlənməyib.' }); return; }
    if (user.status === 'denied')  { res.status(403).json({ error: 'Hesabınıza giriş rədd edilib.' }); return; }

    try { await loginApprovalQueries.cleanExpired(); } catch { /* ignore */ }

    const approvalSessionToken = generateSecureToken(32);
    const approveToken = generateSecureToken(32);
    const denyToken = generateSecureToken(32);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await loginApprovalQueries.create({
      id: uuidv4(),
      user_id: user.id,
      session_token: approvalSessionToken,
      approve_token: approveToken,
      deny_token: denyToken,
      ip,
      expires_at: expiresAt,
    });

    const timeStr = new Date().toLocaleString('az-AZ', { timeZone: 'Asia/Baku', hour12: false });
    const approveUrl = `${SERVER_URL}/api/auth/resolve-login?token=${approveToken}&action=approve`;
    const denyUrl    = `${SERVER_URL}/api/auth/resolve-login?token=${denyToken}&action=deny`;

    try {
      await sendLoginApprovalRequest({ userName: user.name, userEmail: user.email, ip, time: timeStr, approveUrl, denyUrl });
    } catch (e) {
      console.error('[Email] Approval email göndərilmədi:', e);
      res.status(503).json({ error: 'Təsdiq emaili göndərilmədi. SMTP konfiqurasiyasını yoxlayın.' });
      return;
    }

    res.json({ requiresApproval: true, approvalSessionToken });
  }
);

// ─── Admin Təsdiqlə / Rədd et (email linki) ──────────────────────────────────
router.get('/resolve-login', async (req: Request, res: Response) => {
  const { token, action } = req.query as { token: string; action: string };
  if (!token || !['approve', 'deny'].includes(action)) {
    res.status(400).send('<p style="font-family:Verdana">Yanlış parametr.</p>');
    return;
  }

  const record = await loginApprovalQueries.findByApproveToken(token);
  if (!record) {
    res.status(404).send('<p style="font-family:Verdana">Sorğu tapılmadı və ya müddəti bitib.</p>');
    return;
  }
  if (record.status !== 'pending') {
    const msg = record.status === 'approved' ? 'artıq TƏSDİQLƏNİB' : 'artıq RƏDD EDİLİB';
    res.send(`<html><body style="font-family:Verdana;max-width:500px;margin:50px auto;text-align:center;"><h2>Bu sorğu ${msg}.</h2></body></html>`);
    return;
  }
  if (new Date(record.expires_at) < new Date()) {
    res.send('<html><body style="font-family:Verdana;max-width:500px;margin:50px auto;text-align:center;"><h2>⏰ Sorğunun müddəti bitib.</h2></body></html>');
    return;
  }

  const status = action === 'approve' ? 'approved' : 'denied';
  await loginApprovalQueries.resolve(record.id, status);

  const emoji = status === 'approved' ? '✅' : '❌';
  const msg = status === 'approved' ? 'Giriş TƏSDİQLƏNDİ.' : 'Giriş RƏDD EDİLDİ.';
  res.send(`<html><body style="font-family:Verdana;max-width:500px;margin:50px auto;padding:20px;text-align:center;"><h2>${emoji} ${msg}</h2><p style="color:#888;">Bu pəncərəni bağlaya bilərsiniz.</p></body></html>`);
});

// ─── Frontend polling — təsdiq statusunu yoxla ────────────────────────────────
router.get('/approval-status', async (req: Request, res: Response) => {
  const { token } = req.query as { token: string };
  if (!token) { res.status(400).json({ error: 'Token tələb olunur.' }); return; }

  const record = await loginApprovalQueries.findBySession(token);
  if (!record) { res.status(404).json({ status: 'not_found' }); return; }

  if (record.status === 'pending' && new Date(record.expires_at) < new Date()) {
    res.json({ status: 'expired' }); return;
  }
  if (record.status === 'pending') { res.json({ status: 'pending' }); return; }
  if (record.status === 'denied')  { res.json({ status: 'denied' });  return; }

  if (record.status === 'approved') {
    const user = await userQueries.findById(record.user_id);
    if (!user || user.status !== 'approved') {
      res.status(401).json({ status: 'denied', error: 'Hesab tapılmadı.' }); return;
    }
    const ip = record.ip || '';
    if (ip) clearLoginFailures(ip);
    const jwtToken = signToken({ id: user.id, email: user.email, role: user.role });
    res.json({
      status: 'approved',
      token: jwtToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status, chatAccess: user.chat_access },
    });
  }
});

// ─── /me ─────────────────────────────────────────────────────────────────────
router.get('/me', authMiddleware, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

// ─── Chat erişim sorğusu ──────────────────────────────────────────────────────
router.post('/chat-access-request', authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (user.chatAccess === 'approved') { res.json({ message: 'Chat erişiminiz var.' }); return; }
  if (user.chatAccess === 'pending')  { res.json({ message: 'Chat sorğunuz gözləmədədir.' }); return; }

  const approveToken = generateSecureToken();
  const denyToken = generateSecureToken();
  await accessRequestQueries.create({ id: uuidv4(), user_id: user.id, user_email: user.email, user_name: user.name, type: 'chat', token: approveToken });
  await accessRequestQueries.create({ id: uuidv4(), user_id: user.id, user_email: user.email, user_name: user.name, type: 'chat', token: denyToken });
  await userQueries.updateChatAccess('pending', user.id);

  try {
    await sendAccessRequestToAdmin({ userId: user.id, userEmail: user.email, userName: user.name, requestId: approveToken, approveToken, denyToken, type: 'chat' });
  } catch (e) { console.error('[Email] Chat access request failed:', e); }

  res.json({ message: 'Chat erişim sorğusu göndərildi.' });
});

export default router;
