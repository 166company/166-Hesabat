import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { metaTokenQueries, googleAuthQueries, tiktokAuthQueries } from '../db/database';
import { decrypt } from '../utils/encryption';
import { validateToken, getBusinessSuites, getAdAccountsForBusiness, getFullAccountReport } from '../services/metaService';
import { getAccessToken, getCampaignReport } from '../services/googleService';
import { getCampaignReport as getTikTokReport, getAdvertiserInfo } from '../services/tiktokService';

const router = Router();
router.use(authMiddleware);

const ALLOWED_PORTFOLIOS = ['166 global logistics', '166 tech'];
function isAllowedPortfolio(name: string) {
  const l = name.toLowerCase();
  return ALLOWED_PORTFOLIOS.some(a => l.includes(a) || a.includes(l));
}
function norm(s: string) {
  return s.toLowerCase().replace(/ə/g,'e').replace(/ä/g,'e').replace(/ç/g,'c')
    .replace(/ğ/g,'g').replace(/ı/g,'i').replace(/ö/g,'o').replace(/ü/g,'u').replace(/ş/g,'s');
}

router.get('/summary', async (req: AuthRequest, res: Response) => {
  const { startDate, endDate } = req.query as Record<string, string>;
  if (!startDate || !endDate) { res.status(400).json({ error: 'startDate, endDate tələb olunur' }); return; }
  const userId = req.user!.id;

  let google = 0, meta = 0, tiktok = 0;

  // ── GOOGLE ──
  const googleAuth = googleAuthQueries.findByUser.get(userId) as any;
  if (googleAuth?.is_verified && googleAuth?.refresh_token_encrypted) {
    try {
      const accessToken = await getAccessToken(googleAuth.refresh_token_encrypted);
      const customers: { id: string; name: string; managerId?: string }[] = JSON.parse(googleAuth.customer_ids || '[]');
      await Promise.all(customers.map(async (c) => {
        try {
          const cNorm = norm(c.name || '');
          if (cNorm.includes('logistika') || (cNorm.includes('global') && !cNorm.includes('tech'))) return;
          const camps = await getCampaignReport(c.id, accessToken, startDate, endDate, c.managerId);
          google += camps.reduce((s, camp) => s + camp.costMicros / 1_000_000, 0);
        } catch {}
      }));
    } catch {}
  }

  // ── META ──
  const metaTokens = metaTokenQueries.findByUser.all(userId) as any[];
  for (const tk of metaTokens) {
    try {
      const accessToken = decrypt(tk.access_token_encrypted);
      const valid = await validateToken(accessToken);
      if (!valid.valid) continue;
      const allSuites = await getBusinessSuites(accessToken);
      const allowedSuites = allSuites.filter(s => isAllowedPortfolio(s.name));
      await Promise.all(allowedSuites.map(async (suite) => {
        const accs = await getAdAccountsForBusiness(suite.id, accessToken);
        await Promise.all(accs.map(async (acc) => {
          const accNorm = norm(acc.name || '');
          if (accNorm.includes('logistika') || (accNorm.includes('global') && !accNorm.includes('tech'))) return;
          const report = await getFullAccountReport(acc.id, acc, accessToken, startDate, endDate);
          meta += report.campaigns.reduce((s, c) => s + parseFloat((c as any).insights?.spend || '0'), 0);
        }));
      }));
    } catch {}
  }

  // ── TIKTOK ──
  const tiktokAuth = tiktokAuthQueries.findByUser.get(userId) as any;
  if (tiktokAuth?.access_token_encrypted) {
    try {
      const tiktokToken = decrypt(tiktokAuth.access_token_encrypted);
      const advertiserIds: string[] = JSON.parse(tiktokAuth.advertiser_ids || '[]');
      await Promise.all(advertiserIds.map(async (advId) => {
        try {
          const info = await getAdvertiserInfo(tiktokToken, advId);
          const camps = await getTikTokReport(tiktokToken, advId, startDate, endDate, info.name);
          tiktok += camps.reduce((s, c) => s + c.spend, 0);
        } catch {}
      }));
    } catch {}
  }

  res.json({
    google: Math.round(google * 100) / 100,
    meta: Math.round(meta * 100) / 100,
    tiktok: Math.round(tiktok * 100) / 100,
    total: Math.round((google + meta + tiktok) * 100) / 100,
  });
});

export default router;
