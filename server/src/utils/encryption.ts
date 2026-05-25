import crypto from 'crypto';

const KEY_HEX = process.env.ENCRYPTION_KEY;

// Produksiyada ENCRYPTION_KEY mütləq 64 hex-simvol (32 bayt) olmalıdır
if (!KEY_HEX) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[SECURITY] ENCRYPTION_KEY env var is not set! Server cannot start safely.');
    process.exit(1);
  } else {
    console.warn('[SECURITY] ENCRYPTION_KEY not set — using temporary random key (dev mode only)');
  }
}
const KEY_RESOLVED = KEY_HEX || crypto.randomBytes(32).toString('hex');
if (KEY_RESOLVED.length !== 64) {
  console.error('[SECURITY] ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Got:', KEY_RESOLVED.length);
  if (process.env.NODE_ENV === 'production') process.exit(1);
}
const KEY = Buffer.from(KEY_RESOLVED, 'hex');

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(encryptedText: string): string {
  const [ivHex, encryptedHex] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function generateNumericCode(digits = 6): string {
  const max = Math.pow(10, digits);
  return String(crypto.randomInt(max)).padStart(digits, '0');
}
