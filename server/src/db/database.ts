import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || './data/ads_audit.db';
const dbDir = path.dirname(path.resolve(DB_PATH));
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(path.resolve(DB_PATH));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Create tables immediately so prepared statements below can reference them
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'pending',
    chat_access TEXT NOT NULL DEFAULT 'none',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS meta_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    business_suite_id TEXT NOT NULL,
    business_suite_name TEXT NOT NULL,
    access_token_encrypted TEXT NOT NULL,
    is_valid INTEGER NOT NULL DEFAULT 1,
    last_validated DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, business_suite_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS google_auth (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    refresh_token_encrypted TEXT,
    access_token_encrypted TEXT,
    token_expiry DATETIME,
    google_email TEXT,
    verification_code TEXT,
    verification_expires DATETIME,
    is_verified INTEGER DEFAULT 0,
    customer_ids TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS report_sections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    section_name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    columns_json TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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

  CREATE TABLE IF NOT EXISTS report_cells (
    id TEXT PRIMARY KEY,
    section_id TEXT NOT NULL,
    row_id TEXT NOT NULL,
    col_key TEXT NOT NULL,
    value REAL NOT NULL DEFAULT 0,
    is_manual INTEGER NOT NULL DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(section_id, row_id, col_key),
    FOREIGN KEY (section_id) REFERENCES report_sections(id)
  );
`);

export function initDatabase(): void {
  // Migration: add exclude_patterns if column doesn't exist yet
  try { db.exec('ALTER TABLE report_rows ADD COLUMN exclude_patterns TEXT NOT NULL DEFAULT "[]"'); } catch { }
  console.log('[DB] Database initialized');
}

export default db;

// --- User queries ---
export const userQueries = {
  findById: db.prepare('SELECT * FROM users WHERE id = ?'),
  findByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  create: db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, status)
    VALUES (:id, :email, :password_hash, :name, :role, :status)
  `),
  updateStatus: db.prepare(`
    UPDATE users SET status = :status, approved_at = :approved_at, approved_by = :approved_by
    WHERE id = :id
  `),
  updateChatAccess: db.prepare('UPDATE users SET chat_access = ? WHERE id = ?'),
  getAll: db.prepare('SELECT id, email, name, role, status, chat_access, created_at FROM users ORDER BY created_at DESC'),
};

// --- Access request queries ---
export const accessRequestQueries = {
  create: db.prepare(`
    INSERT INTO access_requests (id, user_id, user_email, user_name, type, token)
    VALUES (:id, :user_id, :user_email, :user_name, :type, :token)
  `),
  findByToken: db.prepare('SELECT * FROM access_requests WHERE token = ?'),
  findPendingByUser: db.prepare('SELECT * FROM access_requests WHERE user_id = ? AND type = ? AND status = ?'),
  resolve: db.prepare(`
    UPDATE access_requests SET status = :status, resolved_at = CURRENT_TIMESTAMP WHERE token = :token
  `),
};

