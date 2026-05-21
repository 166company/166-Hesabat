import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { metaTokenQueries } from '../db/database';
import { encrypt, decrypt } from '../utils/encryption';
import {
  validateToken,
  getAdAccountsForBusiness,
  getPersonalAdAccounts,
  getFullAccountReport,
  getBusinessSuites,
} from '../services/metaService';

const router = Router();
router.use(authMiddleware);

// Yalnız bu 2 icazəli portfolio adları — hər user üçün eyni qayda
const ALLOWED_PORTFOLIO_NAMES = ['166 global logistics', '166 tech'];

function isAllowedPortfolio(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return ALLOWED_PORTFOLIO_NAMES.some(allowed => lower.includes(allowed) || allowed.includes(lower));
}

// Yalnız icazəli portfoliolara aid hesabları çək (dublikat olmadan, şəxsi hesab yox)
async function fetchAllAccounts(accessToken: string): Promise<any[]> {
  const accountMap = new Map<string, any>();
  try {
    const allSuites = await getBusinessSuites(accessToken);
    const allowedSuites = allSuites.filter(s => isAllowedPortfolio(s.name));
    for (const suite of allowedSuites) {
      try {
        const accounts = await getAdAccountsForBusiness(suite.id, accessToken);
        accounts.forEach(a => accountMap.set(a.id, { ...a, _portfolioName: suite.name }));
      } catch { }
    }
  } catch { }
  return [...accountMap.values()];
}

// Get stored suites for user
router.get('/business-suites', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  let tokens = await metaTokenQueries.findByUser(userId);
  if (!tokens.length) tokens = await metaTokenQueries.findAll();
  const suites = tokens.map((t: any) => ({
    id: t.id,
    businessSuiteId: t.business_suite_id,
    businessSuiteName: t.business_suite_name,
    isValid: Boolean(t.is_valid),
    lastValidated: t.last_validated,
  }));
  res.json({ businessSuites: suites });
});

// Validate token (step 1 of wizard)
router.post(
  '/preview-suites',
  [body('accessToken').notEmpty()],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }
    const { accessToken } = req.body;
    const validation = await validateToken(accessToken);
    if (!validation.valid) {
      res.status(400).json({ error: 'Token etibarsızdır.' });
      return;
    }
    res.json({ valid: true, userId: validation.userId, userName: validation.name });
  }
);

// Save token with a custom group name (covers all portfolios)
router.post(
  '/token',
  [
    body('accessToken').notEmpty(),
    body('groupName').trim().notEmpty().withMessage('Qrup adı tələb olunur'),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const userId = req.user!.id;
    const { accessToken, groupName } = req.body as { accessToken: string; groupName: string };

    const validation = await validateToken(accessToken);
    if (!validation.valid) {
      res.status(400).json({ error: 'Token etibarsızdır.' });
      return;
    }

    const encryptedToken = encrypt(accessToken);
    const groupId = `group_${userId}_${Date.now()}`;

    await metaTokenQueries.upsert({
      id: uuidv4(),
      user_id: userId,
      business_suite_id: groupId,
      business_suite_name: groupName.trim(),
      access_token_encrypted: encryptedToken,
    });

    res.json({ message: `"${groupName}" qrupu saxlandı`, groupId });
  }
);

// Remove a token
router.delete('/token/:id', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  await metaTokenQueries.delete(req.params.id, userId);
  res.json({ message: 'Token silindi' });
});

// Fetch report
router.post('/report', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { tokenId, startDate, endDate, prevStartDate, prevEndDate } = req.body;

  if (!tokenId || !startDate || !endDate) {
    res.status(400).json({ error: 'tokenId, startDate, endDate tələb olunur' });
    return;
  }

  const tokenRecord = await metaTokenQueries.findById(tokenId, userId);
  if (!tokenRecord) { res.status(404).json({ error: 'Token tapılmadı' }); return; }

  let accessToken: string;
  try {
    accessToken = decrypt(tokenRecord.access_token_encrypted);
  } catch {
    await metaTokenQueries.invalidate(tokenRecord.id, userId);
    res.status(400).json({ error: 'Token deşifrə edilə bilmədi', expired: true });
    return;
  }

  const validation = await validateToken(accessToken);
  if (!validation.valid) {
    await metaTokenQueries.invalidate(tokenRecord.id, userId);
    res.status(401).json({ error: 'Token müddəti bitib. Yeni token əlavə edin.', expired: true });
    return;
  }

  // Bütün əlçatılan hesabları çək (business suites + personal, dublikat olmadan)
  const accounts = await fetchAllAccounts(accessToken);

  if (accounts.length === 0) {
    res.json({
      businessSuiteId: tokenRecord.business_suite_id,
      businessSuiteName: tokenRecord.business_suite_name,
      startDate, endDate,
      reports: [],
    });
    return;
  }

  const reports = await Promise.all(
    accounts.map(acc =>
      getFullAccountReport(acc.id, acc, accessToken, startDate, endDate, prevStartDate, prevEndDate)
    )
  );

  res.json({
    businessSuiteId: tokenRecord.business_suite_id,
    businessSuiteName: tokenRecord.business_suite_name,
    startDate, endDate,
    reports,
  });
});

export default router;
