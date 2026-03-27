import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';

interface AuthContextType {
  authed: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  authed: false,
  loading: true,
  login: async () => 'Not initialized',
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check if already authed on mount
  useEffect(() => {
    api('GET', '/api/info')
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false))
      .finally(() => setLoading(false));

    const handler = () => setAuthed(false);
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  const login = async (username: string, password: string): Promise<string | null> => {
    try {
      const data = await api<{ ok?: boolean; error?: string }>('POST', '/api/login', { username, password });
      if (data.ok) {
        setAuthed(true);
        return null;
      }
      return data.error || 'Login failed';
    } catch (err: any) {
      return err.message || 'Login failed';
    }
  };

  const logout = async () => {
    try { await api('POST', '/api/logout'); } catch (_) {}
    setAuthed(false);
  };

  return (
    <AuthContext.Provider value={{ authed, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
