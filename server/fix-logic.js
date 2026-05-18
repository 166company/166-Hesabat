require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('./data/ads_audit.db');

// ─────────────────────────────────────────────────────────
// QAİDƏLƏR:
// "temizl..." hesabı → Lux(pattern) > Pərdə(pattern) > Təmizlik(fallback/boş pattern)
// "166 ads..." hesabı → Anbar(pattern) > Yükdaşıma(fallback/boş pattern)
// Digər hesablar → öz sətirləri (whole account, patterns=[])
// ─────────────────────────────────────────────────────────

const updates = [
  // Təmizlik hesabından "fallback" olaraq hamısını götür
  { name: 'Təmizlik',        filter: 'temizl', patterns: '[]',                                excludes: '[]' },
  { name: 'Lux (Təmizlik)',  filter: 'temizl', patterns: '["lux"]',                           excludes: '[]' },
  { name: 'Pərdə (Təmizlik)',filter: 'temizl', patterns: '["pərdə","parda","perde","perdə"]', excludes: '[]' },

  // 166 Ads Group hesabından Anbar → Anbar, yerdə qalanlar → Yükdaşıma (fallback)
  { name: 'Yükdaşıma', filter: '166 ads', patterns: '[]',        excludes: '[]' },
  { name: 'Anbar',     filter: '166 ads', patterns: '["anbar"]', excludes: '[]' },
];

for (const u of updates) {
  const r = db.prepare("UPDATE report_rows SET account_name_filter=?, match_patterns=?, exclude_patterns=? WHERE row_name=?")
    .run(u.filter, u.patterns, u.excludes, u.name);
  console.log(`${r.changes > 0 ? '✓' : '✗'} ${u.name} → filter="${u.filter}", patterns=${u.patterns}`);
}

// Avtomatik xanaları sil ki, təmiz başlayaq
const del = db.prepare("DELETE FROM report_cells WHERE is_manual=0").run();
console.log(`\nSilindi: ${del.changes} köhnə avtomatik xana`);

console.log('\nFinal konfiqurasiya:');
db.prepare("SELECT row_name, account_name_filter, match_patterns FROM report_rows ORDER BY position").all()
  .forEach(r => console.log(`  "${r.row_name}" | filter="${r.account_name_filter}" | patterns=${r.match_patterns}`));
