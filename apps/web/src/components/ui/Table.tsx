/**
 * Table — enterprise data table primitive components
 *
 * Usage:
 *   <Table>
 *     <TableHeader>
 *       <TableRow>
 *         <TableHead>Name</TableHead>
 *         <TableHead numeric>Amount</TableHead>
 *       </TableRow>
 *     </TableHeader>
 *     <TableBody>
 *       <TableRow hoverable>
 *         <TableCell>Acme Corp</TableCell>
 *         <TableCell numeric>$1,234.56</TableCell>
 *       </TableRow>
 *     </TableBody>
 *   </Table>
 */

import * as React from 'react';

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  compact?: boolean;
}

export function Table({ compact = false, className = '', children, ...props }: TableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={`w-full text-left ${compact ? 'text-xs' : 'text-sm'} ${className}`}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ className = '', children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={`border-b border-surface-border bg-surface-base/60 ${className}`}
      {...props}
    >
      {children}
    </thead>
  );
}

export function TableBody({ className = '', children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`divide-y divide-surface-border/50 ${className}`} {...props}>
      {children}
    </tbody>
  );
}

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  hoverable?: boolean;
  selected?: boolean;
}

export function TableRow({ hoverable = false, selected = false, className = '', children, ...props }: TableRowProps) {
  return (
    <tr
      className={[
        'transition-colors duration-100',
        hoverable ? 'cursor-pointer hover:bg-surface-elevated/40' : '',
        selected ? 'bg-brand-500/5' : '',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </tr>
  );
}

interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
}

export function TableHead({ numeric = false, className = '', children, ...props }: TableHeadProps) {
  return (
    <th
      className={[
        'px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400',
        numeric ? 'text-right' : 'text-left',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </th>
  );
}

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
  mono?: boolean;
  muted?: boolean;
}

export function TableCell({ numeric = false, mono = false, muted = false, className = '', children, ...props }: TableCellProps) {
  return (
    <td
      className={[
        'px-4 py-3',
        numeric ? 'text-right tabular-numbers' : 'text-left',
        mono ? 'font-mono text-xs' : '',
        muted ? 'text-slate-400' : 'text-slate-200',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </td>
  );
}
