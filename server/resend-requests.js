require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const nodemailer = require('nodemailer');
const db = new DatabaseSync('./data/ads_audit.db');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const SERVER_URL = `http://localhost:${process.env.PORT || 5000}`;

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', port: 587, secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

async function main() {
  // Gözləyən sorğuları tap - hər user üçün bir cüt (approve + deny)
  const pending = db.prepare(`
    SELECT DISTINCT user_id, user_email, user_name, type
    FROM access_requests
    WHERE status = 'pending'
    GROUP BY user_id, type
  `).all();

  if (!pending.length) { console.log('Gözləyən sorğu yoxdur.'); return; }

  for (const req of pending) {
    const tokens = db.prepare(`
      SELECT token FROM access_requests
      WHERE user_id=? AND type=? AND status='pending'
      ORDER BY created_at
    `).all(req.user_id, req.type);

    if (tokens.length < 2) continue;
    const [approveToken, denyToken] = [tokens[0].token, tokens[1].token];
    const approveUrl = `${SERVER_URL}/api/admin/resolve?token=${approveToken}&action=approve`;
    const denyUrl = `${SERVER_URL}/api/admin/resolve?token=${denyToken}&action=deny`;
    const typeLabel = req.type === 'account' ? 'Hesab Girişi' : 'Chat Girişi';

    await transporter.sendMail({
      from: `"Ads Audit System" <${process.env.SMTP_USER}>`,
      to: ADMIN_EMAIL,
      subject: `[Ads Audit] Yeni ${typeLabel} Sorğusu - ${req.user_name}`,
      html: `
        <div style="font-family:Verdana,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9;">
          <h2 style="color:#333;border-bottom:2px solid #4285F4;padding-bottom:10px;">Yeni ${typeLabel} Sorğusu</h2>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <tr><td style="padding:8px;font-weight:bold;color:#555;">Ad:</td><td style="padding:8px;">${req.user_name}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;color:#555;">Email:</td><td style="padding:8px;">${req.user_email}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;color:#555;">Sorğu növü:</td><td style="padding:8px;">${typeLabel}</td></tr>
          </table>
          <div style="margin:30px 0;text-align:center;">
            <a href="${approveUrl}" style="background:#34A853;color:white;padding:12px 30px;text-decoration:none;border-radius:5px;margin:0 10px;font-family:Verdana;">Təsdiqlə</a>
            <a href="${denyUrl}" style="background:#EA4335;color:white;padding:12px 30px;text-decoration:none;border-radius:5px;margin:0 10px;font-family:Verdana;">Rədd et</a>
          </div>
        </div>
      `,
    });
    console.log(`✅ Email göndərildi: ${req.user_name} (${req.type})`);
  }
}

main().catch(e => console.error('Xəta:', e.message));
