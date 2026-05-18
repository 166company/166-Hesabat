require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new DatabaseSync(path.resolve('./data/ads_audit.db'));
const [,, email, newPass] = process.argv;
if (!email || !newPass) { console.log('Usage: node reset-password.js <email> <newpassword>'); process.exit(1); }

const user = db.prepare('SELECT id, name FROM users WHERE email = ?').get(email);
if (!user) { console.log('User not found'); process.exit(1); }

const hash = bcrypt.hashSync(newPass, 12);
db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
console.log('Password reset for:', user.name);
