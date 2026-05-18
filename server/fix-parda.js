const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('./data/ads_audit.db');

db.prepare("UPDATE report_rows SET row_name=?, match_patterns=? WHERE row_name=?")
  .run('Pərdə (Təmizlik)', '["pərdə","parda","perde"]', 'Parda (Təmizlik)');

const rows = db.prepare('SELECT row_name, match_patterns FROM report_rows ORDER BY position').all();
rows.forEach(r => console.log(r.row_name, '-', r.match_patterns));
