/**
 * ProtectedRoute — redirect to /login if not authenticated or wrong role
 *
 * Spec refs: §8.20 (authorization), §8.21 (portal isolation /app/* vs /portal/*)
 */

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, type UserRole } from '../context/AuthContext';

interface Props {
  /** Allowed roles for this route group. If empty, any authenticated user is allowed. */
  allowedRoles?: UserRole[];
  /** Where to redirect on auth failure */
  redirectTo?: string;
}

export function ProtectedRoute({ allowedRoles = [], redirectTo = '/login' }: Props) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  if (allowedRoles.length > 0 && user && !allowedRoles.includes(user.role)) {
    // Wrong role — redirect to their correct home
    if (user.role === 'CUSTOMER') return <Navigate to="/portal/quotations" replace />;
    return <Navigate to="/app/dashboard" replace />;
  }

  return <Outlet />;
}
