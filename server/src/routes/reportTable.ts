import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { reportQueries, metaTokenQueries, googleAuthQueries, tiktokAuthQueries } from '../db/database';
import { decrypt } from '../utils/encryption';
import { validateToken, getBusinessSuites, getAdAccountsForBusiness, getFullAccountReport } from '../services/metaService';
import { getAccessToken, getCampaignReport, getAdGroupSpend, getAdLevelSpend } from '../services/googleService';
import { getCampaignReport as getTikTokReport, getAdvertiserInfo } from '../services/tiktokService';

// Campaign type → column key
function typeToColKey(type: string): string {
  if (type === 'VIDEO') return 'video';
  if (type === 'DISPLAY') return 'display';
  if (type === 'PERFORMANCE_MAX') return 'pmax';
  return 'search';
}

const router = Router();
router.use(authMiddleware);

export const FIXED_COLUMNS = [
  { key: 'search',     name: 'Search',       group: 'google', adType: 'SEARCH' },
  { key: 'display',    name: 'Display',       group: 'google', adType: 'DISPLAY' },
  { key: 'video',      name: 'Video',         group: 'google', adType: 'VIDEO' },
  { key: 'pmax',       name: 'PMAX',          group: 'google', adType: 'PERFORMANCE_MAX' },
  { key: 'meta',       name: 'Meta',          group: 'meta',   adType: null },
  { key: 'tiktok',     name: 'Tiktok',        group: 'manual', adType: null },
  { key: 'linkedin',   name: 'LinkedIn',      group: 'manual', adType: null },
  { key: 'lalafortop', name: 'LalafoTop.az', group: 'manual', adType: null },
];

// Screenshoot-a uyğun düzgün adlar və match/exclude patternlər
const DEFAULT_SECTIONS = [
  {
    name: 'Əsas Xidmətlər',
    rows: [
      // Sıra: daha spesifik patternlər əvvəl gəlir ki, exclude işləsin
      { name: 'Lux (Təmizlik)',       patterns: ['lux'],                              excludes: [] },
      { name: 'Pərdə (Təmizlik)',     patterns: ['pərdə', 'parda', 'perde'],          excludes: [] },
      { name: 'Usta',                 patterns: ['usta'],                             excludes: [] },
      { name: 'Yükdaşıma',           patterns: ['yükdaşıma', 'yukdashima', 'yükdaşima', 'yukdasima', 'cargo'], excludes: [] },
      { name: 'Transport',            patterns: ['transport'],                         excludes: [] },
      { name: 'Xalça',               patterns: ['xalça', 'xalca'],                   excludes: [] },
      { name: 'Evakuasiya',           patterns: ['evakuasiya'],                        excludes: [] },
      { name: 'Təmizlik',             patterns: ['temizlik', 'təmizlik', 'tamizlik'],  excludes: ['lux', 'pərdə', 'parda', 'perde'] },
      { name: 'Bağban & Sanitariya',  patterns: ['bağban', 'bagban', 'sanitariya', 'sanitarya'], excludes: [] },
      { name: 'Tech',                 patterns: ['tech'],                              excludes: [] },
      { name: 'Anbar',               patterns: ['anbar'],                             excludes: [] },
      { name: 'Fəhlə',               patterns: ['fəhlə', 'fehle', 'fähle', 'fehle'], excludes: [] },
      { name: 'Yük.az',              patterns: ['yük.az', 'yukaz', 'yuk.az'],         excludes: [] },
      { name: 'AvtoCheck',            patterns: ['avtocheck', 'avto check', 'avto-check'], excludes: [] },
    ],
  },
  {
    name: 'Life Vakansiyalar',
    rows: [
      { name: 'Sürücü',              patterns: ['sürücü', 'surucu'],                  excludes: ['evakuator'] },
      { name: 'Evakuator sürücüsü',  patterns: ['evakuator sürücü', 'evakuator surucu', 'evakuator'], excludes: [] },
      { name: 'Bağban',              patterns: ['bağban', 'bagban'],                  excludes: ['sanitariya', 'sanitarya'] },
      { name: 'Dezinfaktor',         patterns: ['dezinfaktor'],                        excludes: [] },
      { name: 'Baca təmizləmə',      patterns: ['baca'],                              excludes: [] },
    ],
  },
];


