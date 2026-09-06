/**
 * Input — accessible form input with icon slots and error state
 *
 * Web Interface Guidelines compliance:
 * - Connected label via htmlFor (never placeholder-only labels)
 * - autocomplete attribute required on all inputs
 * - spellCheck=false on code/email/identifier fields
 * - Error text displayed below field with aria-describedby
 * - Never blocks paste
 */

import * as React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  prefixIcon?: React.ReactNode;
  suffix?: React.ReactNode;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, prefixIcon, suffix, containerClassName = '', className = '', id, ...props }, ref) => {
    const inputId = id ?? `input-${Math.random().toString(36).slice(2, 7)}`;
    const errorId = error ? `${inputId}-error` : undefined;
    const hintId = hint ? `${inputId}-hint` : undefined;

    return (
      <div className={`space-y-1.5 ${containerClassName}`}>
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative">
          {prefixIcon && (
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              {prefixIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
            aria-invalid={error ? 'true' : undefined}
            className={[
              'w-full bg-surface-base border rounded-xl text-sm text-slate-100 placeholder-slate-500',
              'transition-all duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-0',
              error
                ? 'border-rose-500/60 focus-visible:border-rose-500 focus-visible:ring-rose-500/40'
                : 'border-surface-border focus-visible:border-brand-500',
              prefixIcon ? 'pl-9' : 'pl-3.5',
              suffix ? 'pr-10' : 'pr-3.5',
              'py-2',
              className,
            ].join(' ')}
            {...props}
          />
          {suffix && (
            <span className="absolute inset-y-0 right-0 pr-3 flex items-center">
              {suffix}
            </span>
          )}
        </div>
        {error && (
          <p id={errorId} className="text-xs text-rose-400 flex items-center gap-1">
            <span aria-hidden="true">·</span> {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="text-xs text-slate-500">{hint}</p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

// ─── Select ───────────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, containerClassName = '', className = '', id, children, ...props }, ref) => {
    const selectId = id ?? `select-${Math.random().toString(36).slice(2, 7)}`;

    return (
      <div className={`space-y-1.5 ${containerClassName}`}>
        {label && (
          <label htmlFor={selectId} className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={[
            'w-full bg-surface-base border rounded-xl text-sm text-slate-200 px-3.5 py-2',
            'transition-all duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50',
            error
              ? 'border-rose-500/60 focus-visible:border-rose-500'
              : 'border-surface-border focus-visible:border-brand-500',
            className,
          ].join(' ')}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    );
  },
);
Select.displayName = 'Select';

// ─── Textarea ──────────────────────────────────────────────────────────────────

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, containerClassName = '', className = '', id, ...props }, ref) => {
    const textareaId = id ?? `textarea-${Math.random().toString(36).slice(2, 7)}`;

    return (
      <div className={`space-y-1.5 ${containerClassName}`}>
        {label && (
          <label htmlFor={textareaId} className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={[
            'w-full bg-surface-base border rounded-xl text-sm text-slate-100 placeholder-slate-500 px-3.5 py-2.5',
            'transition-all duration-150 resize-none',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50',
            error
              ? 'border-rose-500/60 focus-visible:border-rose-500'
              : 'border-surface-border focus-visible:border-brand-500',
            className,
          ].join(' ')}
          {...props}
        />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';
