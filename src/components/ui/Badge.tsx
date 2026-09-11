import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'subtle' | 'outline' | 'accent';
  color?: string;
  className?: string;
  onClick?: () => void;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  color,
  className,
  onClick,
}) => {
  return (
    <span
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium transition-colors shrink-0',
        variant === 'default' && 'bg-hover text-secondary border border-default',
        variant === 'subtle' && 'bg-elevated text-secondary',
        variant === 'outline' && 'border border-default text-secondary',
        variant === 'accent' && 'bg-accent/15 text-accent-hover border border-accent/30',
        className
      )}
      style={color ? { backgroundColor: `${color}20`, color, borderColor: `${color}40` } : undefined}
    >
      {children}
    </span>
  );
};