async function createDefaultSections(userId: string) {
  // Mövcud sectionları sil
  const existing = await reportQueries.getSections(userId);
  for (const sec of existing) {
    await reportQueries.deleteRowsBySectionId(sec.id);
    await reportQueries.deleteSection(sec.id, userId);
  }
  // Yenilərini yarat
  for (let si = 0; si < DEFAULT_SECTIONS.length; si++) {
    const sec = DEFAULT_SECTIONS[si];
    const secId = uuidv4();
    await reportQueries.createSection({
      id: secId, user_id: userId, section_name: sec.name,
      position: si, columns_json: JSON.stringify(FIXED_COLUMNS.map(c => c.key)),
    });
    for (let ri = 0; ri < sec.rows.length; ri++) {
      const row = sec.rows[ri];
      await reportQueries.createRow({
        id: uuidv4(), section_id: secId, row_name: row.name,
        match_patterns: JSON.stringify(row.patterns),
        exclude_patterns: JSON.stringify(row.excludes),
        position: ri,
      });
    }
  }
}

// GET sections
router.get('/sections', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  let sections = await reportQueries.getSections(userId);
  if (sections.length === 0) await createDefaultSections(userId);
  sections = await reportQueries.getSections(userId);

  const result = await Promise.all(sections.map(async (sec: any) => {
    const rows = await reportQueries.getRows(sec.id);
    const cells = await reportQueries.getCells(sec.id);
    const cellMap: Record<string, Record<string, number>> = {};
    cells.forEach((c: any) => {
      if (!cellMap[c.row_id]) cellMap[c.row_id] = {};
      cellMap[c.row_id][c.col_key] = c.value;
    });
    return {
      id: sec.id, name: sec.section_name, position: sec.position,
      columns: JSON.parse(sec.columns_json),
      rows: rows.map((r: any) => ({
        id: r.id, name: r.row_name, position: r.position,
        matchPatterns: JSON.parse(r.match_patterns),
        excludePatterns: JSON.parse(r.exclude_patterns || '[]'),
        cells: cellMap[r.id] || {},
      })),
    };
  }));
  res.json({ sections: result, columnDefs: FIXED_COLUMNS });
});

// Reset to defaults
router.post('/reset', async (req: AuthRequest, res: Response) => {
  await createDefaultSections(req.user!.id);
  res.json({ ok: true, message: 'Cədvəl standart vəziyyətə qaytarıldı' });
});

// Update cell
router.put('/cell', async (req: AuthRequest, res: Response) => {
  const { sectionId, rowId, colKey, value } = req.body;
  if (!sectionId || !rowId || !colKey || value === undefined) {
    res.status(400).json({ error: 'sectionId, rowId, colKey, value tələb olunur' }); return;
  }
  await reportQueries.upsertCell({ id: uuidv4(), section_id: sectionId, row_id: rowId, col_key: colKey, value: Number(value), is_manual: 1 });
  res.json({ ok: true });
});

// Add row
router.post('/row', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { sectionId, rowName, matchPatterns, excludePatterns } = req.body;
  const sec = await reportQueries.getSection(sectionId, userId);
  if (!sec) { res.status(404).json({ error: 'Section tapılmadı' }); return; }
  const rows = await reportQueries.getRows(sectionId);
  const id = uuidv4();
  await reportQueries.createRow({
    id, section_id: sectionId, row_name: rowName,
    match_patterns: JSON.stringify(matchPatterns || [rowName.toLowerCase()]),
    exclude_patterns: JSON.stringify(excludePatterns || []),
    position: rows.length,
  });
  res.json({ id, name: rowName });
});

// Delete row
router.delete('/row/:id', async (req: AuthRequest, res: Response) => {
  await reportQueries.deleteRow(req.params.id);
  res.json({ ok: true });
});

// Rename section
router.put('/section/:id', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { name } = req.body;
  const sec = await reportQueries.getSection(req.params.id, userId);
  if (!sec) { res.status(404).json({ error: 'Section tapılmadı' }); return; }
  await reportQueries.updateSection(name, sec.columns_json, req.params.id, userId);
  res.json({ ok: true });
});

// Add section
router.post('/section', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { name } = req.body;
  const existing = await reportQueries.getSections(userId);
  const id = uuidv4();
  await reportQueries.createSection({ id, user_id: userId, section_name: name, position: existing.length, columns_json: JSON.stringify(FIXED_COLUMNS.map(c => c.key)) });
  res.json({ id, name });
});

