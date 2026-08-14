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
            <span className="absolute left-3 text-[#5B616E] pointer-events-none flex items-center justify-center">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full bg-[#0F1012] border border-[#26292F] focus:border-[#5E6AD2] rounded-md py-2 text-sm text-[#F7F8F8] placeholder-[#5B616E] outline-none transition-colors',
              icon ? 'pl-9 pr-3' : 'px-3',
              error && 'border-[#F75555]',
              className
            )}
            {...props}
          />
        </div>
        {error && <span className="text-xs text-[#F75555]">{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';
