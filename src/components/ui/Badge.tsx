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
        variant === 'default' && 'bg-[#1E2024] text-[#8A8F98] border border-[#26292F]',
        variant === 'subtle' && 'bg-[#16171A] text-[#8A8F98]',
        variant === 'outline' && 'border border-[#26292F] text-[#8A8F98]',
        variant === 'accent' && 'bg-[#5E6AD2]/15 text-[#707CE6] border border-[#5E6AD2]/30',
        className
      )}
      style={color ? { backgroundColor: `${color}20`, color, borderColor: `${color}40` } : undefined}
    >
      {children}
    </span>
  );
};
