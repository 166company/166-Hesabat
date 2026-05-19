import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { tiktokAuthQueries } from '../db/database';
import { encrypt, decrypt } from '../utils/encryption';
import { getAuthUrl, exchangeCodeForToken, getCampaignReport, getAdvertiserInfo } from '../services/tiktokService';

const router = Router();
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// OAuth başlat
router.get('/auth-url', authMiddleware, (req: AuthRequest, res: Response) => {
  const state = Buffer.from(JSON.stringify({ userId: req.user!.id })).toString('base64');
  res.json({ url: getAuthUrl(state) });
});

// OAuth callback
router.get('/callback', async (req: Request, res: Response) => {
  const { auth_code, state } = req.query as Record<string, string>;
  let userId: string;
  try {
    userId = JSON.parse(Buffer.from(state, 'base64').toString('utf8')).userId;
  } catch {
    res.redirect(`${CLIENT_URL}/tiktok-ads?error=invalid_state`); return;
  }
  try {
    const { accessToken, advertiserIds } = await exchangeCodeForToken(auth_code);
    tiktokAuthQueries.upsert.run({
      id: uuidv4(),
      user_id: userId,
      access_token_encrypted: encrypt(accessToken),
      advertiser_ids: JSON.stringify(advertiserIds),
      tiktok_email: '',
    });
    res.redirect(`${CLIENT_URL}/tiktok-ads?connected=1`);
  } catch (e: any) {
    res.redirect(`${CLIENT_URL}/tiktok-ads?error=oauth_failed`);
  }
});

// Status
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  const auth = tiktokAuthQueries.findByUser.get(req.user!.id) as any;
  if (!auth) { res.json({ connected: false }); return; }
  const advertiserIds: string[] = JSON.parse(auth.advertiser_ids || '[]');
  res.json({ connected: true, advertiserIds });
});

// Advertiser məlumatları
router.get('/advertisers', authMiddleware, async (req: AuthRequest, res: Response) => {
  const auth = tiktokAuthQueries.findByUser.get(req.user!.id) as any;
  if (!auth) { res.status(404).json({ error: 'TikTok qoşulmayıb' }); return; }
  const accessToken = decrypt(auth.access_token_encrypted);
  const advertiserIds: string[] = JSON.parse(auth.advertiser_ids || '[]');
  const advertisers = await Promise.all(advertiserIds.map(id => getAdvertiserInfo(accessToken, id)));
  res.json({ advertisers });
});

// Kampaniya hesabatı
router.post('/report', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { advertiserId, startDate, endDate } = req.body;
  if (!advertiserId || !startDate || !endDate) {
    res.status(400).json({ error: 'advertiserId, startDate, endDate tələb olunur' }); return;
  }
  const auth = tiktokAuthQueries.findByUser.get(req.user!.id) as any;
  if (!auth) { res.status(403).json({ error: 'TikTok qoşulmayıb' }); return; }
  const accessToken = decrypt(auth.access_token_encrypted);
  const info = await getAdvertiserInfo(accessToken, advertiserId);
  const campaigns = await getCampaignReport(accessToken, advertiserId, startDate, endDate, info.name);
  res.json({ advertiserId, campaigns });
});

// Bağlantını kəs
router.delete('/disconnect', authMiddleware, (req: AuthRequest, res: Response) => {
  tiktokAuthQueries.delete.run(req.user!.id);
  res.json({ ok: true });
});

export default router;
