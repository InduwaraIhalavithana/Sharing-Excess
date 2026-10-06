import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User } from '../types/api';
import { api } from '../utils/api';

interface AuthValue {
  user: User | null;
  login: (userData: User, token?: string) => void;
  logout: () => void;
  /** Re-read the signed-in user from the server (an NGO's approval, a new district ...). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

function loadFromStorage(): User | null {
  try {
    const stored = localStorage.getItem('user');
    return stored ? (JSON.parse(stored) as User) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadFromStorage);

  const login = useCallback((userData: User, token?: string) => {
    localStorage.setItem('user', JSON.stringify(userData));
    if (token) localStorage.setItem('se_token', token);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('user');
    localStorage.removeItem('se_token');
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!localStorage.getItem('se_token')) return;
    try {
      const res = await api<{ user?: User }>('/api/auth/me');
      if (!res.user) return;
      localStorage.setItem('user', JSON.stringify(res.user));
      setUser(res.user);
    } catch {
      /* offline or expired: a 401 already signs the user out via auth:expired */
    }
  }, []);

  // The stored copy of the user can be stale (approved by the admin since, district changed on another device)
  useEffect(() => { void refresh(); }, [refresh]);

  // Cross-tab sync and token expiry
  useEffect(() => {
    const onStorage = () => setUser(loadFromStorage());
    const onExpired = () => logout();
    window.addEventListener('storage', onStorage);
    window.addEventListener('auth:expired', onExpired);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('auth:expired', onExpired);
    };
  }, [logout]);

  return <AuthContext.Provider value={{ user, login, logout, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
