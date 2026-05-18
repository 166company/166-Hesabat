require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', port: 587, secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

transporter.sendMail({
  from: `"Ads Audit" <${process.env.SMTP_USER}>`,
  to: process.env.ADMIN_EMAIL,
  subject: '[Ads Audit] Email Test — Uğurlu',
  html: '<p style="font-family:Verdana">SMTP konfiqurasiyası düzgün işləyir!</p>',
}).then(() => console.log('✅ Email göndərildi!')).catch(e => console.error('❌ Xəta:', e.message));
