/**
 * SignupPage — User registration for Sales Reps and Customers
 *
 * Spec refs: §8.17 (Email+Password auth), §8.21 (portal isolation),
 *            Section A1 (authentication/signup for internal reps & portal customers)
 *
 * Rule: Only one account is permitted per company organization (Customer).
 *       Sales Rep accounts include first name, last name, and work email.
 */

import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Mail,
  Lock,
  Building2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

export default function SignupPage() {
  const { signup, user } = useAuth();

  // Internal Sales Rep registration only
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  if (user) {
    return (
      <Navigate
        to={user.role === 'CUSTOMER' ? '/portal/quotations' : '/app/dashboard'}
        replace
      />
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!firstName.trim()) {
      setError('Please enter your first name');
      return;
    }
    if (!lastName.trim()) {
      setError('Please enter your last name');
      return;
    }

    setLoading(true);
    try {
      await signup({
        email: email.trim(),
        password,
        role: 'SALES_REP',
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-base relative overflow-hidden px-4 py-12">
      {/* Ambient background glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-600/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-deal-500/15 rounded-full blur-[128px] pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        {/* Logo / title */}
        <div className="text-center mb-8">
          <Link
            to="/login"
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 text-white font-black text-xl shadow-lg shadow-brand-500/30 mb-3 ring-1 ring-white/20 transition hover:scale-105"
          >
            D
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Deal<span className="text-brand-400">Flow</span>360
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Sales Operations &amp; CPQ Platform
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface-card/95 backdrop-blur-xl border border-surface-border rounded-2xl p-7 shadow-2xl shadow-black/70">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Sales Rep Registration</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Join your sales team to manage commercial quotations &amp; deals
              </p>
            </div>
            <span className="p-2 rounded-lg bg-surface-elevated text-brand-400 border border-surface-border">
              <ShieldCheck size={18} />
            </span>
          </div>

          {error && (
            <div
              id="signup-error"
              className="mb-4 p-3 bg-rose-950/40 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form id="signup-form" onSubmit={handleSubmit} className="space-y-4">

            {/* ── Sales Rep: First Name + Last Name ── */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="firstName"
                    className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider"
                  >
                    First Name <span className="text-brand-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <User size={15} />
                    </span>
                    <input
                      id="firstName"
                      type="text"
                      autoComplete="given-name"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First name"
                      className="w-full pl-10 pr-4 py-2.5 bg-surface-elevated/70 border border-surface-border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="lastName"
                    className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider"
                  >
                    Last Name <span className="text-brand-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <User size={15} />
                    </span>
                    <input
                      id="lastName"
                      type="text"
                      autoComplete="family-name"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last name"
                      className="w-full pl-10 pr-4 py-2.5 bg-surface-elevated/70 border border-surface-border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition"
                    />
                  </div>
                </div>
              </div>

            {/* ── Work Email Address ── */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider"
              >
                Work Email Address <span className="text-brand-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail size={15} />
                </span>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-surface-elevated/70 border border-surface-border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition"
                  placeholder="you@yourcompany.com"
                />
              </div>
            </div>

            {/* ── Password ── */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider"
              >
                Password <span className="text-brand-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock size={15} />
                </span>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-surface-elevated/70 border border-surface-border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition"
                  placeholder="At least 6 characters"
                />
              </div>
            </div>

            {/* ── Submit ── */}
            <Button
              id="signup-submit"
              type="submit"
              loading={loading}
              size="lg"
              className="w-full mt-2"
              leftIcon={!loading ? <Sparkles size={14} /> : undefined}
              rightIcon={!loading ? <ArrowRight size={14} /> : undefined}
            >
              {loading ? 'Creating Account…' : 'Create Sales Rep Account'}
            </Button>
          </form>

          {/* Client Portal Provisioning Notice */}
          <div className="mt-5 p-3 rounded-xl bg-surface-base border border-surface-border text-left">
            <div className="flex items-start gap-2.5">
              <Building2 size={15} className="text-brand-400 mt-0.5 shrink-0" />
              <div className="text-[11px] text-slate-400 leading-relaxed">
                <strong className="text-slate-300">Client Portal Access:</strong> Customer portal accounts are provisioned directly by Sales Representatives and Administrators during quotation dispatch.
              </div>
            </div>
          </div>

          {/* Footer Navigation */}
          <div className="mt-6 pt-5 border-t border-surface-border text-center">
            <p className="text-xs text-slate-400">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-brand-400 hover:text-brand-300 font-semibold underline underline-offset-4 ml-1"
              >
                Sign in here →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
