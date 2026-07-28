'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { apiFetch, AUTH_EXPIRED_EVENT } from '@/lib/api';
import {
  clearToken,
  getToken,
  isExpired,
  msUntilExpiry,
  setToken,
  userFromToken,
  type StoredUser,
} from '@/lib/token';

interface LoginResponse {
  token: string;
  expiresAt: string;
  expiresIn: number;
  user: StoredUser;
}

interface AuthContextValue {
  user: StoredUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: (reason?: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [ready, setReady] = useState(false);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logout = useCallback(
    (reason?: string) => {
      clearToken();
      setUser(null);
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
      if (reason) toast.error(reason);
      router.replace('/auth/login');
    },
    [router]
  );

  /** Schedules the automatic logout for the exact instant the token dies. */
  const armExpiryTimer = useCallback(
    (token: string) => {
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
      const ms = msUntilExpiry(token);
      // setTimeout tops out around 24.8 days, comfortably above our 1-day window.
      expiryTimer.current = setTimeout(
        () => logout('Session expired. Please log in again.'),
        ms
      );
    },
    [logout]
  );

  // Restore the session from the cookie on first paint.
  useEffect(() => {
    const token = getToken();
    if (token && !isExpired(token)) {
      setUser(userFromToken(token));
      armExpiryTimer(token);
    } else if (token) {
      clearToken();
    }
    setReady(true);
  }, [armExpiryTimer]);

  // The API client raises this whenever a request comes back 401.
  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      router.replace('/auth/login');
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, [router]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiFetch<LoginResponse>('/api/auth/token', {
        method: 'POST',
        anonymous: true,
        body: { email, password },
      });
      setToken(data.token, data.expiresAt);
      setUser(data.user);
      armExpiryTimer(data.token);
    },
    [armExpiryTimer]
  );

  const value = useMemo(() => ({ user, ready, login, logout }), [user, ready, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
