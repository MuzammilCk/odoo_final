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

export interface SignupPayload {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  customerId?: string;
  companyName?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

// ── Context ────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('df360_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('df360_token') || null;
  });

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
    try {
      localStorage.setItem('df360_user', JSON.stringify(body.user));
      localStorage.setItem('df360_token', body.token);
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  }, []);

  const signup = useCallback(async (payload: SignupPayload) => {
    const res = await fetch('/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json() as { error?: string; details?: { fieldErrors?: Record<string, string[]> } };
      let errMsg = body.error ?? 'Signup failed';
      if (body.details?.fieldErrors) {
        const firstField = Object.values(body.details.fieldErrors).flat()[0];
        if (firstField) errMsg = firstField;
      }
      throw new Error(errMsg);
    }

    const body = await res.json() as { user: AuthUser; token: string };
    setUser(body.user);
    setToken(body.token);
    try {
      localStorage.setItem('df360_user', JSON.stringify(body.user));
      localStorage.setItem('df360_token', body.token);
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    try {
      localStorage.removeItem('df360_user');
      localStorage.removeItem('df360_token');
    } catch (e) {
      console.warn('Failed to clear localStorage', e);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, signup, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
