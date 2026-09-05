/**
 * AuthContext — stores JWT token + decoded user in React state
 *
 * Spec refs: §8.19 (short-lived token), §8.21 (portal isolation)
 *
 * The token is kept in memory (React state) rather than localStorage
 * to avoid XSS token theft — acceptable tradeoff for this hackathon demo.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'SALES_REP' | 'MANAGER' | 'FINANCE_OPS' | 'CUSTOMER';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  customerId: string | null;
  isActive: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

// ── Context ────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const body = await res.json() as { error: string };
      throw new Error(body.error ?? 'Login failed');
    }

    const body = await res.json() as { user: AuthUser; token: string };
    setUser(body.user);
    setToken(body.token);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
