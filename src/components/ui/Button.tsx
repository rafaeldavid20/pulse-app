import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  className,
  disabled,
  ...props
}) => {
  const sizeClasses = {
    sm: 'px-2.5 py-1 text-xs gap-1.5 h-7',
    md: 'px-3.5 py-1.5 text-sm gap-2 h-9',
    lg: 'px-4 py-2 text-base gap-2.5 h-11',
  };

  const variantClasses = {
    primary:
      'bg-accent hover:bg-accent-hover text-white font-medium shadow-sm active:scale-[0.98]',
    secondary:
      'bg-hover hover:bg-active text-primary border border-default font-medium active:scale-[0.98]',
    ghost:
      'bg-transparent hover:bg-hover text-secondary hover:text-primary',
    danger:
      'bg-priority-urgent/15 hover:bg-priority-urgent/25 text-priority-urgent border border-priority-urgent/30 font-medium',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md transition-all outline-none disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
};
