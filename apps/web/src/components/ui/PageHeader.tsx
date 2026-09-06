/**
 * PageHeader — standardized page header
 *
 * Provides consistent page structure: back link, title, badge, subtitle, actions.
 */

import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  badge?: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  backTo?: string;
  backLabel?: string;
  className?: string;
}

export function PageHeader({ title, badge, description, actions, backTo, backLabel = 'Back', className = '' }: PageHeaderProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {backTo && (
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors duration-150 group"
        >
          <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform duration-150" aria-hidden="true" />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight leading-tight">
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="text-xs text-slate-400 mt-1">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
