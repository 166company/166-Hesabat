import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { googleAuthQueries } from '../db/database';
import { encrypt, decrypt, generateNumericCode } from '../utils/encryption';
import {
  getAuthUrl,
  exchangeCodeForTokens,
  getAccessToken,
  getAccessibleCustomers,
  getCampaignReport,
  getAccountTopKeywords,
  microsToCurrency,
} from '../services/googleService';
import { sendGoogleVerificationCode } from '../services/emailService';

const router = Router();

// OAuth initiation (requires auth)
router.get('/auth-url', authMiddleware, (req: AuthRequest, res: Response) => {
  const state = Buffer.from(JSON.stringify({ userId: req.user!.id })).toString('base64');
  const url = getAuthUrl(state);
  res.json({ url });
});

// OAuth callback (no auth - comes from Google)
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;
  const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

  if (error) {
    res.redirect(`${CLIENT_URL}/google-ads?error=oauth_denied`);
    return;
  }

  let userId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    userId = decoded.userId;
  } catch {
    res.redirect(`${CLIENT_URL}/google-ads?error=invalid_state`);
    return;
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const customers = await getAccessibleCustomers(tokens.accessToken);

    const code6 = generateNumericCode(6);
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await googleAuthQueries.upsert({
      id: uuidv4(),
      user_id: userId,
      refresh_token_encrypted: encrypt(tokens.refreshToken),
      access_token_encrypted: encrypt(tokens.accessToken),
      token_expiry: tokens.expiry.toISOString(),
      google_email: tokens.email,
      is_verified: 0,
      customer_ids: JSON.stringify(customers),
    });

    await googleAuthQueries.setVerificationCode({
      code: code6,
      expires,
      user_id: userId,
    });

    try {
      await sendGoogleVerificationCode(tokens.email, code6);
    } catch (e) {
      console.error('[Email] Verification code send failed:', e);
    }

    res.redirect(`${CLIENT_URL}/google-ads?step=verify&email=${encodeURIComponent(tokens.email)}`);
  } catch (err: any) {
    console.error('[Google OAuth] Callback error:', err);
    res.redirect(`${CLIENT_URL}/google-ads?error=oauth_failed`);
  }
});

// Verify email code
router.post('/verify', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { code } = req.body;
  const userId = req.user!.id;

  const auth = await googleAuthQueries.findByUser(userId);
  if (!auth) {
    res.status(404).json({ error: 'Google hesabı tapılmadı' });
    return;
  }
  if (auth.is_verified) {
    res.json({ message: 'Artıq doğrulanıb', verified: true });
    return;
  }
  if (!auth.verification_code) {
    res.status(400).json({ error: 'Doğrulama kodu yoxdur' });
    return;
  }
  if (new Date(auth.verification_expires) < new Date()) {
    res.status(400).json({ error: 'Kodun müddəti bitib. Yenidən bağlayın.' });
    return;
  }
  if (auth.verification_code !== String(code).trim()) {
    res.status(400).json({ error: 'Kod yanlışdır' });
    return;
  }

  await googleAuthQueries.verify(userId);
  res.json({ message: 'Google Ads hesabı doğrulandı', verified: true });
});

// Resend verification code
router.post('/resend-code', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const auth = await googleAuthQueries.findByUser(userId);
  if (!auth || !auth.google_email) {
    res.status(400).json({ error: 'Google hesabı tapılmadı' });
    return;
  }
  const code6 = generateNumericCode(6);
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await googleAuthQueries.setVerificationCode({ code: code6, expires, user_id: userId });
  try {
    await sendGoogleVerificationCode(auth.google_email, code6);
  } catch {
    res.status(500).json({ error: 'Kod göndərilə bilmədi' });
    return;
  }
  res.json({ message: 'Yeni kod göndərildi' });
});

// Get Google Ads connection status
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  const auth = await googleAuthQueries.findByUser(req.user!.id);
  if (!auth) {
    res.json({ connected: false, verified: false });
    return;
  }
  res.json({
    connected: true,
    verified: Boolean(auth.is_verified),
    email: auth.google_email,
    customers: auth.customer_ids ? JSON.parse(auth.customer_ids) : [],
  });
});