// Delete section
router.delete('/section/:id', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  await reportQueries.deleteRowsBySectionId(req.params.id);
  await reportQueries.deleteSection(req.params.id, userId);
  res.json({ ok: true });
});

const ALLOWED_PORTFOLIOS = ['166 global logistics', '166 tech'];
function isAllowedPortfolio(name: string) {
  const l = name.toLowerCase();
  return ALLOWED_PORTFOLIOS.some(a => l.includes(a) || a.includes(l));
}

// ə↔e birdir, digər Azərbaycan hərflərini də normallaşdır
function norm(str: string): string {
  return str.toLowerCase()
    .replace(/ə/g, 'e').replace(/ä/g, 'e')  // ə = e
    .replace(/ç/g, 'c').replace(/ğ/g, 'g')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's');
}

// Sətri adına görə tap (bütün seksiyalarda)
function findRowByName(name: string, allSectionRows: { sec: any; rows: any[] }[]): { secId: string; rowId: string } | null {
  for (const { sec, rows } of allSectionRows) {
    const row = rows.find(r => r.row_name === name);
    if (row) return { secId: sec.id, rowId: row.id };
  }
  return null;
}

// Label və ya hesab adına görə uyğun sətiri tap — match_patterns + exclude_patterns
function findRowByAccountName(labelOrAccName: string, allSectionRows: { sec: any; rows: any[] }[]): { secId: string; rowId: string } | null {
  const inputNorm = norm(labelOrAccName);
  for (const { sec, rows } of allSectionRows) {
    for (const row of rows) {
      const patterns: string[] = JSON.parse(row.match_patterns || '[]');
      const excludes: string[] = JSON.parse(row.exclude_patterns || '[]');
      if (excludes.some((e: string) => inputNorm.includes(norm(e)))) continue;
      if (patterns.some((p: string) => inputNorm.includes(norm(p)))) {
        return { secId: sec.id, rowId: row.id };
      }
    }
  }
  return null;
}

