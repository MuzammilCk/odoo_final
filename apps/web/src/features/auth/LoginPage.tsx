/**
 * LoginPage — email + password form
 * After login, redirects based on role:
 *   CUSTOMER   → /portal/quotations
 *   all others → /app/dashboard
 *
 * Spec refs: §8.17, §8.21
 */

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Redirect after successful login (user state is updated in AuthContext)
  // We use a separate effect-free approach: navigate in a useEffect-free pattern
  // by relying on the AuthContext update triggering a re-render then redirecting
  if (user) {
    navigate(user.role === 'CUSTOMER' ? '/portal/quotations' : '/app/dashboard', { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-md">
        {/* Logo / title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">
            Deal<span className="text-brand-500">Flow</span>360
          </h1>
          <p className="text-gray-400 mt-2 text-sm">B2B Sales Operations Platform</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6">Sign in to your account</h2>

          {error && (
            <div id="login-error" className="mb-4 p-3 bg-red-950 border border-red-800 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <form id="login-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                placeholder="••••••••"
              />
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition duration-150"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Demo credentials hint */}
          <div className="mt-6 pt-5 border-t border-gray-800">
            <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Demo accounts (password: demo123)</p>
            <div className="grid grid-cols-2 gap-1 text-xs text-gray-400">
              {[
                ['admin@demo.com', 'Admin'],
                ['rep@demo.com', 'Sales Rep'],
                ['manager@demo.com', 'Manager'],
                ['finance@demo.com', 'Finance'],
                ['customer@acme.com', 'Customer'],
              ].map(([email, label]) => (
                <button
                  key={email}
                  type="button"
                  onClick={() => { setEmail(email); setPassword('demo123'); }}
                  className="text-left px-2 py-1 rounded hover:bg-gray-800 hover:text-brand-400 transition text-xs"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