// --- Meta token queries ---
export const metaTokenQueries = {
  upsert: db.prepare(`
    INSERT INTO meta_tokens (id, user_id, business_suite_id, business_suite_name, access_token_encrypted, is_valid, last_validated, updated_at)
    VALUES (:id, :user_id, :business_suite_id, :business_suite_name, :access_token_encrypted, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, business_suite_id) DO UPDATE SET
      business_suite_name = :business_suite_name,
      access_token_encrypted = :access_token_encrypted,
      is_valid = 1,
      last_validated = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  `),
  findByUser: db.prepare('SELECT * FROM meta_tokens WHERE user_id = ? AND is_valid = 1'),
  findById: db.prepare('SELECT * FROM meta_tokens WHERE id = ? AND user_id = ?'),
  invalidate: db.prepare('UPDATE meta_tokens SET is_valid = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?'),
  delete: db.prepare('DELETE FROM meta_tokens WHERE id = ? AND user_id = ?'),
  markInvalid: db.prepare('UPDATE meta_tokens SET is_valid = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND business_suite_id = ?'),
  updateSuiteId: db.prepare('UPDATE meta_tokens SET business_suite_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
};

// --- Google auth queries ---
export const googleAuthQueries = {
  findByUser: db.prepare('SELECT * FROM google_auth WHERE user_id = ?'),
  upsert: db.prepare(`
    INSERT INTO google_auth (id, user_id, refresh_token_encrypted, access_token_encrypted, token_expiry, google_email, is_verified, customer_ids, updated_at)
    VALUES (:id, :user_id, :refresh_token_encrypted, :access_token_encrypted, :token_expiry, :google_email, :is_verified, :customer_ids, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      refresh_token_encrypted = :refresh_token_encrypted,
      access_token_encrypted = :access_token_encrypted,
      token_expiry = :token_expiry,
      google_email = :google_email,
      is_verified = :is_verified,
      customer_ids = :customer_ids,
      updated_at = CURRENT_TIMESTAMP
  `),
  setVerificationCode: db.prepare(`
    UPDATE google_auth SET verification_code = :code, verification_expires = :expires WHERE user_id = :user_id
  `),
  verify: db.prepare('UPDATE google_auth SET is_verified = 1, verification_code = NULL WHERE user_id = ?'),
  delete: db.prepare('DELETE FROM google_auth WHERE user_id = ?'),
};

// --- Chat queries ---
export const chatQueries = {
  create: db.prepare(`
    INSERT INTO chat_messages (id, user_id, user_name, message) VALUES (:id, :user_id, :user_name, :message)
  `),
  getRecent: db.prepare('SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 100'),
};

// --- Report table queries ---
export const reportQueries = {
  getSections: db.prepare('SELECT * FROM report_sections WHERE user_id = ? ORDER BY position'),
  getSection: db.prepare('SELECT * FROM report_sections WHERE id = ? AND user_id = ?'),
  createSection: db.prepare(`
    INSERT INTO report_sections (id, user_id, section_name, position, columns_json)
    VALUES (:id, :user_id, :section_name, :position, :columns_json)
  `),
  updateSection: db.prepare('UPDATE report_sections SET section_name=?, columns_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?'),
  deleteSection: db.prepare('DELETE FROM report_sections WHERE id=? AND user_id=?'),

  getRows: db.prepare('SELECT * FROM report_rows WHERE section_id = ? ORDER BY position'),
  createRow: db.prepare('INSERT INTO report_rows (id, section_id, row_name, match_patterns, exclude_patterns, position) VALUES (:id, :section_id, :row_name, :match_patterns, :exclude_patterns, :position)'),
  updateRow: db.prepare('UPDATE report_rows SET row_name=?, match_patterns=?, exclude_patterns=?, position=? WHERE id=?'),
  deleteRow: db.prepare('DELETE FROM report_rows WHERE id=?'),
  deleteRowsBySectionId: db.prepare('DELETE FROM report_rows WHERE section_id=?'),

  getCells: db.prepare('SELECT * FROM report_cells WHERE section_id=?'),
  upsertCell: db.prepare(`
    INSERT INTO report_cells (id, section_id, row_id, col_key, value, is_manual, updated_at)
    VALUES (:id, :section_id, :row_id, :col_key, :value, :is_manual, CURRENT_TIMESTAMP)
    ON CONFLICT(section_id, row_id, col_key) DO UPDATE SET value=:value, is_manual=:is_manual, updated_at=CURRENT_TIMESTAMP
  `),
  clearAutoCells: db.prepare('DELETE FROM report_cells WHERE section_id=? AND is_manual=0'),
};

// --- Error log queries ---
export const errorLogQueries = {
  create: db.prepare(`
    INSERT INTO error_logs (id, error_type, error_message, error_stack, user_id, route)
    VALUES (:id, :error_type, :error_message, :error_stack, :user_id, :route)
  `),
  markNotified: db.prepare('UPDATE error_logs SET notified = 1 WHERE id = ?'),
};
