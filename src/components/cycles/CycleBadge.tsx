import React from 'react';
import { RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CycleBadgeProps {
  name: string;
  className?: string;
}

export const CycleBadge: React.FC<CycleBadgeProps> = ({ name, className }) => (
  <span className={cn('inline-flex items-center gap-1 text-xs text-tertiary', className)} title="Ciclo">
    <RotateCw className="w-3 h-3 shrink-0" />
    <span className="truncate max-w-[96px]">{name}</span>
  </span>
);
