import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

function loadFromStorage() {
  try {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadFromStorage);

  const login = useCallback((userData, token) => {
    localStorage.setItem('user', JSON.stringify(userData));
    if (token) localStorage.setItem('se_token', token);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('user');
    localStorage.removeItem('se_token');
    setUser(null);
  }, []);

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

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
