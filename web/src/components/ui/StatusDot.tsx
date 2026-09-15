import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type StatusDotVariant =
  | 'in-call'
  | 'available'
  | 'waiting'
  | 'resolved'
  | 'offline';

export interface StatusDotProps extends HTMLAttributes<HTMLSpanElement> {
  variant: StatusDotVariant;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

export function StatusDot({
  className,
  variant,
  size = 'md',
  pulse = false,
  ...props
}: StatusDotProps) {
  const variantStyles = {
    'in-call': 'status-dot-in-call',
    available: 'status-dot-available',
    waiting: 'status-dot-waiting',
    resolved: 'status-dot-resolved',
    offline: 'status-dot-offline',
  };

  const sizeStyles = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
  };

  return (
    <span className="relative inline-flex">
      <span
        className={cn(
          'status-dot',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
      {pulse && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
            variantStyles[variant]
          )}
        />
      )}
    </span>
  );
}
