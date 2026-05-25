import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { userQueries, accessRequestQueries, loginOtpQueries } from '../db/database';
import { signToken, authMiddleware, AuthRequest, recordLoginFailure, checkLoginLocked, clearLoginFailures } from '../middleware/auth';
import { sendAccessRequestToAdmin, sendLoginOTP, sendLoginAlert } from '../services/emailService';
import { generateSecureToken, generateNumericCode } from '../utils/encryption';

const router = Router();

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').trim().notEmpty().isLength({ max: 100 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const { email, password, name } = req.body;

    const existing = await userQueries.findByEmail(email);
    if (existing) {
      res.status(409).json({ error: 'Bu email artıq qeydiyyatdan keçib' });
      return;
    }

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
    } catch (e) {
      console.error('[Email] Failed to send access request:', e);
    }

    res.status(201).json({ message: 'Qeydiyyat tamamlandı. Admin təsdiqini gözləyin.' });
  }
);

// --- Addım 1: Email + şifrə yoxla → OTP göndər ---
router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    // IP-based brute-force yoxlaması
    const ip = (req.ip || req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, '');
    const lockCheck = checkLoginLocked(ip);
    if (lockCheck.locked) {
      const secs = Math.ceil(lockCheck.retryAfterMs / 1000);
      res.status(429).json({ error: `Çox sayda uğursuz cəhd. ${secs} saniyə sonra yenidən cəhd edin.` });
      return;
    }

    const { email, password } = req.body;
    const user = await userQueries.findByEmail(email);

    // Timing attack-dan qorumaq üçün user yoxdursa da hash müqayisə et
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

    if (user.status === 'pending') {
      res.status(403).json({ error: 'Hesabınız hələ təsdiqlənməyib. Admin qərarını gözləyin.' });
      return;
    }
    if (user.status === 'denied') {
      res.status(403).json({ error: 'Hesabınıza giriş rədd edilib.' });
      return;
    }

    // Əvvəlki istifadə edilməmiş OTP-ləri ləğv et (köhnə sessiyalar)
    try { await loginOtpQueries.cleanExpired(); } catch { /* ignore */ }

    // 6 rəqəmli OTP + session token yarat
    const otpCode = generateNumericCode(6);
    const sessionToken = generateSecureToken(32);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 dəq

    await loginOtpQueries.create({
      id: uuidv4(),
      user_id: user.id,
      otp_code: otpCode,
      session_token: sessionToken,
      ip,
      expires_at: expiresAt,
    });

    // OTP emailini göndər
    const timeStr = new Date().toLocaleString('az-AZ', { timeZone: 'Asia/Baku', hour12: false });
    try {
      await sendLoginOTP({ userEmail: user.email, userName: user.name, code: otpCode, ip, time: timeStr });
    } catch (e) {
      console.error('[Email] OTP göndərilmədi:', e);
      // OTP email uğursuz olsa belə session token qaytarırıq (test mühitlərində)
    }

    res.json({
      requiresOtp: true,
      sessionToken,
      email: user.email, // frontend-də "...@gmail.com-a kod göndərildi" mesajı üçün
    });
  }
);

// --- Addım 2: OTP kodu yoxla → JWT qaytır ---
router.post(
  '/verify-otp',
  [
    body('sessionToken').notEmpty().isLength({ min: 10, max: 200 }),
    body('code').notEmpty().isLength({ min: 6, max: 6 }).matches(/^\d{6}$/),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Yanlış sorğu formatı.' });
      return;
    }

    const { sessionToken, code } = req.body;
    const record = await loginOtpQueries.findBySession(sessionToken);

    if (!record) {
      res.status(400).json({ error: 'Sessiya tapılmadı. Yenidən daxil olmağa cəhd edin.' });
      return;
    }
    if (record.used) {
      res.status(400).json({ error: 'Bu kod artıq istifadə edilib.' });
      return;
    }
    if (new Date(record.expires_at) < new Date()) {
      res.status(400).json({ error: 'Kodun müddəti bitib. Yenidən daxil olmağa cəhd edin.' });
      return;
    }
    if (record.otp_code !== code) {
      res.status(400).json({ error: 'Kod yanlışdır. Emailinizi yoxlayın.' });
      return;
    }

    // OTP-ni istifadə edilmiş kimi işarələ
    await loginOtpQueries.markUsed(record.id);

    const user = await userQueries.findById(record.user_id);
    if (!user || user.status !== 'approved') {
      res.status(401).json({ error: 'Hesab tapılmadı və ya təsdiqlənməyib.' });
      return;
    }

    // Uğurlu giriş: brute-force sayacını sıfırla
    const ip = record.ip || (req.ip || '').replace(/^::ffff:/, '');
    clearLoginFailures(ip);

    // Adminə giriş bildirişi göndər
    const timeStr = new Date().toLocaleString('az-AZ', { timeZone: 'Asia/Baku', hour12: false });
    sendLoginAlert({ userEmail: user.email, userName: user.name, ip, time: timeStr }).catch(e => {
      console.error('[Email] Login alert göndərilmədi:', e);
    });

    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        chatAccess: user.chat_access,
      },
    });
  }
);

router.get('/me', authMiddleware, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

router.post('/chat-access-request', authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (user.chatAccess === 'approved') {
    res.json({ message: 'Chat erişiminiz var.' });
    return;
  }
  if (user.chatAccess === 'pending') {
    res.json({ message: 'Chat sorğunuz gözləmədədir.' });
    return;
  }

  const approveToken = generateSecureToken();
  const denyToken = generateSecureToken();

  await accessRequestQueries.create({ id: uuidv4(), user_id: user.id, user_email: user.email, user_name: user.name, type: 'chat', token: approveToken });
  await accessRequestQueries.create({ id: uuidv4(), user_id: user.id, user_email: user.email, user_name: user.name, type: 'chat', token: denyToken });

  await userQueries.updateChatAccess('pending', user.id);

  try {
    await sendAccessRequestToAdmin({ userId: user.id, userEmail: user.email, userName: user.name, requestId: approveToken, approveToken, denyToken, type: 'chat' });
  } catch (e) {
    console.error('[Email] Chat access request failed:', e);
  }

  res.json({ message: 'Chat erişim sorğusu göndərildi.' });
});

export default router;
