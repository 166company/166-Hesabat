require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('./data/ads_audit.db');
const email = process.argv[2] || 'settarzadecavidan@gmail.com';

const user = db.prepare('SELECT id, name, chat_access FROM users WHERE email=?').get(email);
if (!user) { console.log('User tapılmadı'); process.exit(1); }

db.prepare("UPDATE users SET chat_access='approved' WHERE id=?").run(user.id);
db.prepare("UPDATE access_requests SET status='approved', resolved_at=CURRENT_TIMESTAMP WHERE user_id=? AND type='chat' AND status='pending'").run(user.id);

const updated = db.prepare('SELECT email, status, chat_access FROM users WHERE id=?').get(user.id);
console.log('✅ Chat təsdiqləndi:', JSON.stringify(updated));
