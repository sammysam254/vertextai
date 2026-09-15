import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { User } from 'lucide-react';

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fallback?: string;
}

export function Avatar({
  className,
  src,
  alt,
  size = 'md',
  fallback,
  ...props
}: AvatarProps) {
  const sizeStyles = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center rounded-full bg-navy-dark-elevated text-slate-blue-300 font-medium overflow-hidden',
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {src ? (
        <img
          src={src}
          alt={alt || 'Avatar'}
          className="w-full h-full object-cover"
        />
      ) : fallback ? (
        <span>{getInitials(fallback)}</span>
      ) : (
        <User className="w-1/2 h-1/2" />
      )}
    </div>
  );
}
