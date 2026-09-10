import React from 'react';
import { cn } from '@/lib/utils';

export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn('animate-pulse rounded-md bg-[#1E2024]', className)} {...props} />
);
