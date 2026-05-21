import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { userQueries, accessRequestQueries } from '../db/database';
import { signToken, authMiddleware, AuthRequest } from '../middleware/auth';
import { sendAccessRequestToAdmin } from '../services/emailService';
import { generateSecureToken } from '../utils/encryption';

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

    // Create access request for admin approval
    const approveToken = generateSecureToken();
    const denyToken = generateSecureToken();
    const requestId = uuidv4();

    // We store two records - one for approve, one for deny
    await accessRequestQueries.create({
      id: requestId,
      user_id: id,
      user_email: email,
      user_name: name,
      type: 'account',
      token: approveToken,
    });
    await accessRequestQueries.create({
      id: uuidv4(),
      user_id: id,
      user_email: email,
      user_name: name,
      type: 'account',
      token: denyToken,
    });

    try {
      await sendAccessRequestToAdmin({
        userId: id,
        userEmail: email,
        userName: name,
        requestId,
        approveToken,
        denyToken,
        type: 'account',
      });
    } catch (e) {
      console.error('[Email] Failed to send access request:', e);
    }

    res.status(201).json({ message: 'Qeydiyyat tamamlandı. Admin təsdiqini gözləyin.' });
  }
);

router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const { email, password } = req.body;
    const user = await userQueries.findByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Email və ya şifrə yanlışdır' });
      return;
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Email və ya şifrə yanlışdır' });
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

  await accessRequestQueries.create({
    id: uuidv4(),
    user_id: user.id,
    user_email: user.email,
    user_name: user.name,
    type: 'chat',
    token: approveToken,
  });
  await accessRequestQueries.create({
    id: uuidv4(),
    user_id: user.id,
    user_email: user.email,
    user_name: user.name,
    type: 'chat',
    token: denyToken,
  });

  await userQueries.updateChatAccess('pending', user.id);

  try {
    await sendAccessRequestToAdmin({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      requestId: approveToken,
      approveToken,
      denyToken,
      type: 'chat',
    });
  } catch (e) {
    console.error('[Email] Chat access request failed:', e);
  }

  res.json({ message: 'Chat erişim sorğusu göndərildi.' });
});

export default router;
