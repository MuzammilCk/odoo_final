/**
 * Card — composable enterprise card container
 *
 * Anatomy: Card > CardHeader > (CardTitle + CardDescription) + CardContent + CardFooter
 * Features: inner top-border highlight, optical shadow, smooth hover elevation, backdrop blur optional
 */

import * as React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  variant?: 'default' | 'elevated' | 'flat';
}

export function Card({ hover = false, variant = 'default', className = '', children, ...props }: CardProps) {
  const base = 'rounded-2xl border border-surface-border overflow-hidden';
  const variants = {
    default:  'bg-surface-card shadow-card',
    elevated: 'bg-surface-elevated shadow-elevated',
    flat:     'bg-surface-base',
  };
  const hoverClass = hover
    ? 'transition-all duration-[200ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-surface-border-light hover:shadow-elevated hover:-translate-y-px'
    : '';
  return (
    <div className={`${base} ${variants[variant]} ${hoverClass} ${className}`} {...props}>
      {children}
    </div>
  );
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  bordered?: boolean;
}

export function CardHeader({ bordered = false, className = '', children, ...props }: CardHeaderProps) {
  return (
    <div
      className={`px-5 py-4 ${bordered ? 'border-b border-surface-border' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className = '', children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={`text-sm font-semibold text-slate-100 tracking-tight ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className = '', children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-xs text-slate-400 mt-0.5 ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-5 py-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`px-5 py-3 border-t border-surface-border flex items-center gap-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
