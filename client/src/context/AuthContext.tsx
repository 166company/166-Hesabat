import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { User } from '../types';

export interface OtpChallenge {
  requiresOtp: true;
  sessionToken: string;
  email: string;
}

export interface ApprovalChallenge {
  requiresApproval: true;
  approvalSessionToken: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<OtpChallenge | void>;
  verifyOtp: (sessionToken: string, code: string) => Promise<ApprovalChallenge | void>;
  checkApprovalStatus: (approvalSessionToken: string) => Promise<'pending' | 'approved' | 'denied' | 'expired'>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const stored = localStorage.getItem('token');
    if (!stored) { setLoading(false); return; }
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      setToken(stored);
    } catch {
      localStorage.removeItem('token');
      setUser(null);
      setToken(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  // Addım 1: email + şifrə → OTP challenge
  const login = async (email: string, password: string): Promise<OtpChallenge | void> => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.requiresOtp) {
      return { requiresOtp: true, sessionToken: res.data.sessionToken, email: res.data.email };
    }
  };

  // Addım 2: OTP kodu → Approval challenge
  const verifyOtp = async (sessionToken: string, code: string): Promise<ApprovalChallenge | void> => {
    const res = await api.post('/auth/verify-otp', { sessionToken, code });
    if (res.data.requiresApproval) {
      return { requiresApproval: true, approvalSessionToken: res.data.approvalSessionToken };
    }
  };

  // Addım 3: Admin təsdiqini polling ilə yoxla
  const checkApprovalStatus = async (approvalSessionToken: string): Promise<'pending' | 'approved' | 'denied' | 'expired'> => {
    const res = await api.get(`/auth/approval-status?token=${approvalSessionToken}`);
    const { status, token: jwtToken, user: userData } = res.data;
    if (status === 'approved' && jwtToken) {
      localStorage.setItem('token', jwtToken);
      setToken(jwtToken);
      setUser(userData);
    }
    return status;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, verifyOtp, checkApprovalStatus, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
