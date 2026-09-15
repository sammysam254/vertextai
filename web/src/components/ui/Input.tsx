import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-blue-300 mb-2"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'input',
            error && 'border-accent-danger focus:ring-accent-danger',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-accent-danger">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1.5 text-sm text-slate-blue-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
