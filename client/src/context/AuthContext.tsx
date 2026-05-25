import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { User } from '../types';

export interface OtpChallenge {
  requiresOtp: true;
  sessionToken: string;
  email: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<OtpChallenge | void>;
  verifyOtp: (sessionToken: string, code: string) => Promise<void>;
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  // Addım 1: email + şifrə → ya OTP challenge, ya da birbaşa login
  const login = async (email: string, password: string): Promise<OtpChallenge | void> => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.requiresOtp) {
      // OTP doğrulaması tələb olunur
      return { requiresOtp: true, sessionToken: res.data.sessionToken, email: res.data.email };
    }
    // OTP olmadan birbaşa login (gələcək üçün)
    const { token: t, user: u } = res.data;
    localStorage.setItem('token', t);
    setToken(t);
    setUser(u);
  };

  // Addım 2: OTP kodu yoxla → JWT al
  const verifyOtp = async (sessionToken: string, code: string): Promise<void> => {
    const res = await api.post('/auth/verify-otp', { sessionToken, code });
    const { token: t, user: u } = res.data;
    localStorage.setItem('token', t);
    setToken(t);
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, verifyOtp, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
