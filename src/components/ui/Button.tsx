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
      'bg-[#5E6AD2] hover:bg-[#707CE6] text-white font-medium shadow-sm active:scale-[0.98]',
    secondary:
      'bg-[#1E2024] hover:bg-[#26292E] text-[#F7F8F8] border border-[#26292F] font-medium active:scale-[0.98]',
    ghost:
      'bg-transparent hover:bg-[#1E2024] text-[#8A8F98] hover:text-[#F7F8F8]',
    danger:
      'bg-[#F75555]/15 hover:bg-[#F75555]/25 text-[#F75555] border border-[#F75555]/30 font-medium',
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
