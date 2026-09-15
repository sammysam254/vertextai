import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ className, hover = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('panel', hover && 'panel-hover', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Panel.displayName = 'Panel';
