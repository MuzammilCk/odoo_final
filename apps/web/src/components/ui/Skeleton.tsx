/**
 * Skeleton — shimmer loading placeholders
 *
 * Prevents CLS (Cumulative Layout Shift) and eliminates centered spinner screens.
 * Use SkeletonCard to fill StatCard areas, SkeletonTable for list/table pages.
 */

import * as React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string;
  height?: string;
}

export function Skeleton({ width, height, className = '', style, ...props }: SkeletonProps) {
  return (
    <div
      className={`shimmer rounded-lg bg-surface-elevated ${className}`}
      style={{ width, height, ...style }}
      aria-hidden="true"
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-surface-card border border-surface-border shadow-card overflow-hidden">
      <div className="h-[2px] bg-surface-elevated w-full" />
      <div className="px-5 py-5 pt-6 space-y-4">
        <div className="flex items-start justify-between">
          <Skeleton height="10px" className="w-24" />
          <Skeleton height="28px" className="w-8 rounded-lg" />
        </div>
        <Skeleton height="32px" className="w-28" />
        <div className="flex items-center gap-2">
          <Skeleton height="10px" className="w-4" />
          <Skeleton height="10px" className="w-32" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  const widths = ['w-full', 'w-5/6', 'w-4/6', 'w-3/4', 'w-2/3'];
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height="12px" className={widths[i % widths.length]} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-2xl bg-surface-card border border-surface-border shadow-card overflow-hidden" aria-hidden="true">
      {/* Header */}
      <div className="border-b border-surface-border px-4 py-3 grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height="10px" className="w-20" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="border-b border-surface-border/50 last:border-none px-4 py-3.5 grid gap-3"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height="12px" className={c === 0 ? 'w-40' : 'w-24'} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonPageHeader() {
  return (
    <div className="flex items-center justify-between" aria-hidden="true">
      <div className="space-y-2">
        <Skeleton height="24px" className="w-48" />
        <Skeleton height="12px" className="w-72" />
      </div>
      <Skeleton height="32px" className="w-32 rounded-xl" />
    </div>
  );
}
