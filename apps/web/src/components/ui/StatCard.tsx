/**
 * StatCard — KPI metric card with icon badge, trend indicator, and tabular numbers
 *
 * Replaces the raw colored-top-stripe cards with a refined hierarchy:
 * - Subtle icon badge (not an emoji)
 * - Monospace tabular number (not a shrieking neon color)
 * - Contextual footnote with optional trend arrow
 * - Optional accent bar (top or left) for quick visual scanning
 */

import * as React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

type AccentColor = 'brand' | 'deal' | 'amber' | 'rose' | 'blue' | 'purple' | 'slate';

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  footnote?: string;
  footnoteIcon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  accent?: AccentColor;
  className?: string;
  action?: React.ReactNode;
}

const accentTop: Record<AccentColor, string> = {
  brand:  'bg-brand-500',
  deal:   'bg-deal-500',
  amber:  'bg-amber-500',
  rose:   'bg-rose-500',
  blue:   'bg-blue-500',
  purple: 'bg-purple-500',
  slate:  'bg-slate-600',
};

const iconBg: Record<AccentColor, string> = {
  brand:  'bg-brand-500/10 text-brand-400 border-brand-500/20',
  deal:   'bg-deal-500/10 text-deal-400 border-deal-500/20',
  amber:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  rose:   'bg-rose-500/10 text-rose-400 border-rose-500/20',
  blue:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  slate:  'bg-slate-700/50 text-slate-400 border-slate-600/40',
};

export function StatCard({
  title,
  value,
  icon,
  footnote,
  footnoteIcon,
  trend,
  trendValue,
  accent = 'brand',
  className = '',
  action,
}: StatCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-deal-400' : trend === 'down' ? 'text-rose-400' : 'text-slate-500';

  return (
    <div
      className={[
        'relative rounded-2xl bg-surface-card border border-surface-border shadow-card overflow-hidden',
        'transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]',
        'hover:border-surface-border-light hover:shadow-elevated hover:-translate-y-px',
        className,
      ].join(' ')}
    >
      {/* Accent bar */}
      <div className={`absolute top-0 left-0 h-[2px] w-full ${accentTop[accent]} opacity-70`} />

      <div className="px-5 py-5 pt-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
          {icon && (
            <span className={`p-1.5 rounded-lg border text-sm ${iconBg[accent]}`} aria-hidden="true">
              {icon}
            </span>
          )}
        </div>

        {/* Value */}
        <p className="text-3xl font-bold text-slate-100 tracking-tight tabular-numbers font-mono leading-none">
          {value}
        </p>

        {/* Footnote row */}
        {(footnote || trend) && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              {footnoteIcon && <span aria-hidden="true">{footnoteIcon}</span>}
              {footnote && <span>{footnote}</span>}
            </div>
            {trend && (
              <div className={`flex items-center gap-1 text-xs font-semibold ${trendColor}`}>
                <TrendIcon size={12} aria-hidden="true" />
                {trendValue && <span>{trendValue}</span>}
              </div>
            )}
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