// Auto-populate from Google Ads + Meta Ads
router.post('/auto-populate', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { startDate, endDate } = req.body;
  if (!startDate || !endDate) { res.status(400).json({ error: 'startDate, endDate tələb olunur' }); return; }

  const sections = await reportQueries.getSections(userId);
  if (sections.length === 0) { res.status(404).json({ error: 'Section tapılmadı' }); return; }

  const allSectionRows: { sec: any; rows: any[] }[] = await Promise.all(
    sections.map(async (sec: any) => ({
      sec, rows: await reportQueries.getRows(sec.id),
    }))
  );

  // Əvvəlcə bütün avtomatik xanaları sil (həmişə təmiz başla)
  for (const { sec } of allSectionRows) {
    await reportQueries.clearAutoCells(sec.id);
  }

  const results: Record<string, number> = {};
  const unmatched: string[] = [];

  function add(location: { secId: string; rowId: string } | null, colKey: string, cost: number) {
    if (!location || !cost) return;
    const k = `${location.secId}|${location.rowId}|${colKey}`;
    results[k] = (results[k] || 0) + cost;
  }

  // ══════════════════════════════════════════
  // META ADS
  // ══════════════════════════════════════════
  let metaTokens = await metaTokenQueries.findByUser(userId);
  if (!metaTokens.length) metaTokens = await metaTokenQueries.findAll();
  for (const tk of metaTokens) {
    try {
      const accessToken = decrypt(tk.access_token_encrypted);
      const valid = await validateToken(accessToken);
      if (!valid.valid) continue;

      const allSuites = await getBusinessSuites(accessToken);
      console.log('[Meta] Bütün suitlər:', allSuites.map(s => s.name).join(', '));
      const allowedSuites = allSuites.filter(s => isAllowedPortfolio(s.name));
      console.log('[Meta] İcazəli suitlər:', allowedSuites.map(s => s.name).join(', '));
      const accountMap = new Map<string, any>();
      // Suite-ləri paralel yüklə
      await Promise.all(allowedSuites.map(async (suite) => {
        const accs = await getAdAccountsForBusiness(suite.id, accessToken);
        accs.forEach(a => accountMap.set(a.id, a));
      }));
      console.log('[Meta] Bütün hesablar:', [...accountMap.values()].map(a => a.name).join(', '));

      // Hesabları paralel yüklə
      await Promise.all([...accountMap.values()].map(async (acc) => {
        const accName: string = acc.name || '';
        const accNorm = norm(accName);

        // Hesabata daxil edilməyən hesablar (166 Global, Logistika və s.)
        const isSkippedAccount =
          accNorm.includes('logistika') ||
          (accNorm.includes('global') && !accNorm.includes('tech'));
        if (isSkippedAccount) { console.log('[Meta] SKIP:', accName); return; }

        const report = await getFullAccountReport(acc.id, acc, accessToken, startDate, endDate);

        // ──────────────────────────────────────────────────────────────
        // XÜSUSI HESAB 1: "166 Ads Group"
        //   → Adında "166" VƏ ("ads" və ya "group") olan hesab
        //   → "166 Cargo", "166 Logistika" və s. BU QRUPA AİD DEYİL, keçilir
        // Anbar adlı kampaniya → Anbar sətri
        // Qalan BÜTÜN kampaniyalar → Yükdaşıma sətri
        // ──────────────────────────────────────────────────────────────
        const is166Group = accNorm.includes('166') &&
          (accNorm.includes('ads') || accNorm.includes('group') || accNorm.includes('rekl')) &&
          !accNorm.includes('temizl');
        if (is166Group) {
          const campTotal = report.campaigns.reduce((s, c) => s + parseFloat(c.insights?.spend || '0'), 0);
          const accTotal = parseFloat(report.insights?.spend || '0');
          const totalForGroup = campTotal || accTotal;
          if (report.campaigns.length > 0) {
            for (const camp of report.campaigns) {
              const spend = parseFloat(camp.insights?.spend || '0');
              if (!spend) continue;
              const cNorm = norm(camp.name);
              const campLoc = findRowByAccountName(camp.name, allSectionRows);
              if (campLoc) {
                add(campLoc, 'meta', spend);
              } else if (cNorm.includes('anbar')) {
                add(findRowByName('Anbar', allSectionRows), 'meta', spend);
              } else {
                add(findRowByName('Yükdaşıma', allSectionRows), 'meta', spend);
              }
            }
          } else if (totalForGroup > 0) {
            // Kampaniyalar boşdursa hesab xərcini Yükdaşıma-ya yaz
            add(findRowByName('Yükdaşıma', allSectionRows), 'meta', totalForGroup);
          }
          return;
        }

        // ──────────────────────────────────────────────────────────────
        // XÜSUSI HESAB 2: Temizlik/Tamizlik/Cleaning
        //   → Adında "temizl" olan hesab (166 Təmizlik Xidməti, Temizlik, ...)
        // Lux kampaniyası      → Lux (Təmizlik) sətri
        // Pərdə kampaniyası    → Pərdə (Təmizlik) sətri
        // Qalan BÜTÜN kampaniyalar → Təmizlik sətri
        // ──────────────────────────────────────────────────────────────
        const isTemizlik = accNorm.includes('temizl') || accNorm.includes('tamizl') || accNorm.includes('cleaning');
        if (isTemizlik) {
          const accSpend = parseFloat(report.insights?.spend || '0');
          if (report.campaigns.length > 0) {
            for (const camp of report.campaigns) {
              const spend = parseFloat(camp.insights?.spend || '0');
              if (!spend) continue;
              const cNorm = norm(camp.name);
              if (cNorm.includes('lux')) {
                add(findRowByName('Lux (Təmizlik)', allSectionRows), 'meta', spend);
              } else if (cNorm.includes('perde') || cNorm.includes('parda') || cNorm.includes('perda')) {
                add(findRowByName('Pərdə (Təmizlik)', allSectionRows), 'meta', spend);
              } else {
                add(findRowByName('Təmizlik', allSectionRows), 'meta', spend);
              }
            }
          } else if (accSpend > 0) {
            // Kampaniyalar boşdursa hesab xərcini Təmizlik-ə yaz
            add(findRowByName('Təmizlik', allSectionRows), 'meta', accSpend);
          }
          return;
        }

        // ──────────────────────────────────────────────────────────────
        // XÜSUSI HESAB 3: "Life" hesabları
        //   → Adında "life" olan hesab (166 Life, Life Vakansiyalar, ...)
        //   → Kampaniya adlarını YALNIZ "Life Vakansiyalar" bölməsindən axtarır
        //   → Bu sayədə "Bağban" kampaniyası "Bağban & Sanitariya"-ya getmir
        // ──────────────────────────────────────────────────────────────
        if (accNorm.includes('life')) {
          const lifeSections = allSectionRows.filter(s =>
            norm(s.sec.section_name).includes('life') || norm(s.sec.section_name).includes('vakansiya')
          );
          const lifeSection = lifeSections[0];
          const lifeAccSpend = parseFloat(report.insights?.spend || '0');
          if (report.campaigns.length === 0 && lifeAccSpend > 0 && lifeSection) {
            add({ secId: lifeSection.sec.id, rowId: lifeSection.rows[0]?.id }, 'meta', lifeAccSpend);
            return;
          }
          for (const camp of report.campaigns) {
            const spend = parseFloat((camp as any).insights?.spend || '0');
            if (!spend) continue;
            const campLocation = findRowByAccountName(camp.name, lifeSections);
            if (campLocation) {
              add(campLocation, 'meta', spend);
            } else if (lifeSection) {
              // Yeni kampaniya növü — avtomatik sətir yarat
              const newRowId = uuidv4();
              const campNormName = norm(camp.name);
              await reportQueries.createRow({
                id: newRowId,
                section_id: lifeSection.sec.id,
                row_name: camp.name,
                match_patterns: JSON.stringify([campNormName]),
                exclude_patterns: JSON.stringify([]),
                position: lifeSection.rows.length,
              });
              lifeSection.rows.push({ id: newRowId, row_name: camp.name, match_patterns: JSON.stringify([campNormName]), exclude_patterns: '[]' });
              allSectionRows.find(s => s.sec.id === lifeSection.sec.id)!.rows.push({ id: newRowId, row_name: camp.name, match_patterns: JSON.stringify([campNormName]), exclude_patterns: '[]' });
              add({ secId: lifeSection.sec.id, rowId: newRowId }, 'meta', spend);
              console.log(`[AutoPopulate] Life yeni sətir: "${camp.name}" $${spend.toFixed(2)}`);
            }
          }
          return;
        }

        // ──────────────────────────────────────────────────────────────
        // DİGƏR BÜTÜN HESABLAR:
        //   1) Hesab adına görə uyğun sətir varsa — bütün xərc ora
        //   2) Yoxdursa — hər kampaniya adına görə ayrıca uyğunlaşdır
        // ──────────────────────────────────────────────────────────────
        const accLocation = findRowByAccountName(accName, allSectionRows);
        if (accLocation) {
          const campSpend = report.campaigns.reduce((s, c) => s + parseFloat(c.insights?.spend || '0'), 0);
          const accSpend = parseFloat(report.insights?.spend || '0');
          const totalSpend = campSpend || accSpend; // hesab xərcini fallback kimi istifadə et
          console.log(`[Meta] "${accName}" → row match: camp=$${campSpend.toFixed(2)} acc=$${accSpend.toFixed(2)} used=$${totalSpend.toFixed(2)}`);
          if (totalSpend > 0) add(accLocation, 'meta', totalSpend);
        } else {
          let anyMatched = false;
          let matchedTotal = 0;
          for (const camp of report.campaigns) {
            const spend = parseFloat((camp as any).insights?.spend || '0');
            if (!spend) continue;
            const campLocation = findRowByAccountName(camp.name, allSectionRows);
            if (campLocation) { add(campLocation, 'meta', spend); anyMatched = true; matchedTotal += spend; }
            else { console.log(`[Meta] UNMATCHED camp: "${camp.name}" $${spend.toFixed(2)} (from "${accName}")`); }
          }
          if (!anyMatched) {
            const total = report.campaigns.reduce((s, c) => s + parseFloat((c as any).insights?.spend || '0'), 0);
            if (total > 0) console.log(`[Meta] SKIP account: "${accName}" $${total.toFixed(2)}`);
          } else {
            console.log(`[Meta] "${accName}" → campaign match: $${matchedTotal.toFixed(2)}`);
          }
        }
      }));
    } catch (e) { console.error('[AutoPopulate] Meta error:', e); }
  }

  // ══════════════════════════════════════════
  // GOOGLE ADS — Label əsaslı
  // Label → sətir (row) təyin edir
  // Campaign type → sütun (column) təyin edir
  // ══════════════════════════════════════════
  const googleAuth = await googleAuthQueries.findByUser(userId)
    ?? await googleAuthQueries.findFirst();
  if (googleAuth?.is_verified && googleAuth?.refresh_token_encrypted) {
    try {
      const accessToken = await getAccessToken(googleAuth.refresh_token_encrypted);
      const customers: { id: string; name: string; managerId?: string }[] = JSON.parse(googleAuth.customer_ids || '[]');
      await Promise.all(customers.map(async (customer) => {
        try {
          const campaigns = await getCampaignReport(customer.id, accessToken, startDate, endDate, customer.managerId);
          // Hesab adına görə sətir (label/kampaniya adı tapılmadıqda son fallback)
          const accountLocation = findRowByAccountName(customer.name || '', allSectionRows);

          for (const camp of campaigns) {
            const campCost = camp.costMicros / 1_000_000;
            if (!campCost) continue;
            const colKey = typeToColKey(camp.type);
            const campNorm = norm(camp.name);

            // ── Retargeting/Remarketing xüsusi halı ──
            // 1) Ad group adına görə; tapılmadıqda 2) ad (ad headline) adına görə bölüşdür
            if (campNorm.includes('retarget') || campNorm.includes('remarketing') || campNorm.includes('rem-')) {
              const adGroups = await getAdGroupSpend(camp.id, customer.id, accessToken, startDate, endDate, customer.managerId);
              for (const ag of adGroups) {
                const agCost = ag.costMicros / 1_000_000;
                if (!agCost) continue;
                const agLoc = findRowByAccountName(ag.name, allSectionRows);
                if (agLoc) {
                  add(agLoc, colKey, agCost);
                } else {
                  // Ad group adı uyğun deyil — ad (reklam) headline-larına keç
                  const ads = await getAdLevelSpend(ag.id, customer.id, accessToken, startDate, endDate, customer.managerId);
                  let adMatched = false;
                  for (const ad of ads) {
                    const adLoc = findRowByAccountName(ad.name, allSectionRows);
                    if (adLoc) {
                      add(adLoc, colKey, ad.costMicros / 1_000_000);
                      adMatched = true;
                    }
                  }
                  if (!adMatched) {
                    unmatched.push(`[Google-Retarget AG] ${ag.name} $${agCost.toFixed(2)}`);
                  }
                }
              }
              continue;
            }

            let matched = false;

            for (const labelName of camp.labelNames) {
              const labelNorm = norm(labelName);

              // Təmizlik label-ı içindəki Pərdə və Lux kampaniyaları campaign adına görə ayrılır
              if (labelNorm.includes('temizl') || labelNorm.includes('tamizl')) {
                if (campNorm.includes('perde') || campNorm.includes('parda') || campNorm.includes('pərdə')) {
                  add(findRowByName('Pərdə (Təmizlik)', allSectionRows), colKey, campCost);
                } else if (campNorm.includes('lux')) {
                  add(findRowByName('Lux (Təmizlik)', allSectionRows), colKey, campCost);
                } else {
                  add(findRowByName('Təmizlik', allSectionRows), colKey, campCost);
                }
                matched = true;
                break;
              }

              // Digər label-lar: birbaşa uyğun sətirə yaz
              const loc = findRowByAccountName(labelName, allSectionRows);
              if (loc) { add(loc, colKey, campCost); matched = true; break; }
            }

            // Label tapılmadısa campaign adı, sonra hesab adı ilə cəhd et
            if (!matched) {
              const cn = norm(camp.name);
              const isSkipped =
                cn.includes('166 global') ||
                cn.includes('cinden') ||
                (cn.includes('china') && cn.includes('canada'));
              if (isSkipped) continue;

              const loc = findRowByAccountName(camp.name, allSectionRows) || accountLocation;
              if (loc) {
                add(loc, colKey, campCost);
              } else {
                unmatched.push(`[Google] ${camp.name} labels=[${camp.labelNames.join(',')}] $${campCost.toFixed(2)}`);
              }
            }
          }
        } catch (e) { console.error(`[AutoPopulate] Google customer ${customer.id}:`, e); }
      }));
    } catch (e) { console.error('[AutoPopulate] Google error:', e); }
  }

  // ══════════════════════════════════════════
  // TIKTOK ADS
  // ══════════════════════════════════════════
  const tiktokAuth = await tiktokAuthQueries.findByUser(userId)
    ?? await tiktokAuthQueries.findFirst();
  if (tiktokAuth?.access_token_encrypted) {
    try {
      const tiktokToken = decrypt(tiktokAuth.access_token_encrypted);
      const advertiserIds: string[] = JSON.parse(tiktokAuth.advertiser_ids || '[]');

      const lifeSection = allSectionRows.find(s =>
        norm(s.sec.section_name).includes('life') || norm(s.sec.section_name).includes('vakansiya')
      );

      await Promise.all(advertiserIds.map(async (advId) => {
        try {
          const info = await getAdvertiserInfo(tiktokToken, advId);
          const campaigns = await getTikTokReport(tiktokToken, advId, startDate, endDate, info.name);

          for (const camp of campaigns) {
            if (!camp.spend) continue;
            const cNorm = norm(camp.name);

            // Vakansiya kampaniyaları → Life bölməsi
            const isVakansiya = cNorm.includes('vakansiya') || cNorm.includes('is elani') ||
              cNorm.includes('surucu') || cNorm.includes('surucü') || cNorm.includes('dezinfaktor') ||
              cNorm.includes('baca') || cNorm.includes('evakuator');

            if (isVakansiya && lifeSection) {
              const lifeSections = allSectionRows.filter(s =>
                norm(s.sec.section_name).includes('life') || norm(s.sec.section_name).includes('vakansiya')
              );
              const loc = findRowByAccountName(camp.name, lifeSections);
              add(loc || (lifeSection ? { secId: lifeSection.sec.id, rowId: lifeSection.rows[0]?.id } : null), 'tiktok', camp.spend);
              continue;
            }

            // Kampaniya adına görə sətir tap
            const loc = findRowByAccountName(camp.name, allSectionRows)
              || findRowByAccountName(info.name, allSectionRows);
            if (loc) {
              add(loc, 'tiktok', camp.spend);
            } else {
              unmatched.push(`[TikTok] ${camp.name} (${info.name}) $${camp.spend.toFixed(2)}`);
            }
          }
        } catch (e: any) {
          console.error(`[AutoPopulate] TikTok ${advId}:`, e.message);
        }
      }));
    } catch (e) { console.error('[AutoPopulate] TikTok error:', e); }
  }

  // ══════════════════════════════════════════
  // DB-YƏ YAZ
  // ══════════════════════════════════════════
  for (const [key, value] of Object.entries(results)) {
    const [sId, rId, cKey] = key.split('|');
    await reportQueries.upsertCell({
      id: uuidv4(), section_id: sId, row_id: rId,
      col_key: cKey, value: Math.round(value * 100) / 100, is_manual: 0,
    });
  }

  res.json({ populated: Object.keys(results).length, unmatched, message: `${Object.keys(results).length} xana dolduruldu` });
});

