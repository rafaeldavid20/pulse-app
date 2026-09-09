import React from 'react';
import { cn } from '@/lib/utils';
import { Progress } from '@/lib/hierarchy';

interface EpicProgressProps {
  progress: Progress;
  /** `bar` para el detalle de una épica, `inline` para una fila de lista. */
  variant?: 'bar' | 'inline';
  className?: string;
}

export const EpicProgress: React.FC<EpicProgressProps> = ({
  progress,
  variant = 'bar',
  className,
}) => {
  const { total, closed, percent } = progress;

  if (total === 0) {
    return (
      <span className={cn('text-xs text-[#5B616E]', className)}>Sin sub-issues</span>
    );
  }

  if (variant === 'inline') {
    return (
      <span
        className={cn('inline-flex items-center gap-1.5 shrink-0', className)}
        title={`${closed} de ${total} cerrados`}
      >
        <span className="relative w-8 h-1 rounded-full bg-[#26292F] overflow-hidden">
          <span
            className="absolute inset-y-0 left-0 bg-[#A78BFA] rounded-full transition-all"
            style={{ width: `${percent}%` }}
          />
        </span>
        <span className="font-mono text-[10px] text-[#5B616E] tabular-nums">
          {closed}/{total}
        </span>
      </span>
    );
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#8A8F98]">Progreso</span>
        <span className="font-mono text-[#F7F8F8] tabular-nums">
          {closed}/{total} · {percent}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[#26292F] overflow-hidden">
        <div
          className="h-full bg-[#A78BFA] rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
