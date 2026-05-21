import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { tiktokAuthQueries, cacheQueries } from '../db/database';
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
    await tiktokAuthQueries.upsert({
      id: uuidv4(),
      user_id: userId,
      access_token_encrypted: encrypt(accessToken),
      advertiser_ids: JSON.stringify(advertiserIds),
      tiktok_email: '',
    });
    res.redirect(`${CLIENT_URL}/tiktok-ads?connected=1`);
  } catch (e: any) {
    console.error('[TikTok OAuth]', e.message, JSON.stringify(e.response?.data));
    res.redirect(`${CLIENT_URL}/tiktok-ads?error=oauth_failed`);
  }
});

// Status
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  const auth = await tiktokAuthQueries.findByUser(req.user!.id)
    ?? await tiktokAuthQueries.findFirst();
  if (!auth) { res.json({ connected: false }); return; }
  const advertiserIds: string[] = JSON.parse(auth.advertiser_ids || '[]');
  res.json({ connected: true, advertiserIds });
});

// Advertiser məlumatları
router.get('/advertisers', authMiddleware, async (req: AuthRequest, res: Response) => {
  const auth = await tiktokAuthQueries.findByUser(req.user!.id)
    ?? await tiktokAuthQueries.findFirst();
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
  const cacheKey = `tiktok:${advertiserId}:${startDate}:${endDate}`;
  const cached = await cacheQueries.get(cacheKey);
  if (cached) { res.json(cached); return; }

  const auth = await tiktokAuthQueries.findByUser(req.user!.id)
    ?? await tiktokAuthQueries.findFirst();
  if (!auth) { res.status(403).json({ error: 'TikTok qoşulmayıb' }); return; }
  const accessToken = decrypt(auth.access_token_encrypted);
  try {
    const info = await getAdvertiserInfo(accessToken, advertiserId);
    const campaigns = await getCampaignReport(accessToken, advertiserId, startDate, endDate, info.name);
    const result = { advertiserId, campaigns };
    await cacheQueries.set(cacheKey, result, 6);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message, detail: e.response?.data });
  }
});

// Manual advertiser ID əlavə et
router.post('/advertisers/add', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { advertiserId } = req.body;
  if (!advertiserId) { res.status(400).json({ error: 'advertiserId tələb olunur' }); return; }
  const auth = await tiktokAuthQueries.findByUser(req.user!.id);
  if (!auth) { res.status(404).json({ error: 'TikTok qoşulmayıb' }); return; }
  const existing: string[] = JSON.parse(auth.advertiser_ids || '[]');
  if (!existing.includes(advertiserId)) existing.push(advertiserId);
  await tiktokAuthQueries.updateAdvertiserIds(JSON.stringify(existing), req.user!.id);
  res.json({ ok: true, advertiserIds: existing });
});

// Bağlantını kəs
router.delete('/disconnect', authMiddleware, async (req: AuthRequest, res: Response) => {
  await tiktokAuthQueries.delete(req.user!.id);
  res.json({ ok: true });
});

export default router;
