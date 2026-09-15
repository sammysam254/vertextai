import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { Panel } from './Panel';
import { cn } from '@/lib/utils';

export interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  subtitle?: string;
  trend?: {
    value: number;
    label: string;
    direction: 'up' | 'down';
  };
  className?: string;
  children?: ReactNode;
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  subtitle,
  trend,
  className,
  children,
}: MetricCardProps) {
  return (
    <Panel className={cn('metric-card', className)}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="metric-label">{label}</p>
          {subtitle && (
            <p className="text-xs text-slate-blue-500 mt-1">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className="bg-accent-primary/10 p-2 rounded-lg">
            <Icon className="h-5 w-5 text-accent-primary" />
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between">
        <p className="metric-value">{value}</p>
        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 text-sm font-medium',
              trend.direction === 'up' ? 'text-accent-success' : 'text-accent-danger'
            )}
          >
            <span>{trend.direction === 'up' ? '↑' : '↓'}</span>
            <span>{Math.abs(trend.value)}</span>
            <span className="text-slate-blue-500 font-normal ml-1">
              {trend.label}
            </span>
          </div>
        )}
      </div>

      {children && <div className="mt-4 pt-4 border-t border-navy-dark-border">{children}</div>}
    </Panel>
  );
}
