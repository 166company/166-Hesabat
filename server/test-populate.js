require('dotenv').config();
const axios = require('axios');
const { DatabaseSync } = require('node:sqlite');
const jwt = require('jsonwebtoken');

const db = new DatabaseSync('./data/ads_audit.db');
const JWT_SECRET = process.env.JWT_SECRET || 'changeme_secret_32chars_minimum!!';

// Real user üçün token yarat
const user = db.prepare("SELECT id, email FROM users WHERE email='settarzadecavidan@gmail.com'").get();
if (!user) { console.log('User tapilmadi'); process.exit(1); }

const token = jwt.sign({ id: user.id, email: user.email, role: 'user' }, JWT_SECRET, { expiresIn: '1h' });

const today = new Date().toISOString().slice(0, 10);
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

console.log(`Auto-populate test: ${monthStart} → ${today}`);
console.log('Token yaradıldı, endpoint çağırılır...\n');

axios.post('http://localhost:5000/api/report-table/auto-populate',
  { startDate: monthStart, endDate: today, forceAll: true },
  { headers: { Authorization: `Bearer ${token}` }, timeout: 300000 }
).then(r => {
  console.log('Nəticə:', r.data.message || r.data);
  console.log('Populated:', r.data.populated);
  if (r.data.unmatched?.length) console.log('Unmatched:', r.data.unmatched);
}).catch(e => {
  console.error('XƏTA:', e.response?.data || e.message);
});
