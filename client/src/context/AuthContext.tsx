import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { User } from '../types';

export interface ApprovalChallenge {
  requiresApproval: true;
  approvalSessionToken: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<ApprovalChallenge | void>;
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

  const login = async (email: string, password: string): Promise<ApprovalChallenge | void> => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.requiresApproval) {
      return { requiresApproval: true, approvalSessionToken: res.data.approvalSessionToken };
    }
  };

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
    <AuthContext.Provider value={{ user, token, loading, login, checkApprovalStatus, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
