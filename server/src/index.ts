import 'dotenv/config';
import axios from 'axios';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { initDatabase, chatQueries, userQueries, errorLogQueries } from './db/database';
import { verifyToken } from './middleware/auth';
import { sendErrorNotification } from './services/emailService';
import bcrypt from 'bcryptjs';
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import metaRouter from './routes/meta';
import googleRouter from './routes/google';
import chatRouter from './routes/chat';
import reportTableRouter from './routes/reportTable';
import tiktokRouter from './routes/tiktok';
import dashboardRouter from './routes/dashboard';

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Bütün icazəli originlər (localhost + Netlify)
const ALLOWED_ORIGINS = [
  CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'https://sensational-concha-8ed763.netlify.app',
];

// İlk işə düşmədə admin yoxdursa avtomatik yarat
async function seedAdminUser() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'cavidanbusiness2026@gmail.com';
    const setupPassword = process.env.SETUP_ADMIN_PASSWORD || 'Admin@166!';
    const existing = await userQueries.findByEmail(adminEmail);
    if (!existing) {
      const hash = bcrypt.hashSync(setupPassword, 12);
      await userQueries.create({
        id: uuidv4(),
        email: adminEmail,
        password_hash: hash,
        name: process.env.ADMIN_NAME || 'Admin',
        role: 'admin',
        status: 'approved',
        chat_access: 'approved',
      });
      // Şifrəni loglara yazmırıq — təhlükəsizlik üçün
      console.log(`[Seed] Admin yaradıldı: ${adminEmail}`);
    }
  } catch (e: any) {
    console.error('[Seed] Xəta:', e.message);
  }
}

const app = express();
app.set('trust proxy', 1);
const httpServer = createServer(app);

const io = new SocketServer(httpServer, {
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'], credentials: true },
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Vite dev + React üçün
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc: ["'self'", ...ALLOWED_ORIGINS, 'https://googleads.googleapis.com', 'https://graph.facebook.com'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Render üçün lazımdır
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) callback(null, true);
    else callback(new Error('CORS: icazə verilmədi'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '512kb' })); // 1mb-dan 512kb-a endirdik
// Auto-populate üçün uzun timeout (Meta API 14 hesab = ~3-5 dəq)
app.use('/api/report-table/auto-populate', (_req, _res, next) => {
  _req.setTimeout(600000); _res.setTimeout(600000); next();
});

// Ümumi API rate limiter
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
app.use('/api/', limiter);

// Auth endpoint-ləri üçün ciddi rate limiter (brute force əngəl)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dəq
  max: 20, // 15 dəq ərzində max 20 sorğu (login + register)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çox sayda sorğu. 15 dəqiqə sonra yenidən cəhd edin.' },
  skipSuccessfulRequests: false,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// --- Routes ---
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/report-table', reportTableRouter);
app.use('/api/tiktok', tiktokRouter);
app.use('/api/meta', metaRouter);
app.use('/api/google', googleRouter);
app.use('/api/chat', chatRouter);
app.use('/api/dashboard', dashboardRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Digital marketing news — SEJ RSS
app.get('/api/news', async (_req, res) => {
  const sources = [
    'https://feeds.feedburner.com/SearchEngineJournal',
    'https://www.searchenginejournal.com/feed/',
    'https://feeds.feedburner.com/socialmediatoday/hCGe',
  ];
  function parseRss(xml: string) {
    const items: { title: string; link: string; pubDate: string }[] = [];
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 6) {
      const block = match[1];
      const title = (/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s.exec(block) || [])[1]?.trim() || '';
      const link = (/<link>([^<]+)<\/link>/.exec(block) || [])[1]?.trim()
        || (/<link\s+href="([^"]+)"/.exec(block) || [])[1]?.trim() || '';
      const pubDate = (/<pubDate>([^<]+)<\/pubDate>/.exec(block) || [])[1]?.trim() || '';
      if (title && link) items.push({ title, link, pubDate });
    }
    return items;
  }
  for (const rssUrl of sources) {
    try {
      const r = await axios.get(rssUrl, {
        timeout: 12000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          'Accept': 'text/xml, application/xml, application/rss+xml, */*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        responseType: 'text',
      });
      const items = parseRss(r.data);
      console.log(`[News] ${rssUrl} → ${items.length} items`);
      if (items.length > 0) { res.json({ items }); return; }
    } catch (e: any) {
      console.warn(`[News] ${rssUrl} failed: ${e.code || e.message}`);
    }
  }
  res.json({ items: [] });
});

// --- Socket.io for real-time chat ---
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token as string;
  if (!token) return next(new Error('Unauthorized'));
  try {
    const decoded = verifyToken(token);
    const user = await userQueries.findById(decoded.id);
    if (!user || user.status !== 'approved' || user.chat_access !== 'approved') {
      return next(new Error('Chat erişimi yoxdur'));
    }
    (socket as any).user = { id: user.id, name: user.name, email: user.email };
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const user = (socket as any).user;
  console.log(`[Chat] ${user.name} connected`);

  socket.on('chat:message', async (data: { message: string }) => {
    const message = String(data.message || '').trim().slice(0, 1000);
    if (!message) return;
    const id = uuidv4();
    await chatQueries.create({ id, user_id: user.id, user_name: user.name, message });
    const msg = { id, userId: user.id, userName: user.name, message, createdAt: new Date().toISOString() };
    io.emit('chat:message', msg);
  });

  socket.on('disconnect', () => {
    console.log(`[Chat] ${user.name} disconnected`);
  });
});

// --- Global error handler ---
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err);
  const logId = uuidv4();
  errorLogQueries.create({
    id: logId,
    error_type: err.name || 'Error',
    error_message: err.message,
    error_stack: err.stack ?? null,
    user_id: (req as any).user?.id ?? null,
    route: req.path,
  }).then(() => {
    sendErrorNotification({
      errorType: err.name || 'Error',
      errorMessage: err.message,
      errorStack: err.stack,
      userId: (req as any).user?.id,
      route: req.path,
    }).catch(console.error);
  }).catch(() => {
    // suppress logging errors
  });
  res.status(500).json({ error: 'Daxili server xətası' });
});

(async () => {
  await initDatabase();
  await seedAdminUser();
  httpServer.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
    // Render free tier cold start-ın qarşısını al — hər 14 dəq self-ping
    if (process.env.NODE_ENV === 'production') {
      const serverUrl = process.env.SERVER_PUBLIC_URL || `https://one66-hesabat.onrender.com`;
      setInterval(async () => {
        axios.get(`${serverUrl}/api/health`).catch(() => {});
        // Neon-u da oyaq saxla
        try { await (await import('./db/database')).default.query('SELECT 1'); } catch {}
      }, 14 * 60 * 1000);
      console.log('[Server] Self-ping aktiv edildi (hər 14 dəq)');
    }
  });
})();

export default app;
