/**
 * Button — enterprise design-system button component
 *
 * Features:
 * - 6 semantic variants (primary, secondary, outline, ghost, danger, success)
 * - 4 sizes (xs, sm, md, lg)
 * - Press physics: active:scale-[0.98] with snappy ease-out
 * - Full focus-visible ring for keyboard navigation (WCAG 2.4.7)
 * - Inline loading state (Loader2 spinner) without layout shift
 * - Icon slots (leftIcon, rightIcon)
 */

import * as React from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:   'bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white shadow-subtle hover:shadow-glow-brand',
  secondary: 'bg-surface-elevated hover:bg-surface-card-hover text-slate-200 hover:text-white border border-surface-border hover:border-surface-border-hover shadow-subtle',
  outline:   'border border-surface-border-light hover:border-surface-border-hover text-slate-300 hover:text-white hover:bg-surface-elevated',
  ghost:     'text-slate-400 hover:text-slate-100 hover:bg-surface-elevated',
  danger:    'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white shadow-subtle',
  success:   'bg-deal-600 hover:bg-deal-500 active:bg-deal-700 text-white shadow-subtle hover:shadow-glow-deal',
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'h-6  px-2   text-[11px] gap-1   rounded-lg',
  sm: 'h-7  px-3   text-xs     gap-1.5 rounded-lg',
  md: 'h-8  px-3.5 text-xs     gap-2   rounded-xl',
  lg: 'h-10 px-5   text-sm     gap-2   rounded-xl',
};

const spinnerSizes: Record<ButtonSize, number> = {
  xs: 10, sm: 12, md: 13, lg: 15,
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      className = '',
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={[
          'relative inline-flex items-center justify-center font-semibold',
          'transition-all duration-[150ms] ease-[cubic-bezier(0.23,1,0.32,1)]',
          'active:scale-[0.98]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-canvas',
          'disabled:opacity-50 disabled:pointer-events-none',
          'cursor-pointer select-none whitespace-nowrap',
          variantClasses[variant],
          sizeClasses[size],
          className,
        ].join(' ')}
        {...props}
      >
        {loading ? (
          <Loader2 size={spinnerSizes[size]} className="animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {children && <span>{children}</span>}
        {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  },
);
Button.displayName = 'Button';
