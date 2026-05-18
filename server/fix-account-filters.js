require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('./data/ads_audit.db');

// Migration: account_name_filter sütununu əlavə et
try {
  db.exec("ALTER TABLE report_rows ADD COLUMN account_name_filter TEXT NOT NULL DEFAULT ''");
  console.log('Added account_name_filter column');
} catch { console.log('Column already exists'); }

// Hər sətir üçün: account_name_filter (boş = bütün hesablardan yoxla, dolu = yalnız o hesabdan)
// patterns boşdursa → bütün o hesabın xərci bu sətirə gedir
// patterns dolurdursa → o hesabın içindəki kampaniyaları ada görə filtrləyir
const ROW_CONFIG = [
  // Əsas Xidmətlər — hər servis öz adı ilə hesabı var
  { name: 'Usta',                 account_filter: 'usta',        patterns: '[]',                                          excludes: '[]' },
  { name: 'Yükdaşıma',           account_filter: '166 ads group',patterns: '["yükdaşıma","yukdashima","yukdasima","yükdaşıma"]', excludes: '[]' },
  { name: 'Transport',            account_filter: 'transport',    patterns: '[]',                                          excludes: '[]' },
  { name: 'Xalça',               account_filter: 'xalça',        patterns: '[]',                                          excludes: '[]' },
  { name: 'Evakuasiya',           account_filter: 'evakuasiya',   patterns: '[]',                                          excludes: '[]' },
  // Təmizlik hesabında: Lux və Pərdə ayrı kampaniyalar, qalan hamısı Təmizlik
  { name: 'Təmizlik',             account_filter: 'təmizlik',     patterns: '["temizlik","təmizlik","tamizlik","cleaning"]', excludes: '["lux","pərdə","parda","perde"]' },
  { name: 'Bağban & Sanitariya',  account_filter: 'bağban',       patterns: '[]',                                          excludes: '[]' },
  { name: 'Tech',                 account_filter: 'tech',         patterns: '[]',                                          excludes: '[]' },
  { name: 'Anbar',               account_filter: '166 ads group', patterns: '["anbar"]',                                  excludes: '[]' },
  { name: 'Fəhlə',               account_filter: 'fəhlə',         patterns: '[]',                                          excludes: '[]' },
  { name: 'Yük.az',              account_filter: 'yük.az',        patterns: '[]',                                          excludes: '[]' },
  { name: 'Lux (Təmizlik)',       account_filter: 'təmizlik',     patterns: '["lux"]',                                    excludes: '[]' },
  { name: 'Pərdə (Təmizlik)',     account_filter: 'təmizlik',     patterns: '["pərdə","parda","perde","perdə"]',           excludes: '[]' },
  { name: 'AvtoCheck',            account_filter: 'avtocheck',    patterns: '[]',                                          excludes: '[]' },
  // Life Vakansiyalar — Meta account adı "life" içerən
  { name: 'Sürücü',              account_filter: 'life',          patterns: '["sürücü","surucu"]',                        excludes: '["evakuator"]' },
  { name: 'Evakuator sürücüsü',  account_filter: 'life',          patterns: '["evakuator"]',                              excludes: '[]' },
  { name: 'Bağban',              account_filter: 'life',          patterns: '["bağban","bagban"]',                        excludes: '[]' },
  { name: 'Dezinfaktor',         account_filter: 'life',          patterns: '["dezinfaktor"]',                            excludes: '[]' },
  { name: 'Baca təmizləmə',      account_filter: 'life',          patterns: '["baca"]',                                   excludes: '[]' },
];

const allRows = db.prepare('SELECT id, row_name FROM report_rows').all();
let updated = 0;

for (const row of allRows) {
  const config = ROW_CONFIG.find(c => c.name === row.row_name);
  if (config) {
    db.prepare('UPDATE report_rows SET account_name_filter=?, match_patterns=?, exclude_patterns=? WHERE id=?')
      .run(config.account_filter, config.patterns, config.excludes, row.id);
    console.log(`Updated: "${row.row_name}" → account_filter="${config.account_filter}"`);
    updated++;
  }
}

// AvtoCheck-i Life sectionundan çıxarıb Əsas Xidmətlər-ə köçür (əgər yanlış yerdədirsə)
const sections = db.prepare("SELECT id, section_name FROM report_sections ORDER BY position").all();
console.log('\nSections:', sections.map(s => s.section_name));

const avto = db.prepare("SELECT r.id, r.section_id FROM report_rows r WHERE r.row_name='AvtoCheck'").get();
if (avto) {
  const lifeSection = sections.find(s => s.section_name.toLowerCase().includes('life') || s.section_name.toLowerCase().includes('vakansiya'));
  if (lifeSection && avto.section_id === lifeSection.id) {
    const mainSection = sections.find(s => !s.section_name.toLowerCase().includes('life') && !s.section_name.toLowerCase().includes('vakansiya'));
    if (mainSection) {
      db.prepare('UPDATE report_rows SET section_id=? WHERE id=?').run(mainSection.id, avto.id);
      console.log(`Moved AvtoCheck from Life to ${mainSection.section_name}`);
    }
  }
}

console.log(`\nToplam: ${updated} sətir yeniləndi`);
