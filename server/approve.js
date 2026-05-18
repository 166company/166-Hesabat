require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.resolve('./data/ads_audit.db'));

const email = process.argv[2];
if (!email) { console.log('Usage: node approve.js <email>'); process.exit(1); }

const user = db.prepare('SELECT id, name, status FROM users WHERE email = ?').get(email);
if (!user) { console.log('User not found:', email); process.exit(1); }

console.log('User:', user.name, '| Status:', user.status);

if (user.status === 'approved') {
  console.log('Already approved!');
  process.exit(0);
}

db.prepare("UPDATE users SET status='approved', approved_at=CURRENT_TIMESTAMP, approved_by='admin' WHERE id=?").run(user.id);
db.prepare("UPDATE access_requests SET status='approved', resolved_at=CURRENT_TIMESTAMP WHERE user_id=? AND type='account'").run(user.id);

console.log('SUCCESS: Account approved for', user.name);
