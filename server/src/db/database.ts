import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initDatabase(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'pending',
      chat_access TEXT NOT NULL DEFAULT 'none',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      approved_at TIMESTAMPTZ,
      approved_by TEXT
    );

    CREATE TABLE IF NOT EXISTS access_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      user_name TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      token TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMPTZ,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS meta_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      business_suite_id TEXT NOT NULL,
      business_suite_name TEXT NOT NULL,
      access_token_encrypted TEXT NOT NULL,
      is_valid INTEGER NOT NULL DEFAULT 1,
      last_validated TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, business_suite_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS google_auth (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      refresh_token_encrypted TEXT,
      access_token_encrypted TEXT,
      token_expiry TIMESTAMPTZ,
      google_email TEXT,
      verification_code TEXT,
      verification_expires TIMESTAMPTZ,
      is_verified INTEGER DEFAULT 0,
      customer_ids TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS error_logs (
      id TEXT PRIMARY KEY,
      error_type TEXT NOT NULL,
      error_message TEXT NOT NULL,
      error_stack TEXT,
      user_id TEXT,
      route TEXT,
      notified INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS report_sections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      section_name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      columns_json TEXT NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS report_rows (
      id TEXT PRIMARY KEY,
      section_id TEXT NOT NULL,
      row_name TEXT NOT NULL,
      match_patterns TEXT NOT NULL DEFAULT '[]',
      exclude_patterns TEXT NOT NULL DEFAULT '[]',
      position INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (section_id) REFERENCES report_sections(id)
    );

    CREATE TABLE IF NOT EXISTS tiktok_auth (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      access_token_encrypted TEXT NOT NULL,
      advertiser_ids TEXT NOT NULL DEFAULT '[]',
      tiktok_email TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS report_cells (
      id TEXT PRIMARY KEY,
      section_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      col_key TEXT NOT NULL,
      value REAL NOT NULL DEFAULT 0,
      is_manual INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(section_id, row_id, col_key),
      FOREIGN KEY (section_id) REFERENCES report_sections(id)
    );
  `);

  // Migration: add exclude_patterns if column doesn't exist yet
  try {
    await pool.query(`ALTER TABLE report_rows ADD COLUMN exclude_patterns TEXT NOT NULL DEFAULT '[]'`);
  } catch { }

  console.log('[DB] Database initialized');
}

export default pool;

// --- User queries ---
export const userQueries = {
  findById: (id: string) =>
    pool.query('SELECT * FROM users WHERE id = $1', [id]).then(r => r.rows[0] ?? null),
  findByEmail: (email: string) =>
    pool.query('SELECT * FROM users WHERE email = $1', [email]).then(r => r.rows[0] ?? null),
  create: (p: { id: string; email: string; password_hash: string; name: string; role: string; status: string; chat_access?: string }) =>
    pool.query(
      `INSERT INTO users (id, email, password_hash, name, role, status, chat_access)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [p.id, p.email, p.password_hash, p.name, p.role, p.status, p.chat_access ?? 'none']
    ),
  updateStatus: (p: { status: string; approved_at: string; approved_by: string; id: string }) =>
    pool.query(
      `UPDATE users SET status = $1, approved_at = $2, approved_by = $3 WHERE id = $4`,
      [p.status, p.approved_at, p.approved_by, p.id]
    ),
  updateChatAccess: (chat_access: string, id: string) =>
    pool.query('UPDATE users SET chat_access = $1 WHERE id = $2', [chat_access, id]),
  getAll: () =>
    pool.query('SELECT id, email, name, role, status, chat_access, created_at FROM users ORDER BY created_at DESC').then(r => r.rows),
};

// --- Access request queries ---
export const accessRequestQueries = {
  create: (p: { id: string; user_id: string; user_email: string; user_name: string; type: string; token: string }) =>
    pool.query(
      `INSERT INTO access_requests (id, user_id, user_email, user_name, type, token)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [p.id, p.user_id, p.user_email, p.user_name, p.type, p.token]
    ),
  findByToken: (token: string) =>
    pool.query('SELECT * FROM access_requests WHERE token = $1', [token]).then(r => r.rows[0] ?? null),
  findPendingByUser: (user_id: string, type: string, status: string) =>
    pool.query('SELECT * FROM access_requests WHERE user_id = $1 AND type = $2 AND status = $3', [user_id, type, status]).then(r => r.rows),
  resolve: (p: { status: string; token: string }) =>
    pool.query(
      `UPDATE access_requests SET status = $1, resolved_at = CURRENT_TIMESTAMP WHERE token = $2`,
      [p.status, p.token]
    ),
};

// --- Meta token queries ---
export const metaTokenQueries = {
  findAll: () =>
    pool.query('SELECT * FROM meta_tokens WHERE is_valid = 1').then(r => r.rows),
  upsert: (p: { id: string; user_id: string; business_suite_id: string; business_suite_name: string; access_token_encrypted: string }) =>
    pool.query(
      `INSERT INTO meta_tokens (id, user_id, business_suite_id, business_suite_name, access_token_encrypted, is_valid, last_validated, updated_at)
       VALUES ($1, $2, $3, $4, $5, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id, business_suite_id) DO UPDATE SET
         business_suite_name = EXCLUDED.business_suite_name,
         access_token_encrypted = EXCLUDED.access_token_encrypted,
         is_valid = 1,
         last_validated = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`,
      [p.id, p.user_id, p.business_suite_id, p.business_suite_name, p.access_token_encrypted]
    ),
  findByUser: (user_id: string) =>
    pool.query('SELECT * FROM meta_tokens WHERE user_id = $1 AND is_valid = 1', [user_id]).then(r => r.rows),
  findById: (id: string, user_id: string) =>
    pool.query('SELECT * FROM meta_tokens WHERE id = $1 AND user_id = $2', [id, user_id]).then(r => r.rows[0] ?? null),
  invalidate: (id: string, user_id: string) =>
    pool.query('UPDATE meta_tokens SET is_valid = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2', [id, user_id]),
  delete: (id: string, user_id: string) =>
    pool.query('DELETE FROM meta_tokens WHERE id = $1 AND user_id = $2', [id, user_id]),
  markInvalid: (user_id: string, business_suite_id: string) =>
    pool.query('UPDATE meta_tokens SET is_valid = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND business_suite_id = $2', [user_id, business_suite_id]),
  updateSuiteId: (business_suite_id: string, id: string) =>
    pool.query('UPDATE meta_tokens SET business_suite_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [business_suite_id, id]),
};

// --- Google auth queries ---
export const googleAuthQueries = {
  findByUser: (user_id: string) =>
    pool.query('SELECT * FROM google_auth WHERE user_id = $1', [user_id]).then(r => r.rows[0] ?? null),
  findFirst: () =>
    pool.query('SELECT * FROM google_auth WHERE is_verified = 1 LIMIT 1').then(r => r.rows[0] ?? null),
  upsert: (p: { id: string; user_id: string; refresh_token_encrypted: string; access_token_encrypted: string; token_expiry: string; google_email: string; is_verified: number; customer_ids: string }) =>
    pool.query(
      `INSERT INTO google_auth (id, user_id, refresh_token_encrypted, access_token_encrypted, token_expiry, google_email, is_verified, customer_ids, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
         access_token_encrypted = EXCLUDED.access_token_encrypted,
         token_expiry = EXCLUDED.token_expiry,
         google_email = EXCLUDED.google_email,
         is_verified = EXCLUDED.is_verified,
         customer_ids = EXCLUDED.customer_ids,
         updated_at = CURRENT_TIMESTAMP`,
      [p.id, p.user_id, p.refresh_token_encrypted, p.access_token_encrypted, p.token_expiry, p.google_email, p.is_verified, p.customer_ids]
    ),
  setVerificationCode: (p: { code: string; expires: string; user_id: string }) =>
    pool.query(
      `UPDATE google_auth SET verification_code = $1, verification_expires = $2 WHERE user_id = $3`,
      [p.code, p.expires, p.user_id]
    ),
  verify: (user_id: string) =>
    pool.query('UPDATE google_auth SET is_verified = 1, verification_code = NULL WHERE user_id = $1', [user_id]),
  delete: (user_id: string) =>
    pool.query('DELETE FROM google_auth WHERE user_id = $1', [user_id]),
};

// --- Chat queries ---
export const chatQueries = {
  create: (p: { id: string; user_id: string; user_name: string; message: string }) =>
    pool.query(
      `INSERT INTO chat_messages (id, user_id, user_name, message) VALUES ($1, $2, $3, $4)`,
      [p.id, p.user_id, p.user_name, p.message]
    ),
  getRecent: () =>
    pool.query('SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 100').then(r => r.rows),
};

// --- Report table queries ---
export const reportQueries = {
  getSections: (user_id: string) =>
    pool.query('SELECT * FROM report_sections WHERE user_id = $1 ORDER BY position', [user_id]).then(r => r.rows),
  getSection: (id: string, user_id: string) =>
    pool.query('SELECT * FROM report_sections WHERE id = $1 AND user_id = $2', [id, user_id]).then(r => r.rows[0] ?? null),
  createSection: (p: { id: string; user_id: string; section_name: string; position: number; columns_json: string }) =>
    pool.query(
      `INSERT INTO report_sections (id, user_id, section_name, position, columns_json)
       VALUES ($1, $2, $3, $4, $5)`,
      [p.id, p.user_id, p.section_name, p.position, p.columns_json]
    ),
  updateSection: (section_name: string, columns_json: string, id: string, user_id: string) =>
    pool.query(
      `UPDATE report_sections SET section_name=$1, columns_json=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$3 AND user_id=$4`,
      [section_name, columns_json, id, user_id]
    ),
  deleteSection: (id: string, user_id: string) =>
    pool.query('DELETE FROM report_sections WHERE id=$1 AND user_id=$2', [id, user_id]),

  getRows: (section_id: string) =>
    pool.query('SELECT * FROM report_rows WHERE section_id = $1 ORDER BY position', [section_id]).then(r => r.rows),
  createRow: (p: { id: string; section_id: string; row_name: string; match_patterns: string; exclude_patterns: string; position: number }) =>
    pool.query(
      `INSERT INTO report_rows (id, section_id, row_name, match_patterns, exclude_patterns, position)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [p.id, p.section_id, p.row_name, p.match_patterns, p.exclude_patterns, p.position]
    ),
  updateRow: (row_name: string, match_patterns: string, exclude_patterns: string, position: number, id: string) =>
    pool.query(
      `UPDATE report_rows SET row_name=$1, match_patterns=$2, exclude_patterns=$3, position=$4 WHERE id=$5`,
      [row_name, match_patterns, exclude_patterns, position, id]
    ),
  deleteRow: (id: string) =>
    pool.query('DELETE FROM report_rows WHERE id=$1', [id]),
  deleteRowsBySectionId: (section_id: string) =>
    pool.query('DELETE FROM report_rows WHERE section_id=$1', [section_id]),

  getCells: (section_id: string) =>
    pool.query('SELECT * FROM report_cells WHERE section_id=$1', [section_id]).then(r => r.rows),
  upsertCell: (p: { id: string; section_id: string; row_id: string; col_key: string; value: number; is_manual: number }) =>
    pool.query(
      `INSERT INTO report_cells (id, section_id, row_id, col_key, value, is_manual, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT(section_id, row_id, col_key) DO UPDATE SET
         value = EXCLUDED.value,
         is_manual = EXCLUDED.is_manual,
         updated_at = CURRENT_TIMESTAMP`,
      [p.id, p.section_id, p.row_id, p.col_key, p.value, p.is_manual]
    ),
  clearAutoCells: (section_id: string) =>
    pool.query('DELETE FROM report_cells WHERE section_id=$1 AND is_manual=0', [section_id]),
};

// --- TikTok auth queries ---
export const tiktokAuthQueries = {
  findByUser: (user_id: string) =>
    pool.query('SELECT * FROM tiktok_auth WHERE user_id = $1', [user_id]).then(r => r.rows[0] ?? null),
  upsert: (p: { id: string; user_id: string; access_token_encrypted: string; advertiser_ids: string; tiktok_email: string }) =>
    pool.query(
      `INSERT INTO tiktok_auth (id, user_id, access_token_encrypted, advertiser_ids, tiktok_email, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         access_token_encrypted = EXCLUDED.access_token_encrypted,
         advertiser_ids = EXCLUDED.advertiser_ids,
         tiktok_email = EXCLUDED.tiktok_email,
         updated_at = CURRENT_TIMESTAMP`,
      [p.id, p.user_id, p.access_token_encrypted, p.advertiser_ids, p.tiktok_email]
    ),
  delete: (user_id: string) =>
    pool.query('DELETE FROM tiktok_auth WHERE user_id = $1', [user_id]),
  updateAdvertiserIds: (advertiser_ids: string, user_id: string) =>
    pool.query('UPDATE tiktok_auth SET advertiser_ids = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2', [advertiser_ids, user_id]),
  findFirst: () =>
    pool.query('SELECT * FROM tiktok_auth LIMIT 1').then(r => r.rows[0] ?? null),
};

// --- Error log queries ---
export const errorLogQueries = {
  create: (p: { id: string; error_type: string; error_message: string; error_stack?: string | null; user_id?: string | null; route?: string | null }) =>
    pool.query(
      `INSERT INTO error_logs (id, error_type, error_message, error_stack, user_id, route)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [p.id, p.error_type, p.error_message, p.error_stack ?? null, p.user_id ?? null, p.route ?? null]
    ),
  markNotified: (id: string) =>
    pool.query('UPDATE error_logs SET notified = 1 WHERE id = $1', [id]),
};