// Debug Meta hesablarını göstər (müvəqqəti public)
router.get('/debug-meta', async (_req: AuthRequest, res: Response) => {
  const userId = '82f4180a-bf76-4dcf-880d-29be6f58b57f'; // admin
  let metaTokens = await metaTokenQueries.findByUser(userId);
  if (!metaTokens.length) metaTokens = await metaTokenQueries.findAll();
  const result: any[] = [];
  for (const tk of metaTokens) {
    try {
      const accessToken = decrypt(tk.access_token_encrypted);
      const valid = await validateToken(accessToken);
      if (!valid.valid) { result.push({ token: tk.id, valid: false }); continue; }
      const allSuites = await getBusinessSuites(accessToken);
      const allowed = allSuites.filter(s => isAllowedPortfolio(s.name));
      const accountList: any[] = [];
      for (const suite of allowed) {
        const accs = await getAdAccountsForBusiness(suite.id, accessToken);
        for (const acc of accs) {
          const accNorm = norm(acc.name || '');
          const isSkipped = accNorm.includes('logistika') || (accNorm.includes('global') && !accNorm.includes('tech'));
          accountList.push({ name: acc.name, norm: accNorm, skipped: isSkipped });
        }
      }
      result.push({
        token: tk.business_suite_name,
        valid: true,
        allSuites: allSuites.map(s => s.name),
        allowedSuites: allowed.map(s => s.name),
        accounts: accountList,
      });
    } catch (e: any) { result.push({ token: tk.id, error: e.message }); }
  }
  res.json(result);
});

export default router;
