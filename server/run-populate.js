/**
 * Maliyyə Cədvəli — Birbaşa Doldurma Skripti
 * İstifadə: node run-populate.js YYYY-MM-DD YYYY-MM-DD
 * Nümunə:   node run-populate.js 2026-05-01 2026-05-07
 */
require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const axios = require('axios');
const path = require('path');
const { createDecipheriv } = require('crypto');

const db = new DatabaseSync(path.resolve('./data/ads_audit.db'));

// ─── Şifrə açma ───────────────────────────────────────────────
const KEY_HEX = process.env.ENCRYPTION_KEY || '';
const KEY = Buffer.from(KEY_HEX, 'hex');
function decrypt(text) {
  const [ivHex, encHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const d = createDecipheriv('aes-256-cbc', KEY, iv);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

// ─── Normallaşdırma (ə=e, ç=c, ş=s ...) ──────────────────────
function norm(s) {
  return s.toLowerCase()
    .replace(/ə/g,'e').replace(/ä/g,'e')
    .replace(/ç/g,'c').replace(/ğ/g,'g')
    .replace(/ı/g,'i').replace(/ö/g,'o')
    .replace(/ü/g,'u').replace(/ş/g,'s');
}

// ─── Meta API ─────────────────────────────────────────────────
const GRAPH = 'https://graph.facebook.com/v19.0';
async function graphGet(path, params, token) {
  const r = await axios.get(`${GRAPH}${path}`, { params: { ...params, access_token: token }, timeout: 30000 });
  return r.data;
}
async function getBusinessSuites(token) {
  try { const d = await graphGet('/me/businesses', { fields: 'id,name', limit: '50' }, token); return d.data || []; } catch { return []; }
}
async function getAccountsForBusiness(bizId, token) {
  try { const d = await graphGet(`/${bizId}/owned_ad_accounts`, { fields: 'id,name,currency,account_status', limit: '100' }, token); return d.data || []; } catch { return []; }
}
async function getCampaignSpends(accId, token, since, until) {
  const id = accId.startsWith('act_') ? accId : `act_${accId}`;
  try {
    const camps = await graphGet(`/${id}/campaigns`, { fields: 'id,name,status', limit: '200' }, token);
    const result = [];
    for (const c of (camps.data || [])) {
      try {
        // time_range doğru tarix filteri üçün (since/until pagination parametrləridir)
        const ins = await graphGet(`/${c.id}/insights`, { fields: 'spend', time_range: JSON.stringify({since, until}), limit: '1' }, token);
        const spend = parseFloat(ins.data?.[0]?.spend || '0');
        if (spend > 0) result.push({ name: c.name, spend });
      } catch {}
    }
    return result;
  } catch { return []; }
}

// ─── İzin verilən portfolio adları ───────────────────────────
const ALLOWED = ['166 global logistics', '166 tech'];
function isAllowed(name) {
  const l = norm(name);
  return ALLOWED.some(a => l.includes(norm(a)) || norm(a).includes(l));
}

// ─── Ana məntiqi ──────────────────────────────────────────────
async function main() {
  const [,, since, until] = process.argv;
  if (!since || !until) {
    console.log('İstifadə: node run-populate.js YYYY-MM-DD YYYY-MM-DD');
    console.log('Nümunə:   node run-populate.js 2026-05-01 2026-05-07');
    process.exit(1);
  }
  console.log(`\nMaliyyə Cədvəli Doldurulur: ${since} → ${until}\n`);

  // Bütün user-ləri tap
  const users = db.prepare("SELECT id, email FROM users WHERE status='approved'").all();

  for (const user of users) {
    console.log(`\n👤 User: ${user.email}`);

    // Bu userin seksiyaları
    const sections = db.prepare("SELECT * FROM report_sections WHERE user_id=? ORDER BY position").all(user.id);
    if (!sections.length) { console.log('  Cədvəl yoxdur, keçilir'); continue; }

    const allSectionRows = sections.map(sec => ({
      sec, rows: db.prepare("SELECT * FROM report_rows WHERE section_id=? ORDER BY position").all(sec.id)
    }));

    // Köhnə avtomatik xanaları sil
    for (const { sec } of allSectionRows) {
      db.prepare("DELETE FROM report_cells WHERE section_id=? AND is_manual=0").run(sec.id);
    }

    const results = {};
    function add(name, colKey, cost) {
      if (!cost) return;
      let found = null;
      for (const { sec, rows } of allSectionRows) {
        const row = rows.find(r => r.row_name === name);
        if (row) { found = { secId: sec.id, rowId: row.id }; break; }
      }
      if (!found) { console.log(`  ⚠ Sətir tapılmadı: "${name}"`); return; }
      const k = `${found.secId}|${found.rowId}|${colKey}`;
      results[k] = (results[k] || 0) + cost;
    }
    function findRowByPatternsInSections(labelOrAccName, sections) {
      const inputNorm = norm(labelOrAccName);
      for (const { sec, rows } of sections) {
        for (const row of rows) {
          const patterns = JSON.parse(row.match_patterns || '[]');
          const excludes = JSON.parse(row.exclude_patterns || '[]');
          if (excludes.some(e => inputNorm.includes(norm(e)))) continue;
          if (patterns.some(p => inputNorm.includes(norm(p)))) {
            return { secId: sec.id, rowId: row.id, rowName: row.row_name };
          }
        }
      }
      return null;
    }
    function findRowByPatterns(labelOrAccName) {
      const inputNorm = norm(labelOrAccName);
      for (const { sec, rows } of allSectionRows) {
        for (const row of rows) {
          const patterns = JSON.parse(row.match_patterns || '[]');
          const excludes = JSON.parse(row.exclude_patterns || '[]');
          if (excludes.some(e => inputNorm.includes(norm(e)))) continue;
          if (patterns.some(p => inputNorm.includes(norm(p)))) {
            return { secId: sec.id, rowId: row.id, rowName: row.row_name };
          }
        }
      }
      return null;
    }
    function addByAccountName(accName, colKey, totalCost) {
      if (!totalCost) return;
      const found = findRowByPatterns(accName);
      if (found) {
        const k = `${found.secId}|${found.rowId}|${colKey}`;
        results[k] = (results[k] || 0) + totalCost;
        console.log(`  ✓ "${accName}" → "${found.rowName}" $${totalCost.toFixed(2)}`);
      } else {
        console.log(`  ○ "${accName}" → uyğun sətir tapılmadı`);
      }
    }

    // Meta tokenləri
    const tokens = db.prepare("SELECT * FROM meta_tokens WHERE user_id=? AND is_valid=1").all(user.id);
    for (const tk of tokens) {
      let accessToken;
      try { accessToken = decrypt(tk.access_token_encrypted); } catch { continue; }

      const suites = await getBusinessSuites(accessToken);
      const allowed = suites.filter(s => isAllowed(s.name));
      if (!allowed.length) { console.log('  İzin verilən portfolio tapılmadı'); continue; }

      const accMap = new Map();
      for (const s of allowed) {
        const accs = await getAccountsForBusiness(s.id, accessToken);
        accs.forEach(a => accMap.set(a.id, a));
      }
      console.log(`  Portfolio hesabları: ${accMap.size}`);

      for (const [, acc] of accMap) {
        const accName = acc.name || '';
        const an = norm(accName);
        const campaigns = await getCampaignSpends(acc.id, accessToken, since, until);
        if (!campaigns.length) continue;
        const total = campaigns.reduce((s, c) => s + c.spend, 0);

        // ── 166 Ads Group ──────────────────────────────────────
        if (an.includes('166') && (an.includes('ads') || an.includes('group') || an.includes('rekl')) && !an.includes('temizl')) {
          console.log(`  [166ADS] "${accName}" → ${campaigns.length} kampaniya`);
          for (const c of campaigns) {
            if (norm(c.name).includes('anbar')) {
              add('Anbar', 'meta', c.spend);
              console.log(`    anbar: "${c.name}" $${c.spend.toFixed(2)}`);
            } else {
              add('Yükdaşıma', 'meta', c.spend);
              console.log(`    yükdaşıma: "${c.name}" $${c.spend.toFixed(2)}`);
            }
          }
          continue;
        }

        // ── Temizlik hesabı ────────────────────────────────────
        if (an.includes('temizl') || an.includes('tamizl') || an.includes('cleaning')) {
          console.log(`  [TEMİZLİK] "${accName}" → ${campaigns.length} kampaniya`);
          for (const c of campaigns) {
            const cn = norm(c.name);
            if (cn.includes('lux')) {
              add('Lux (Təmizlik)', 'meta', c.spend);
              console.log(`    lux: "${c.name}" $${c.spend.toFixed(2)}`);
            } else if (cn.includes('perde') || cn.includes('parda') || cn.includes('perda')) {
              add('Pərdə (Təmizlik)', 'meta', c.spend);
              console.log(`    perde: "${c.name}" $${c.spend.toFixed(2)}`);
            } else {
              add('Təmizlik', 'meta', c.spend);
              console.log(`    temizlik: "${c.name}" $${c.spend.toFixed(2)}`);
            }
          }
          continue;
        }

        // ── "Life" hesabı — yalnız Life Vakansiyalar bölməsindən axtarır ──
        if (an.includes('life')) {
          console.log(`  [LIFE] "${accName}" → ${campaigns.length} kampaniya`);
          const lifeSections = allSectionRows.filter(s =>
            norm(s.sec.section_name || '').includes('life') ||
            norm(s.sec.section_name || '').includes('vakansiya')
          );
          for (const c of campaigns) {
            if (!c.spend) continue;
            const found = findRowByPatternsInSections(c.name, lifeSections);
            if (found) {
              const k = `${found.secId}|${found.rowId}|meta`;
              results[k] = (results[k] || 0) + c.spend;
              console.log(`    ✓ "${c.name}" → "${found.rowName}" $${c.spend.toFixed(2)}`);
            } else {
              console.log(`    ○ "${c.name}" → Life-da uyğun sətir yoxdur`);
            }
          }
          continue;
        }

        // ── Digər hesablar — hesab adına, yoxdursa kampaniya adına görə ──
        const accFound = findRowByPatterns(accName);
        if (accFound) {
          const k = `${accFound.secId}|${accFound.rowId}|meta`;
          results[k] = (results[k] || 0) + total;
          console.log(`  ✓ hesab:"${accName}" → "${accFound.rowName}" $${total.toFixed(2)}`);
        } else {
          let anyMatched = false;
          for (const c of campaigns) {
            if (!c.spend) continue;
            const campFound = findRowByPatterns(c.name);
            if (campFound) {
              const k = `${campFound.secId}|${campFound.rowId}|meta`;
              results[k] = (results[k] || 0) + c.spend;
              console.log(`  ✓ camp:"${c.name}" → "${campFound.rowName}" $${c.spend.toFixed(2)}`);
              anyMatched = true;
            }
          }
          if (!anyMatched) console.log(`  ○ "${accName}" → uyğun sətir tapılmadı`);
        }
      }
    }

    // ══ GOOGLE ADS — Label əsaslı ══════════════════════════════
    const googleAuth = db.prepare("SELECT * FROM google_auth WHERE user_id=? AND is_verified=1").get(user.id);
    if (googleAuth?.refresh_token_encrypted) {
      try {
        const { google } = require('googleapis');
        const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
        oauth2Client.setCredentials({ refresh_token: decrypt(googleAuth.refresh_token_encrypted) });
        const { token: accessToken } = await oauth2Client.getAccessToken();
        const customers = JSON.parse(googleAuth.customer_ids || '[]');
        const ADS_BASE = 'https://googleads.googleapis.com/v20';
        const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
        const headers = { Authorization: `Bearer ${accessToken}`, 'developer-token': devToken, 'Content-Type': 'application/json' };

        async function gSearch(query, customerId, managerId) {
          try {
            const h = { ...headers };
            if (managerId) h['login-customer-id'] = managerId.replace(/-/g, '');
            const r = await axios.post(`${ADS_BASE}/customers/${customerId}/googleAds:search`, { query }, { headers: h, timeout: 30000 });
            return r.data.results || [];
          } catch(e) { console.log(`    ⚠ gSearch xəta (${customerId}): ${e.response?.data?.error?.message || e.message}`); return []; }
        }

        function typeToCol(type) {
          if (type === 'VIDEO') return 'video';
          if (type === 'DISPLAY') return 'display';
          if (type === 'PERFORMANCE_MAX') return 'pmax';
          return 'search';
        }

        for (const customer of customers) {
          const cid = customer.id.replace(/-/g, '');
          const mid = customer.managerId;
          // Hesab adına görə sətir (son fallback)
          const accountFound = findRowByPatterns(customer.name || '');

          const labelRows = await gSearch('SELECT label.id, label.name FROM label', cid, mid);
          const labelMap = {};
          for (const lr of labelRows) { if (lr.label?.id) labelMap[lr.label.id.toString()] = lr.label.name; }

          const campRows = await gSearch(`
            SELECT campaign.name, campaign.advertising_channel_type,
                   campaign.labels, metrics.cost_micros
            FROM campaign
            WHERE segments.date BETWEEN '${since}' AND '${until}'
              AND campaign.status != 'REMOVED'
              AND metrics.cost_micros > 0
            ORDER BY metrics.cost_micros DESC`, cid, mid);

          console.log(`  [GOOGLE] ${customer.name || cid}: ${campRows.length} kampaniya`);

          for (const cr of campRows) {
            const cost = (cr.metrics?.costMicros || 0) / 1_000_000;
            if (!cost) continue;
            const colKey = typeToCol(cr.campaign?.advertisingChannelType || '');
            const campNm = norm(cr.campaign?.name || '');

            // ── Retargeting/Remarketing xüsusi halı — ad group adına görə bölüşdür
            if (campNm.includes('retarget') || campNm.includes('remarketing') || campNm.includes('rem-')) {
              const campId = cr.campaign?.id;
              if (campId) {
                const agRows = await gSearch(`
                  SELECT ad_group.name, metrics.cost_micros
                  FROM ad_group
                  WHERE segments.date BETWEEN '${since}' AND '${until}'
                    AND campaign.id = ${campId}
                    AND ad_group.status != 'REMOVED'
                    AND metrics.cost_micros > 0
                  ORDER BY metrics.cost_micros DESC`, cid, mid);
                for (const ag of agRows) {
                  const agCost = (ag.metrics?.costMicros || 0) / 1_000_000;
                  if (!agCost) continue;
                  const agId = ag.adGroup?.id;
                  const agFound = findRowByPatterns(ag.adGroup?.name || '');
                  if (agFound) {
                    results[`${agFound.secId}|${agFound.rowId}|${colKey}`] = (results[`${agFound.secId}|${agFound.rowId}|${colKey}`] || 0) + agCost;
                    console.log(`    [retarget AG] "${ag.adGroup?.name}" → "${agFound.rowName}" $${agCost.toFixed(2)}`);
                  } else if (agId) {
                    // Ad group uyğun deyil — ad (reklam) headline-larına keç
                    const adRows = await gSearch(`
                      SELECT ad_group_ad.ad.responsive_search_ad.headlines,
                             ad_group_ad.ad.responsive_display_ad.headlines,
                             ad_group_ad.ad.name, metrics.cost_micros
                      FROM ad_group_ad
                      WHERE segments.date BETWEEN '${since}' AND '${until}'
                        AND ad_group.id = ${agId}
                        AND ad_group_ad.status != 'REMOVED'
                        AND metrics.cost_micros > 0
                      ORDER BY metrics.cost_micros DESC`, cid, mid);
                    let adMatched = false;
                    for (const adR of adRows) {
                      const adCost = (adR.metrics?.costMicros || 0) / 1_000_000;
                      if (!adCost) continue;
                      const adAd = adR.adGroupAd?.ad || {};
                      const headlines = [
                        ...(adAd.responsiveSearchAd?.headlines || []).map((h) => h.text || ''),
                        ...(adAd.responsiveDisplayAd?.headlines || []).map((h) => h.text || ''),
                        adAd.name || '',
                      ].filter(Boolean).join(' | ');
                      const adFound = findRowByPatterns(headlines);
                      if (adFound) {
                        results[`${adFound.secId}|${adFound.rowId}|${colKey}`] = (results[`${adFound.secId}|${adFound.rowId}|${colKey}`] || 0) + adCost;
                        console.log(`    [retarget AD] "${headlines.substring(0,40)}" → "${adFound.rowName}" $${adCost.toFixed(2)}`);
                        adMatched = true;
                      }
                    }
                    if (!adMatched) console.log(`    [retarget AG] "${ag.adGroup?.name}" → ad səviyyəsində də uyğun sətir yoxdur`);
                  } else {
                    console.log(`    [retarget AG] "${ag.adGroup?.name}" → uyğun sətir yoxdur`);
                  }
                }
              }
              continue;
            }

            const labelRns = cr.campaign?.labels || [];
            const labelNames = labelRns.map(rn => { const id = rn.split('/').pop(); return id ? labelMap[id] : null; }).filter(Boolean);

            let matched = false;
            for (const ln of labelNames) {
              const lnorm = norm(ln);

              // Təmizlik label-ı → campaign adına görə Pərdə / Lux / Təmizlik
              if (lnorm.includes('temizl') || lnorm.includes('tamizl')) {
                if (campNm.includes('perde') || campNm.includes('parda') || campNm.includes('pərdə')) {
                  const row = allSectionRows.flatMap(s => s.rows).find(r => r.row_name === 'Pərdə (Təmizlik)');
                  const sec = allSectionRows.find(s => s.rows.includes(row));
                  if (row && sec) { results[`${sec.sec.id}|${row.id}|${colKey}`] = (results[`${sec.sec.id}|${row.id}|${colKey}`] || 0) + cost; console.log(`    [${colKey}] perde: "${cr.campaign?.name}" $${cost.toFixed(2)}`); }
                } else if (campNm.includes('lux')) {
                  const row = allSectionRows.flatMap(s => s.rows).find(r => r.row_name === 'Lux (Təmizlik)');
                  const sec = allSectionRows.find(s => s.rows.includes(row));
                  if (row && sec) { results[`${sec.sec.id}|${row.id}|${colKey}`] = (results[`${sec.sec.id}|${row.id}|${colKey}`] || 0) + cost; console.log(`    [${colKey}] lux: "${cr.campaign?.name}" $${cost.toFixed(2)}`); }
                } else {
                  const row = allSectionRows.flatMap(s => s.rows).find(r => r.row_name === 'Təmizlik');
                  const sec = allSectionRows.find(s => s.rows.includes(row));
                  if (row && sec) { results[`${sec.sec.id}|${row.id}|${colKey}`] = (results[`${sec.sec.id}|${row.id}|${colKey}`] || 0) + cost; console.log(`    [${colKey}] temizlik: "${cr.campaign?.name}" $${cost.toFixed(2)}`); }
                }
                matched = true; break;
              }

              // Digər label-lar — match_patterns əsaslı
              const found = findRowByPatterns(ln);
              if (found) {
                results[`${found.secId}|${found.rowId}|${colKey}`] = (results[`${found.secId}|${found.rowId}|${colKey}`] || 0) + cost;
                console.log(`    [${colKey}] label:"${ln}" → "${found.rowName}" $${cost.toFixed(2)}`);
                matched = true; break;
              }
            }
            if (!matched) {
              const cn = norm(cr.campaign?.name || '');
              const isSkipped =
                cn.includes('166 global') ||
                cn.includes('cinden') ||
                (cn.includes('china') && cn.includes('canada'));
              if (isSkipped) { console.log(`    — skip: "${cr.campaign?.name}"`); continue; }
              // Kampaniya adına görə cəhd et
              const found = findRowByPatterns(cr.campaign?.name || '') || accountFound;
              if (found) {
                results[`${found.secId}|${found.rowId}|${colKey}`] = (results[`${found.secId}|${found.rowId}|${colKey}`] || 0) + cost;
                console.log(`    [${colKey}] camp:"${cr.campaign?.name}" → "${found.rowName}" $${cost.toFixed(2)}`);
              } else {
                console.log(`    ○ uyğunsuz: "${cr.campaign?.name}" labels=[${labelNames.join(',')}]`);
              }
            }
          }
        }
      } catch(e) { console.error('  [GOOGLE] Xəta:', e.message); }
    }

    // DB-yə yaz
    const { randomUUID } = require('crypto');
    let written = 0;
    for (const [key, value] of Object.entries(results)) {
      const [sId, rId, cKey] = key.split('|');
      db.prepare(`INSERT INTO report_cells (id, section_id, row_id, col_key, value, is_manual, updated_at)
        VALUES (?,?,?,?,?,0,CURRENT_TIMESTAMP)
        ON CONFLICT(section_id,row_id,col_key) DO UPDATE SET value=excluded.value, is_manual=0, updated_at=CURRENT_TIMESTAMP`)
        .run(randomUUID(), sId, rId, cKey, Math.round(value * 100) / 100);
      written++;
    }
    console.log(`\n  ✅ ${written} xana yazıldı\n`);
  }
  console.log('Tamamlandı!');
}

main().catch(e => { console.error('XƏTA:', e.message); process.exit(1); });
