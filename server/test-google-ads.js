require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const { google } = require('googleapis');
const axios = require('axios');
const { createDecipheriv } = require('crypto');

const db = new DatabaseSync('./data/ads_audit.db');
const KEY = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');

function decrypt(text) {
  const [ivHex, encHex] = text.split(':');
  const d = createDecipheriv('aes-256-cbc', KEY, Buffer.from(ivHex,'hex'));
  return Buffer.concat([d.update(Buffer.from(encHex,'hex')), d.final()]).toString();
}

async function main() {
  const auth = db.prepare('SELECT * FROM google_auth LIMIT 1').get();
  if (!auth) { console.log('Google auth yoxdur'); return; }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const refreshToken = decrypt(auth.refresh_token_encrypted);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { token: accessToken } = await oauth2Client.getAccessToken();

  console.log('Access token alındı:', accessToken ? 'OK' : 'XƏTA');
  console.log('Developer Token:', process.env.GOOGLE_ADS_DEVELOPER_TOKEN);

  try {
    const res = await axios.get('https://googleads.googleapis.com/v18/customers:listAccessibleCustomers', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      }
    });
    console.log('\nəlçatılan hesablar:', JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.log('\nAPI XƏTASI:', e.response?.status, JSON.stringify(e.response?.data || e.message, null, 2));
  }
}
main().catch(console.error);
