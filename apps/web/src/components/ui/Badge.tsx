/**
 * Badge — standardized status badge with dot indicator
 *
 * Variants cover all business states in DealFlow360:
 * - Quotation statuses (DRAFT, PENDING_APPROVAL, APPROVED, CONFIRMED, UNDER_NEGOTIATION, REJECTED)
 * - Risk levels (LOW, MEDIUM, HIGH)
 * - Fulfillment states (AWAITING_ALLOCATION, PARTIAL_BACKORDER, ALLOCATED)
 * - Invoice statuses (UNPAID, PARTIALLY_PAID, PAID, VOID)
 * - Subscription statuses (ACTIVE, PAUSED, CANCELLED, EXPIRED)
 */

import * as React from 'react';

type BadgeVariant =
  | 'default'
  | 'brand'
  | 'deal'
  | 'amber'
  | 'rose'
  | 'purple'
  | 'blue'
  | 'slate'
  | 'indigo';

type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}

const variantClasses: Record<BadgeVariant, { container: string; dot: string }> = {
  default: { container: 'bg-slate-800/70 text-slate-300 border-slate-700/60',   dot: 'bg-slate-400' },
  brand:   { container: 'bg-brand-500/12 text-brand-300 border-brand-500/25',    dot: 'bg-brand-400' },
  deal:    { container: 'bg-deal-500/12 text-deal-300 border-deal-500/25',        dot: 'bg-deal-400' },
  amber:   { container: 'bg-amber-500/12 text-amber-300 border-amber-500/25',    dot: 'bg-amber-400' },
  rose:    { container: 'bg-rose-500/12 text-rose-300 border-rose-500/25',        dot: 'bg-rose-400' },
  purple:  { container: 'bg-purple-500/12 text-purple-300 border-purple-500/25', dot: 'bg-purple-400' },
  blue:    { container: 'bg-blue-500/12 text-blue-300 border-blue-500/25',        dot: 'bg-blue-400' },
  slate:   { container: 'bg-slate-700/50 text-slate-400 border-slate-600/40',    dot: 'bg-slate-500' },
  indigo:  { container: 'bg-indigo-500/12 text-indigo-300 border-indigo-500/25', dot: 'bg-indigo-400' },
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.5 gap-1',
  md: 'text-xs px-2 py-0.5 gap-1.5',
};

export function Badge({ variant = 'default', size = 'sm', dot = false, className = '', children }: BadgeProps) {
  const v = variantClasses[variant];
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border font-medium',
        v.container,
        sizeClasses[size],
        className,
      ].join(' ')}
    >
      {dot && <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${v.dot}`} />}
      {children}
    </span>
  );
}

// ─── Semantic helpers ───────────────────────────────────────────────────────

const QUOTATION_STATUS_MAP: Record<string, BadgeVariant> = {
  DRAFT:             'slate',
  PENDING_APPROVAL:  'amber',
  APPROVED:          'deal',
  CONFIRMED:         'brand',
  UNDER_NEGOTIATION: 'purple',
  REJECTED:          'rose',
};

const QUOTATION_STATUS_LABELS: Record<string, string> = {
  DRAFT:             'Draft',
  PENDING_APPROVAL:  'Pending Approval',
  APPROVED:          'Approved',
  CONFIRMED:         'Confirmed',
  UNDER_NEGOTIATION: 'Under Negotiation',
  REJECTED:          'Rejected',
};

export function StatusBadge({ status, size = 'sm' }: { status: string; size?: BadgeSize }) {
  const variant = QUOTATION_STATUS_MAP[status] ?? 'default';
  const label = QUOTATION_STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
  return <Badge variant={variant} size={size} dot>{label}</Badge>;
}

const RISK_MAP: Record<string, BadgeVariant> = {
  LOW:    'deal',
  MEDIUM: 'amber',
  HIGH:   'rose',
};

export function RiskBadge({ level, size = 'sm' }: { level: string; size?: BadgeSize }) {
  const variant = RISK_MAP[level] ?? 'default';
  return <Badge variant={variant} size={size} dot>{level}</Badge>;
}

const INVOICE_STATUS_MAP: Record<string, BadgeVariant> = {
  UNPAID:          'rose',
  PARTIALLY_PAID:  'amber',
  PAID:            'deal',
  VOID:            'slate',
};

export function InvoiceStatusBadge({ status, size = 'sm' }: { status: string; size?: BadgeSize }) {
  const variant = INVOICE_STATUS_MAP[status] ?? 'default';
  const label = status.replace(/_/g, ' ');
  return <Badge variant={variant} size={size} dot>{label}</Badge>;
}

const SUBSCRIPTION_STATUS_MAP: Record<string, BadgeVariant> = {
  ACTIVE:    'deal',
  PAUSED:    'amber',
  CANCELLED: 'rose',
  EXPIRED:   'slate',
};

export function SubscriptionStatusBadge({ status, size = 'sm' }: { status: string; size?: BadgeSize }) {
  const variant = SUBSCRIPTION_STATUS_MAP[status] ?? 'default';
  return <Badge variant={variant} size={size} dot>{status}</Badge>;
}

const FULFILLMENT_STATE_MAP: Record<string, BadgeVariant> = {
  AWAITING_ALLOCATION: 'amber',
  PARTIAL_BACKORDER:   'rose',
  ALLOCATED:           'deal',
};

const FULFILLMENT_LABELS: Record<string, string> = {
  AWAITING_ALLOCATION: 'Awaiting Split',
  PARTIAL_BACKORDER:   'Backorder Split',
  ALLOCATED:           'Allocated',
};

export function FulfillmentStateBadge({ state, size = 'sm' }: { state: string; size?: BadgeSize }) {
  const variant = FULFILLMENT_STATE_MAP[state] ?? 'default';
  const label = FULFILLMENT_LABELS[state] ?? state.replace(/_/g, ' ');
  return <Badge variant={variant} size={size} dot>{label}</Badge>;
}
