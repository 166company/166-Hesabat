require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('./data/ads_audit.db');

// 1. Bütün avtomatik xanaları sil (is_manual=0)
const deleted = db.prepare("DELETE FROM report_cells WHERE is_manual=0").run();
console.log(`Silindi: ${deleted.changes} avtomatik xana`);

// 2. Təmizlik ROW-unun account_name_filter-ini sıfırla
// Çünki Təmizlik ad hesabından heç nə Təmizlik sətrinə getməməlidir
db.prepare("UPDATE report_rows SET account_name_filter='' WHERE row_name='Təmizlik'").run();
console.log('Təmizlik row-unun account filter sıfırlandı');

// 3. Yükdaşıma patterns-i genişləndir
db.prepare(`UPDATE report_rows SET
  match_patterns='["yükdaşıma","yukdashima","yukdasıma","yükdaşima","yükdashima","dasıma","daşıma","yukd","cargo","carriage"]',
  account_name_filter='166 ads group'
  WHERE row_name='Yükdaşıma'`).run();
console.log('Yükdaşıma patterns genişləndirildi');

// 4. Lux - Pərdə account filter-ləri yoxla
const rows = db.prepare("SELECT row_name, account_name_filter, match_patterns FROM report_rows ORDER BY position").all();
console.log('\nCari konfiqurasiya:');
rows.forEach(r => {
  console.log(`  "${r.row_name}" | filter="${r.account_name_filter}" | patterns=${r.match_patterns}`);
});

console.log('\nHazır. Server restart edin.');
