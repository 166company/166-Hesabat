import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { userQueries } from '../db/database';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    chatAccess: string;
  };
}

// Produksiyada JWT_SECRET mütləq təyin edilməlidir
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[SECURITY] JWT_SECRET env var is not set! Server cannot start safely.');
    process.exit(1);
  } else {
    console.warn('[SECURITY] JWT_SECRET not set — using insecure fallback (dev mode only)');
  }
}
const JWT_SECRET_RESOLVED = JWT_SECRET || 'dev_only_insecure_fallback_do_not_use_in_prod!!';

// 5 dəqiqəlik user cache — hər sorğuda DB-yə getməsin
// Max 500 entry — memory exhaustion-dan qorumaq üçün
const userCache = new Map<string, { user: any; exp: number }>();
const CACHE_TTL = 5 * 60 * 1000;
const CACHE_MAX_SIZE = 500;

// --- Brute-force tracker ---
// IP başına max uğursuz giriş cəhdi
interface FailRecord { count: number; firstAt: number; lockedUntil?: number; }
const loginFailures = new Map<string, FailRecord>();
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 dəq
const LOCKOUT_MS = 15 * 60 * 1000; // 15 dəq

export function recordLoginFailure(ip: string): { locked: boolean; remaining: number } {
  const now = Date.now();
  let rec = loginFailures.get(ip);
  if (!rec || now - rec.firstAt > WINDOW_MS) {
    rec = { count: 1, firstAt: now };
  } else {
    rec.count++;
  }
  if (rec.count >= MAX_FAILURES) {
    rec.lockedUntil = now + LOCKOUT_MS;
  }
  loginFailures.set(ip, rec);
  // Köhnə qeydləri arada təmizlə (memory leak əngəl)
  if (loginFailures.size > 10000) {
    for (const [k, v] of loginFailures) {
      if (now - v.firstAt > WINDOW_MS * 2) loginFailures.delete(k);
    }
  }
  return { locked: rec.count >= MAX_FAILURES, remaining: Math.max(0, MAX_FAILURES - rec.count) };
}

export function checkLoginLocked(ip: string): { locked: boolean; retryAfterMs: number } {
  const rec = loginFailures.get(ip);
  if (!rec) return { locked: false, retryAfterMs: 0 };
  const now = Date.now();
  if (rec.lockedUntil && now < rec.lockedUntil) {
    return { locked: true, retryAfterMs: rec.lockedUntil - now };
  }
  return { locked: false, retryAfterMs: 0 };
}

export function clearLoginFailures(ip: string): void {
  loginFailures.delete(ip);
}

export function signToken(payload: object): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jwt.sign(payload, JWT_SECRET_RESOLVED, { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any });
}

export function verifyToken(token: string): jwt.JwtPayload {
  return jwt.verify(token, JWT_SECRET_RESOLVED) as jwt.JwtPayload;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET_RESOLVED) as jwt.JwtPayload;
    const cached = userCache.get(decoded.id);
    if (cached && cached.exp > Date.now()) {
      req.user = cached.user;
      return next();
    }
    userQueries.findById(decoded.id).then(user => {
      if (!user || user.status !== 'approved') {
        res.status(401).json({ error: 'Account not approved or not found' });
        return;
      }
      const userData = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        chatAccess: user.chat_access,
      };
      // Cache-ə əlavə etməzdən əvvəl ölçünü yoxla
      if (userCache.size >= CACHE_MAX_SIZE) {
        // Ən köhnə yarısını sil
        const entries = [...userCache.entries()].sort((a, b) => a[1].exp - b[1].exp);
        entries.slice(0, CACHE_MAX_SIZE / 2).forEach(([k]) => userCache.delete(k));
      }
      userCache.set(decoded.id, { user: userData, exp: Date.now() + CACHE_TTL });
      req.user = userData;
      next();
    }).catch(() => {
      res.status(401).json({ error: 'Unauthorized' });
    });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireApproved(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (req.user.status !== 'approved') {
    res.status(403).json({ error: 'Account pending approval' });
    return;
  }
  next();
}

export function requireChatAccess(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (req.user.chatAccess !== 'approved') {
    res.status(403).json({ error: 'Chat access not approved' });
    return;
  }
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Yalnız adminlər üçün' });
    return;
  }
  next();
}
