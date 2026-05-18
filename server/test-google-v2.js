require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const { google } = require('googleapis');
const axios = require('axios');
const { createDecipheriv } = require('crypto');

const db = new DatabaseSync('./data/ads_audit.db');
const KEY = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
function decrypt(t) { const [a,b]=t.split(':'); const d=createDecipheriv('aes-256-cbc',KEY,Buffer.from(a,'hex')); return Buffer.concat([d.update(Buffer.from(b,'hex')),d.final()]).toString(); }

async function main() {
  const auth = db.prepare('SELECT * FROM google_auth LIMIT 1').get();
  const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
  oauth2Client.setCredentials({ refresh_token: decrypt(auth.refresh_token_encrypted) });
  const { token: accessToken } = await oauth2Client.getAccessToken();

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    'Content-Type': 'application/json',
  };

  // Fərqli versiyaları sına
  for (const v of ['v14','v15','v16','v17','v18','v19','v20']) {
    try {
      const r = await axios.get(`https://googleads.googleapis.com/${v}/customers:listAccessibleCustomers`, { headers, timeout: 8000 });
      console.log(`✅ ${v}: Uğurlu!`, JSON.stringify(r.data).substring(0,200));
      return;
    } catch(e) {
      const status = e.response?.status;
      const msg = e.response?.data?.error?.message || e.response?.data?.toString()?.substring(0,100) || e.message;
      console.log(`❌ ${v}: ${status} — ${msg}`);
    }
  }
}
main().catch(console.error);
