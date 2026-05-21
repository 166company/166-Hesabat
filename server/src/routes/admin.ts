import { Router, Request, Response } from 'express';
import { accessRequestQueries, userQueries } from '../db/database';
import { sendApprovalEmail, sendDenialEmail } from '../services/emailService';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Email link handler - no auth required (admin clicks link from email)
router.get('/resolve', async (req: Request, res: Response) => {
  const { token, action } = req.query as { token: string; action: string };
  if (!token || !['approve', 'deny'].includes(action)) {
    res.status(400).send('<p style="font-family:Verdana">Yanlış parametr.</p>');
    return;
  }

  const request = await accessRequestQueries.findByToken(token);
  if (!request) {
    res.status(404).send('<p style="font-family:Verdana">Sorğu tapılmadı.</p>');
    return;
  }
  if (request.status !== 'pending') {
    res.send(`<p style="font-family:Verdana">Bu sorğu artıq ${request.status === 'approved' ? 'təsdiqlənib' : 'rədd edilib'}.</p>`);
    return;
  }

  const status = action === 'approve' ? 'approved' : 'denied';
  await accessRequestQueries.resolve({ status, token });

  if (request.type === 'account') {
    await userQueries.updateStatus({
      status,
      approved_at: new Date().toISOString(),
      approved_by: 'admin',
      id: request.user_id,
    });
  } else if (request.type === 'chat') {
    await userQueries.updateChatAccess(status, request.user_id);
  }

  try {
    if (status === 'approved') {
      await sendApprovalEmail(request.user_email, request.user_name, request.type);
    } else {
      await sendDenialEmail(request.user_email, request.user_name, request.type);
    }
  } catch (e) {
    console.error('[Email] Notification failed:', e);
  }

  const msg = status === 'approved'
    ? `✅ ${request.user_name} üçün ${request.type === 'account' ? 'hesab' : 'chat'} girişi TƏSDİQLƏNDİ.`
    : `❌ ${request.user_name} üçün ${request.type === 'account' ? 'hesab' : 'chat'} girişi RƏDD EDİLDİ.`;

  res.send(`
    <html>
      <body style="font-family:Verdana;max-width:500px;margin:50px auto;padding:20px;text-align:center;">
        <h2>${msg}</h2>
        <p>Bu pəncərəni bağlaya bilərsiniz.</p>
      </body>
    </html>
  `);
});

// Admin panel - list users (protected)
router.get('/users', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Yalnız adminlər üçün' });
    return;
  }
  const users = await userQueries.getAll();
  res.json({ users });
});

export default router;
