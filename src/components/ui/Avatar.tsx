import React from 'react';
import { cn, getInitials } from '@/lib/utils';

interface AvatarProps {
  name?: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ name, src, size = 'md', className }) => {
  const sizeClasses = {
    sm: 'w-5 h-5 text-[10px]',
    md: 'w-7 h-7 text-xs',
    lg: 'w-9 h-9 text-sm',
  };

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        className={cn(
          'rounded-full object-cover border border-default bg-elevated',
          sizeClasses[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full bg-default text-primary font-medium flex items-center justify-center shrink-0 border border-strong',
        sizeClasses[size],
        className
      )}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
};
