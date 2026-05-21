// SQLite → Neon PostgreSQL data migration script
require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const { Pool } = require('pg');
const path = require('path');

const SQLITE_PATH = process.env.SQLITE_PATH || './data/ads_audit.db';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  console.log('[Migration] SQLite → Neon PostgreSQL başlayır...');

  let sqlite;
  try {
    sqlite = new DatabaseSync(path.resolve(SQLITE_PATH));
  } catch (e) {
    console.error('[Migration] SQLite fayl tapılmadı:', SQLITE_PATH);
    process.exit(1);
  }

  // FK sırasına görə cədvəlləri təmizlə (uşaqlar əvvəl)
  const deleteOrder = ['report_cells','report_rows','report_sections','chat_messages','tiktok_auth','google_auth','meta_tokens','access_requests','error_logs','users'];
  for (const t of deleteOrder) await pool.query(`DELETE FROM ${t}`);

  const tables = [
    { name: 'users', cols: 'id, email, password_hash, name, role, status, chat_access, created_at, approved_at, approved_by' },
    { name: 'access_requests', cols: 'id, user_id, user_email, user_name, type, status, token, created_at, resolved_at' },
    { name: 'meta_tokens', cols: 'id, user_id, business_suite_id, business_suite_name, access_token_encrypted, is_valid, last_validated, created_at, updated_at' },
    { name: 'google_auth', cols: 'id, user_id, refresh_token_encrypted, access_token_encrypted, token_expiry, google_email, verification_code, verification_expires, is_verified, customer_ids, created_at, updated_at' },
    { name: 'chat_messages', cols: 'id, user_id, user_name, message, created_at' },
    { name: 'report_sections', cols: 'id, user_id, section_name, position, columns_json, created_at, updated_at' },
    { name: 'report_rows', cols: 'id, section_id, row_name, match_patterns, exclude_patterns, position' },
    { name: 'report_cells', cols: 'id, section_id, row_id, col_key, value, is_manual, updated_at' },
    { name: 'tiktok_auth', cols: 'id, user_id, access_token_encrypted, advertiser_ids, tiktok_email, created_at, updated_at' },
    { name: 'error_logs', cols: 'id, error_type, error_message, error_stack, user_id, route, notified, created_at' },
  ];

  for (const { name, cols } of tables) {
    try {
      const rows = sqlite.prepare(`SELECT ${cols} FROM ${name}`).all();
      if (!rows.length) { console.log(`[Migration] ${name}: boş, keçilir`); continue; }

      const colList = cols.split(', ');
      const placeholders = rows[0] ? colList.map((_, i) => `$${i + 1}`).join(', ') : '';

      let inserted = 0;
      for (const row of rows) {
        try {
          const values = colList.map(c => {
            const v = row[c];
            if (v === null || v === undefined) return null;
            return v;
          });
          await pool.query(
            `INSERT INTO ${name} (${cols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            values
          );
          inserted++;
        } catch (e) {
          console.warn(`[Migration] ${name} row xəta:`, e.message);
        }
      }
      console.log(`[Migration] ${name}: ${inserted}/${rows.length} sətir köçürüldü`);
    } catch (e) {
      console.error(`[Migration] ${name} xəta:`, e.message);
    }
  }

  console.log('[Migration] Tamamlandı!');
  await pool.end();
  sqlite.close();
}

migrate().catch(e => { console.error(e); process.exit(1); });
