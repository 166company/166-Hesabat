import nodemailer from 'nodemailer';

const ADMIN_EMAIL = 'cavidanbusiness2026@gmail.com';

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const BASE_URL = process.env.CLIENT_URL || 'http://localhost:5173';
// Admin linkləri SERVER_URL əvəzinə CLIENT_URL üzərindən gedir ki, Gmail-dən açılsın
const SERVER_URL = process.env.SERVER_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`;

export async function sendAccessRequestToAdmin(params: {
  userId: string;
  userEmail: string;
  userName: string;
  requestId: string;
  approveToken: string;
  denyToken: string;
  type: 'account' | 'chat';
}): Promise<void> {
  const transporter = createTransport();
  const typeLabel = params.type === 'account' ? 'Hesab Girişi' : 'Chat Girişi';
  const approveUrl = `${SERVER_URL}/api/admin/resolve?token=${params.approveToken}&action=approve`;
  const denyUrl = `${SERVER_URL}/api/admin/resolve?token=${params.denyToken}&action=deny`;

  await transporter.sendMail({
    from: `"Ads Audit System" <${process.env.SMTP_USER}>`,
    to: ADMIN_EMAIL,
    subject: `[Ads Audit] Yeni ${typeLabel} Sorğusu - ${params.userName}`,
    html: `
      <div style="font-family: Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
        <h2 style="color: #333; border-bottom: 2px solid #4285F4; padding-bottom: 10px;">Yeni ${typeLabel} Sorğusu</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; font-weight: bold; color: #555;">Ad:</td><td style="padding: 8px;">${params.userName}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; color: #555;">Email:</td><td style="padding: 8px;">${params.userEmail}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; color: #555;">Sorğu növü:</td><td style="padding: 8px;">${typeLabel}</td></tr>
        </table>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${approveUrl}" style="background: #34A853; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 0 10px; font-family: Verdana;">Təsdiqlə</a>
          <a href="${denyUrl}" style="background: #EA4335; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 0 10px; font-family: Verdana;">Rədd et</a>
        </div>
        <p style="color: #888; font-size: 12px; text-align: center;">Ads Audit System tərəfindən göndərilmişdir</p>
      </div>
    `,
  });
}

export async function sendApprovalEmail(userEmail: string, userName: string, type: 'account' | 'chat'): Promise<void> {
  const transporter = createTransport();
  const typeLabel = type === 'account' ? 'hesabınıza giriş' : 'chat';
  await transporter.sendMail({
    from: `"Ads Audit System" <${process.env.SMTP_USER}>`,
    to: userEmail,
    subject: `[Ads Audit] Sorğunuz təsdiqləndi`,
    html: `
      <div style="font-family: Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
        <h2 style="color: #34A853;">Sorğunuz təsdiqləndi!</h2>
        <p>Salam <strong>${userName}</strong>,</p>
        <p>Ads Audit sistemindəki <strong>${typeLabel}</strong> sorğunuz admin tərəfindən təsdiqləndi.</p>
        <a href="${BASE_URL}/login" style="background: #4285F4; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-family: Verdana; display: inline-block; margin-top: 15px;">Sistemə daxil ol</a>
      </div>
    `,
  });
}

export async function sendDenialEmail(userEmail: string, userName: string, type: 'account' | 'chat'): Promise<void> {
  const transporter = createTransport();
  const typeLabel = type === 'account' ? 'hesabınıza giriş' : 'chat';
  await transporter.sendMail({
    from: `"Ads Audit System" <${process.env.SMTP_USER}>`,
    to: userEmail,
    subject: `[Ads Audit] Sorğunuz rədd edildi`,
    html: `
      <div style="font-family: Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
        <h2 style="color: #EA4335;">Sorğunuz rədd edildi</h2>
        <p>Salam <strong>${userName}</strong>,</p>
        <p>Ads Audit sistemindəki <strong>${typeLabel}</strong> sorğunuz admin tərəfindən rədd edildi.</p>
        <p>Ətraflı məlumat üçün adminlə əlaqə saxlayın.</p>
      </div>
    `,
  });
}

export async function sendGoogleVerificationCode(userEmail: string, code: string): Promise<void> {
  const transporter = createTransport();
  await transporter.sendMail({
    from: `"Ads Audit System" <${process.env.SMTP_USER}>`,
    to: userEmail,
    subject: `[Ads Audit] Google Ads Doğrulama Kodu`,
    html: `
      <div style="font-family: Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
        <h2 style="color: #4285F4;">Google Ads Doğrulama</h2>
        <p>Ads Audit sistemindəki Google Ads hesabınızı doğrulamaq üçün aşağıdakı kodu daxil edin:</p>
        <div style="background: #fff; border: 2px solid #4285F4; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 36px; font-weight: bold; color: #4285F4; letter-spacing: 8px;">${code}</span>
        </div>
        <p style="color: #888; font-size: 12px;">Bu kod 15 dəqiqə ərzində etibarlıdır.</p>
      </div>
    `,
  });
}

export async function sendLoginOTP(params: {
  userEmail: string;
  userName: string;
  code: string;
  ip: string;
  time: string;
}): Promise<void> {
  const transporter = createTransport();
  await transporter.sendMail({
    from: `"Ads Audit System" <${process.env.SMTP_USER}>`,
    to: params.userEmail,
    subject: `[Ads Audit] Giriş Doğrulama Kodu — ${params.code}`,
    html: `
      <div style="font-family: Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
        <h2 style="color: #1d4ed8; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">🔐 Giriş Doğrulama</h2>
        <p>Salam <strong>${params.userName}</strong>,</p>
        <p>Ads Audit sisteminə giriş cəhdi aşkar edildi. Aşağıdakı kodu daxil edin:</p>

        <div style="background: #fff; border: 2px solid #3b82f6; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="font-size: 42px; font-weight: 800; color: #1d4ed8; letter-spacing: 10px;">${params.code}</span>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
          <tr style="background: #f1f5f9;">
            <td style="padding: 8px 12px; font-weight: bold; color: #555; width: 40%;">📍 IP ünvan:</td>
            <td style="padding: 8px 12px;">${params.ip}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #555;">🕐 Vaxt:</td>
            <td style="padding: 8px 12px;">${params.time}</td>
          </tr>
        </table>

        <p style="color: #dc2626; font-size: 13px; font-weight: 600;">⚠️ Bu giriş cəhdi siz deyilsinizsə, şifrənizi dərhal dəyişin.</p>
        <p style="color: #94a3b8; font-size: 11px;">Bu kod <strong>5 dəqiqə</strong> ərzində etibarlıdır. Heç kimlə paylaşmayın.</p>
      </div>
    `,
  });
}

export async function sendLoginAlert(params: {
  userEmail: string;
  userName: string;
  ip: string;
  time: string;
}): Promise<void> {
  const transporter = createTransport();
  await transporter.sendMail({
    from: `"Ads Audit System" <${process.env.SMTP_USER}>`,
    to: ADMIN_EMAIL,
    subject: `[Ads Audit] ✅ Uğurlu Giriş — ${params.userEmail}`,
    html: `
      <div style="font-family: Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
        <h2 style="color: #16a34a; border-bottom: 2px solid #22c55e; padding-bottom: 10px;">✅ Sisteme Uğurlu Giriş</h2>
        <p>Aşağıdakı istifadəçi sistemə uğurla daxil oldu:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #f0fdf4;">
            <td style="padding: 10px 14px; font-weight: bold; color: #555; width: 40%;">👤 İstifadəçi adı:</td>
            <td style="padding: 10px 14px;">${params.userName}</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; font-weight: bold; color: #555;">📧 Email:</td>
            <td style="padding: 10px 14px;">${params.userEmail}</td>
          </tr>
          <tr style="background: #f0fdf4;">
            <td style="padding: 10px 14px; font-weight: bold; color: #555;">📍 IP ünvan:</td>
            <td style="padding: 10px 14px;">${params.ip}</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; font-weight: bold; color: #555;">🕐 Giriş vaxtı:</td>
            <td style="padding: 10px 14px;">${params.time}</td>
          </tr>
        </table>
        <p style="color: #888; font-size: 12px;">Bu bildiriş avtomatik olaraq göndərilmişdir.</p>
      </div>
    `,
  });
}

export async function sendErrorNotification(params: {
  errorType: string;
  errorMessage: string;
  errorStack?: string;
  userId?: string;
  route?: string;
}): Promise<void> {
  const transporter = createTransport();
  await transporter.sendMail({
    from: `"Ads Audit System" <${process.env.SMTP_USER}>`,
    to: ADMIN_EMAIL,
    subject: `[Ads Audit] ⚠️ Sistem Xətası: ${params.errorType}`,
    html: `
      <div style="font-family: Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
        <h2 style="color: #EA4335;">⚠️ Sistem Xətası Aşkar Edildi</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; font-weight: bold;">Xəta növü:</td><td style="padding: 8px;">${params.errorType}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Mesaj:</td><td style="padding: 8px;">${params.errorMessage}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Marşrut:</td><td style="padding: 8px;">${params.route || 'Bilinmir'}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">İstifadəçi ID:</td><td style="padding: 8px;">${params.userId || 'Bilinmir'}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Vaxt:</td><td style="padding: 8px;">${new Date().toISOString()}</td></tr>
        </table>
        ${params.errorStack ? `<pre style="background: #fff; padding: 15px; border-radius: 5px; font-size: 12px; overflow-x: auto;">${params.errorStack}</pre>` : ''}
      </div>
    `,
  });
}
