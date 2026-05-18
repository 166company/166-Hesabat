require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('./data/ads_audit.db');

// Lux və Pərdə üçün filter: "temizl" hər iki variant-ı tutur (temizlik + təmizlik)
db.prepare("UPDATE report_rows SET account_name_filter=? WHERE row_name=?")
  .run('temizl', 'Lux (Təmizlik)');
db.prepare("UPDATE report_rows SET account_name_filter=? WHERE row_name=?")
  .run('temizl', 'Pərdə (Təmizlik)');

// 166 Ads Group filter-i də hər iki variant üçün "166 ads" ilə sadələşdir
db.prepare("UPDATE report_rows SET account_name_filter=? WHERE row_name=?")
  .run('166 ads', 'Yükdaşıma');
db.prepare("UPDATE report_rows SET account_name_filter=? WHERE row_name=?")
  .run('166 ads', 'Anbar');

const rows = db.prepare("SELECT row_name, account_name_filter, match_patterns FROM report_rows ORDER BY position").all();
console.log('Yenilənmiş konfiqurasiya:');
rows.forEach(r => {
  const filter = r.account_name_filter ? `filter="${r.account_name_filter}"` : 'GLOBAL';
  console.log(`  "${r.row_name}" | ${filter}`);
});
