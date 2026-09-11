import React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, error, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1">
        <div className="relative flex items-center w-full">
          {icon && (
            <span className="absolute left-3 text-tertiary pointer-events-none flex items-center justify-center">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full bg-surface border border-default focus:border-accent rounded-md py-2 text-sm text-primary placeholder-tertiary outline-none transition-colors',
              icon ? 'pl-9 pr-3' : 'px-3',
              error && 'border-priority-urgent',
              className
            )}
            {...props}
          />
        </div>
        {error && <span className="text-xs text-priority-urgent">{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';
