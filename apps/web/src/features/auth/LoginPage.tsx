/**
 * LoginPage — DealFlow360 authentication gate
 *
 * UI/UX Upgrade:
 * - Split-panel layout: left brand column (gradient mesh), right form column
 * - Accessible form with connected labels and autocomplete attributes
 * - IntelliSense-powered password toggle
 * - Focused form layout with subtle enter animation
 * - No raw confirm() dialogs
 */

import { useState, type FormEvent } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function LoginPage() {
  const { login, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isAuthenticated && user) {
    return (
      <Navigate
        to={user.role === 'CUSTOMER' ? '/portal/quotations' : '/app/dashboard'}
        replace
      />
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const loggedInUser = await login(email.trim(), password);

      if (loggedInUser.role === 'CUSTOMER') {
        navigate('/portal/quotations', { replace: true });
      } else {
        navigate('/app/dashboard', { replace: true });
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleQuickFill(demoEmail: string) {
    setEmail(demoEmail);
    setPassword('demo123');
    setError(null);
  }

  return (
    <div className="min-h-screen flex bg-surface-canvas">
      {/* ── Left brand column ────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[44%] flex-col justify-between p-10 relative overflow-hidden bg-surface-base border-r border-surface-border">
        {/* Background mesh */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 40% 30%, rgba(59,130,246,0.12) 0%, transparent 70%), radial-gradient(ellipse 60% 80% at 70% 70%, rgba(16,185,129,0.08) 0%, transparent 70%)',
          }}
        />
        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-black text-base shadow-glow-brand ring-1 ring-white/20">
            D
          </div>
          <div>
            <div className="text-lg font-bold text-white tracking-tight">
              Deal<span className="text-brand-400">Flow</span>360
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">CPQ Engine</div>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="relative space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight leading-snug">
              The commercial intelligence
              <br />platform for serious ops teams
            </h2>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed max-w-xs">
              Quote, approve, fulfill, bill — all governed by a single source of commercial truth.
            </p>
          </div>
          <div className="space-y-3">
            {[
              'Multi-tier approval workflows with risk gates',
              'Real-time margin governance & discount control',
              'Automated subscription billing & revenue recognition',
            ].map(feature => (
              <div key={feature} className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-brand-500/15 border border-brand-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400" aria-hidden="true" />
                </span>
                <span className="text-xs text-slate-300">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[11px] text-slate-600 font-mono">© 2025 DealFlow360. All rights reserved.</p>
      </div>

      {/* ── Right form column ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-black text-sm">
              D
            </div>
            <span className="text-base font-bold text-white">
              Deal<span className="text-brand-400">Flow</span>360
            </span>
          </div>

          <div className="mb-7">
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-slate-400">Sign in to your account to continue</p>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-rose-950/40 border border-rose-700/60 text-rose-300 text-sm" role="alert">
              <AlertCircle size={15} aria-hidden="true" className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Input
              label="Email address"
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              required
              prefixIcon={<Mail size={14} />}
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              prefixIcon={<Lock size={14} />}
              suffix={
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              }
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full mt-2"
              rightIcon={!loading ? <ArrowRight size={14} /> : undefined}
            >
              Sign in
            </Button>
          </form>

          {/* Quick Demo Access */}
          <div className="mt-6 pt-5 border-t border-surface-border">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                Quick Demo Access
              </span>
              <span className="text-[10px] text-slate-500 font-mono">pwd: demo123</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { email: 'rep@demo.com', role: 'Sales Rep', name: 'Sarah' },
                { email: 'manager@demo.com', role: 'Manager', name: 'Mike' },
                { email: 'finance@demo.com', role: 'Finance Ops', name: 'Fiona' },
                { email: 'admin@demo.com', role: 'Admin', name: 'Admin' },
                { email: 'customer@acme.com', role: 'Customer Portal', name: 'Acme Corp', fullWidth: true },
              ].map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleQuickFill(acc.email)}
                  className={`text-left px-2.5 py-1.5 rounded-lg bg-surface-elevated/60 border border-surface-border hover:border-brand-500/40 hover:bg-surface-elevated transition-colors text-xs flex items-center justify-between group cursor-pointer ${
                    acc.fullWidth ? 'col-span-2' : ''
                  }`}
                >
                  <div className="truncate">
                    <span className="font-medium text-slate-200 block truncate">{acc.role}</span>
                    <span className="text-[10px] text-slate-400 truncate block">{acc.name} ({acc.email})</span>
                  </div>
                  <span className="text-[10px] font-mono text-brand-400 opacity-70 group-hover:opacity-100 ml-1 shrink-0">
                    Fill
                  </span>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="text-brand-400 hover:text-brand-300 font-semibold transition-colors duration-150"
            >
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
