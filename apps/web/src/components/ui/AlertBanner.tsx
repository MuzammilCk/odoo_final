/**
 * AlertBanner — accessible status alert
 * Replaces raw colored div boxes with accessible alerts featuring Lucide icons and aria-live.
 */

import * as React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

type AlertVariant = 'error' | 'success' | 'warning' | 'info';

interface AlertBannerProps {
  variant?: AlertVariant;
  title?: string;
  message: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
  live?: boolean;
}

const config: Record<AlertVariant, { icon: React.ReactNode; container: string; text: string }> = {
  error:   { icon: <AlertCircle size={16} aria-hidden="true" />,   container: 'bg-rose-950/40 border-rose-700/60',   text: 'text-rose-200' },
  success: { icon: <CheckCircle2 size={16} aria-hidden="true" />,  container: 'bg-deal-950/30 border-deal-700/60',   text: 'text-deal-200' },
  warning: { icon: <AlertTriangle size={16} aria-hidden="true" />, container: 'bg-amber-950/30 border-amber-600/40', text: 'text-amber-200' },
  info:    { icon: <Info size={16} aria-hidden="true" />,          container: 'bg-brand-950/30 border-brand-700/40', text: 'text-brand-200' },
};

export function AlertBanner({ variant = 'error', title, message, onDismiss, className = '', live = false }: AlertBannerProps) {
  const c = config[variant];
  return (
    <div
      className={`flex items-start gap-3 p-3.5 rounded-xl border ${c.container} ${className}`}
      role={live ? 'alert' : 'status'}
      aria-live={live ? 'assertive' : 'polite'}
    >
      <span className={`shrink-0 mt-0.5 ${c.text}`}>{c.icon}</span>
      <div className={`flex-1 text-sm ${c.text}`}>
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <div className="text-xs opacity-90">{message}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss alert"
          className={`shrink-0 p-1 rounded-lg ${c.text} opacity-60 hover:opacity-100 transition-opacity cursor-pointer`}
        >
          <X size={13} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
