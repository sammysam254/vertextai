import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant =
  | 'in-call'
  | 'available'
  | 'waiting'
  | 'resolved'
  | 'offline'
  | 'default';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

export function Badge({
  className,
  variant = 'default',
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    'in-call': 'badge-in-call',
    available: 'badge-available',
    waiting: 'badge-waiting',
    resolved: 'badge-resolved',
    offline: 'badge-offline',
    default: 'bg-navy-dark-elevated text-slate-blue-300 border border-navy-dark-border',
  };

  const dotVariantStyles = {
    'in-call': 'status-dot-in-call',
    available: 'status-dot-available',
    waiting: 'status-dot-waiting',
    resolved: 'status-dot-resolved',
    offline: 'status-dot-offline',
    default: 'bg-slate-blue-500',
  };

  return (
    <div
      className={cn('badge', variantStyles[variant], className)}
      {...props}
    >
      {dot && <span className={cn('status-dot', dotVariantStyles[variant])} />}
      {children}
    </div>
  );
}
