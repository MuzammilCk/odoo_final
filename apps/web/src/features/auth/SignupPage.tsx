/**
 * SignupPage — User registration for Sales Reps and Customers
 *
 * Spec refs: §8.17 (Email+Password auth), §8.21 (portal isolation),
 *            Section A1 (authentication/signup for internal reps & portal customers)
 *
 * Rule: Only one account is permitted per company organization.
 */

import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  User,
  Mail,
  Lock,
  Building2,
  Briefcase,
  ArrowRight,
  ShieldCheck,
  Loader2,
  Sparkles,
} from 'lucide-react';

type SignupRole = 'SALES_REP' | 'CUSTOMER';

export default function SignupPage() {
  const { signup, user } = useAuth();

  const [role, setRole] = useState<SignupRole>('SALES_REP');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
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

    if (role === 'CUSTOMER' && !companyName.trim()) {
      setError('Please enter your company or organization name');
      return;
    }

    setLoading(true);
    try {
      await signup({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
        companyName: role === 'CUSTOMER' ? companyName.trim() : undefined,
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
            Intelligent, Self-Governing Sales Operations Platform
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface-card/95 backdrop-blur-xl border border-surface-border rounded-2xl p-7 shadow-2xl shadow-black/70">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Create an account</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Select your role to configure your workspace
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
            {/* Role Selection Tabs / Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                Select Account Role <span className="text-brand-400">*</span>
              </label>

              {/* Role Cards */}
              <div className="grid grid-cols-2 gap-3 mb-2">
                <button
                  type="button"
                  onClick={() => setRole('SALES_REP')}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    role === 'SALES_REP'
                      ? 'bg-brand-600/15 border-brand-500/50 text-white shadow-sm shadow-brand-500/20'
                      : 'bg-surface-elevated/50 border-surface-border text-slate-400 hover:border-slate-600 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Briefcase
                      size={18}
                      className={role === 'SALES_REP' ? 'text-brand-400' : 'text-slate-500'}
                    />
                    <span
                      className={`w-2 h-2 rounded-full ${
                        role === 'SALES_REP' ? 'bg-brand-400' : 'bg-transparent'
                      }`}
                    />
                  </div>
                  <div>
                    <div className="text-xs font-bold">Sales Representative</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Internal Deals & Quotations
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('CUSTOMER')}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    role === 'CUSTOMER'
                      ? 'bg-brand-600/15 border-brand-500/50 text-white shadow-sm shadow-brand-500/20'
                      : 'bg-surface-elevated/50 border-surface-border text-slate-400 hover:border-slate-600 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Building2
                      size={18}
                      className={role === 'CUSTOMER' ? 'text-brand-400' : 'text-slate-500'}
                    />
                    <span
                      className={`w-2 h-2 rounded-full ${
                        role === 'CUSTOMER' ? 'bg-brand-400' : 'bg-transparent'
                      }`}
                    />
                  </div>
                  <div>
                    <div className="text-xs font-bold">Customer / Buyer</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Company Negotiation Portal
                    </div>
                  </div>
                </button>
              </div>

              {/* Accessible Dropdown Selector */}
              <div className="relative">
                <select
                  id="role-select"
                  value={role}
                  onChange={(e) => setRole(e.target.value as SignupRole)}
                  className="w-full px-3 py-2 bg-surface-elevated/70 border border-surface-border rounded-xl text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 cursor-pointer"
                >
                  <option value="SALES_REP">Role: Sales Representative (Internal)</option>
                  <option value="CUSTOMER">Role: Customer / Buyer (Company Account)</option>
                </select>
              </div>
            </div>

            {/* Company Name (only if Customer role) */}
            {role === 'CUSTOMER' && (
              <div className="bg-surface-elevated/40 border border-brand-500/30 rounded-xl p-3.5 space-y-2 animate-fade-in">
                <label
                  htmlFor="companyName"
                  className="block text-xs font-semibold text-brand-300 uppercase tracking-wider"
                >
                  Company / Organization Name <span className="text-brand-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Building2 size={15} />
                  </span>
                  <input
                    id="companyName"
                    type="text"
                    required={role === 'CUSTOMER'}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Acme Industries, Nova Logistics"
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-base border border-surface-border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition"
                  />
                </div>
                <p className="text-[10px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                  <ShieldCheck size={12} className="text-brand-400 shrink-0" />
                  <span>Only one master account per company is permitted.</span>
                </p>
              </div>
            )}

            {/* Name fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider"
                >
                  First Name <span className="text-brand-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User size={15} />
                  </span>
                  <input
                    id="firstName"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-surface-elevated/70 border border-surface-border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition"
                    placeholder="Jane"
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
                <input
                  id="lastName"
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-elevated/70 border border-surface-border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition"
                  placeholder="Doe"
                />
              </div>
            </div>

            {/* Email Address */}
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
                  placeholder="name@company.com"
                />
              </div>
            </div>

            {/* Password */}
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

            {/* Submit Button */}
            <button
              id="signup-submit"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl shadow-md shadow-brand-600/25 transition duration-150 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Creating Account…</span>
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  <span>
                    Create {role === 'SALES_REP' ? 'Sales Rep' : 'Customer'} Account
                  </span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

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
