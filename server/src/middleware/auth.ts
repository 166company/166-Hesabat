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

const JWT_SECRET = process.env.JWT_SECRET || 'changeme_secret_32chars_minimum!!';

export function signToken(payload: object): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jwt.sign(payload, JWT_SECRET, { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any });
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    const user = userQueries.findById.get(decoded.id) as any;
    if (!user || user.status !== 'approved') {
      res.status(401).json({ error: 'Account not approved or not found' });
      return;
    }
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      chatAccess: user.chat_access,
    };
    next();
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
