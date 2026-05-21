import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, requireChatAccess, AuthRequest } from '../middleware/auth';
import { chatQueries } from '../db/database';

const router = Router();

router.get('/messages', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const rows = await chatQueries.getRecent();
  const messages = rows.reverse().map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    userName: r.user_name,
    message: r.message,
    createdAt: r.created_at instanceof Date
      ? r.created_at.toISOString()
      : (String(r.created_at).endsWith('Z') ? r.created_at : String(r.created_at).replace(' ', 'T') + 'Z'),
  }));
  res.json({ messages });
});

router.post(
  '/message',
  authMiddleware,
  [body('message').trim().notEmpty().isLength({ max: 1000 })],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const user = req.user!;
    const id = uuidv4();
    await chatQueries.create({ id, user_id: user.id, user_name: user.name, message: req.body.message });
    const msg = { id, userId: user.id, userName: user.name, message: req.body.message, createdAt: new Date().toISOString() };
    res.status(201).json({ message: msg });
  }
);

export default router;