// Refresh customer list from Google API
router.post('/refresh-customers', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const auth = await googleAuthQueries.findByUser(userId);
  if (!auth || !auth.is_verified || !auth.refresh_token_encrypted) {
    res.status(403).json({ error: 'Google Ads doğrulanmayıb' }); return;
  }
  try {
    const accessToken = await getAccessToken(auth.refresh_token_encrypted);
    const customers = await getAccessibleCustomers(accessToken);
    if (customers.length === 0) {
      res.status(400).json({ error: 'Heç bir Google Ads hesabı tapılmadı. Developer token TEST modundadır — yalnız test hesabları görünür.' });
      return;
    }
    await googleAuthQueries.upsert({
      id: auth.id,
      user_id: userId,
      refresh_token_encrypted: auth.refresh_token_encrypted,
      access_token_encrypted: auth.access_token_encrypted,
      token_expiry: auth.token_expiry,
      google_email: auth.google_email,
      is_verified: 1,
      customer_ids: JSON.stringify(customers),
    });
    res.json({ customers, count: customers.length });
  } catch (err: any) {
    console.error('[Google] refresh-customers error:', err.response?.data || err.message);
    res.status(500).json({ error: `Hesablar yenilənə bilmədi: ${err.response?.data?.error?.message || err.message}` });
  }
});

// Disconnect Google Ads
router.delete('/disconnect', authMiddleware, async (req: AuthRequest, res: Response) => {
  await googleAuthQueries.delete(req.user!.id);
  res.json({ message: 'Google Ads bağlantısı ləğv edildi' });
});

// Fetch campaign report
router.post('/report', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { customerId, startDate, endDate, prevStartDate, prevEndDate } = req.body;

  if (!customerId || !startDate || !endDate) {
    res.status(400).json({ error: 'customerId, startDate, endDate tələb olunur' });
    return;
  }

  const auth = await googleAuthQueries.findByUser(userId);
  if (!auth || !auth.is_verified) {
    res.status(403).json({ error: 'Google Ads doğrulanmayıb' });
    return;
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken(auth.refresh_token_encrypted);
  } catch {
    res.status(401).json({ error: 'Google token yenilənə bilmədi. Yenidən bağlayın.' });
    return;
  }

  try {
    // Bu hesabın manager ID-sini tap (sub-hesablar üçün login-customer-id lazımdır)
    const customers: Array<{ id: string; managerId?: string }> = JSON.parse(auth.customer_ids || '[]');
    const managerIdForAccount = customers.find(c => c.id === customerId)?.managerId;

    const [campaigns, prevCampaigns, accountTopKeywords] = await Promise.all([
      getCampaignReport(customerId, accessToken, startDate, endDate, managerIdForAccount),
      prevStartDate && prevEndDate
        ? getCampaignReport(customerId, accessToken, prevStartDate, prevEndDate, managerIdForAccount)
        : Promise.resolve([]),
      getAccountTopKeywords(customerId, accessToken, startDate, endDate, managerIdForAccount),
    ]);

    // Format for client
    const formatted = campaigns.map((c) => ({
      ...c,
      cost: microsToCurrency(c.costMicros),
      avgCpc: microsToCurrency(c.avgCpcMicros),
      topKeywords: c.topKeywords?.map((k) => ({
        ...k,
        cost: microsToCurrency(k.costMicros),
        avgCpc: microsToCurrency(k.avgCpcMicros),
      })),
    }));

    const formattedAccountTopKeywords = accountTopKeywords.map(k => ({
      ...k,
      cost: microsToCurrency(k.costMicros),
      avgCpc: microsToCurrency(k.avgCpcMicros),
    }));

    const formattedPrev = prevCampaigns.map((c) => ({
      ...c,
      cost: microsToCurrency(c.costMicros),
      avgCpc: microsToCurrency(c.avgCpcMicros),
    }));

    res.json({
      customerId,
      startDate,
      endDate,
      campaigns: formatted,
      previousCampaigns: formattedPrev,
      accountTopKeywords: formattedAccountTopKeywords,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Kampaniya məlumatları alınarkən xəta: ${err.message}` });
  }
});

export default router;
