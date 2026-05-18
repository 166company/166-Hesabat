require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.resolve('./data/ads_audit.db'));

// Düzgün adlar və patternlər
const FIXES = [
  // [köhnə_ad_pattern, yeni_ad, yeni_match_patterns, exclude_patterns]
  ['yüklösma',  'Yükdaşıma',          '["yükdaşıma","yukdashima","yukdasima"]', '[]'],
  ['yuklosma',  'Yükdaşıma',          '["yükdaşıma","yukdashima","yukdasima"]', '[]'],
  ['taxt',      'Tech',               '["tech"]',                               '[]'],
  ['pəşo',      'Fəhlə',              '["fəhlə","fehle","fähle"]',              '[]'],
  ['pesho',     'Fəhlə',              '["fəhlə","fehle","fähle"]',              '[]'],
  ['yük.ar',    'Yük.az',             '["yük.az","yukaz","yuk.az"]',            '[]'],
  ['sanitarya', 'Bağban & Sanitariya','["bağban","bagban","sanitariya","sanitarya"]','[]'],
  ['lux (tamizlik)', 'Lux (Təmizlik)','["lux"]',                                '[]'],
  ['parda (tamizlik)','Pərdə (Təmizlik)','["pərdə","parda","perde"]',           '[]'],
  ['parda (temizlik)','Pərdə (Təmizlik)','["pərdə","parda","perde"]',           '[]'],
];

// Bütün sətirləri çək
const allRows = db.prepare('SELECT id, row_name FROM report_rows').all();
let fixed = 0;

for (const row of allRows) {
  const lower = row.row_name.toLowerCase();
  for (const [pattern, newName, newPatterns, excludes] of FIXES) {
    if (lower.includes(pattern.toLowerCase())) {
      db.prepare('UPDATE report_rows SET row_name=?, match_patterns=?, exclude_patterns=? WHERE id=?')
        .run(newName, newPatterns, excludes, row.id);
      console.log(`Fixed: "${row.row_name}" → "${newName}"`);
      fixed++;
      break;
    }
  }
}

// Təmizlik sətirinin exclude_patterns-ini yenilə
const temRows = db.prepare("SELECT id FROM report_rows WHERE row_name LIKE '%Temizlik%' OR row_name LIKE '%Təmizlik%' OR row_name LIKE '%temizlik%'").all();
for (const r of temRows) {
  const rData = db.prepare('SELECT row_name FROM report_rows WHERE id=?').get(r.id);
  if (rData.row_name === 'Lux (Təmizlik)' || rData.row_name === 'Pərdə (Təmizlik)') continue;
  db.prepare("UPDATE report_rows SET exclude_patterns='[\"lux\",\"pərdə\",\"parda\",\"perde\"]' WHERE id=?").run(r.id);
  console.log(`Updated excludes for: "${rData.row_name}"`);
}

// AvtoCheck sətiri əlavə et (yoxdursa)
const avtoExists = db.prepare("SELECT id FROM report_rows WHERE row_name='AvtoCheck'").get();
if (!avtoExists) {
  const firstSection = db.prepare('SELECT id FROM report_sections LIMIT 1').get();
  if (firstSection) {
    const { randomUUID } = require('crypto');
    const rows = db.prepare('SELECT COUNT(*) as cnt FROM report_rows WHERE section_id=?').get(firstSection.id);
    db.prepare('INSERT INTO report_rows (id, section_id, row_name, match_patterns, exclude_patterns, position) VALUES (?,?,?,?,?,?)')
      .run(randomUUID(), firstSection.id, 'AvtoCheck', '["avtocheck","avto check"]', '[]', rows.cnt);
    console.log('Added: AvtoCheck row');
  }
}

console.log(`\nToplam: ${fixed} sətir düzəldildi`);
