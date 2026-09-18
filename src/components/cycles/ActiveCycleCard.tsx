'use client';

import React, { useState } from 'react';
import { Cycle } from '@/types';
import { useIssueStore } from '@/stores/issueStore';
import { Burndown } from './Burndown';
import { daysRemaining, livePointsOf } from '@/lib/cycles';
import { cn, formatDate } from '@/lib/utils';
import { Zap } from 'lucide-react';

interface ActiveCycleCardProps {
  cycle: Cycle;
  /** Velocidad promedio de los últimos 3 ciclos cerrados, como referencia al planear. */
  averageVelocity: number;
}

export const ActiveCycleCard: React.FC<ActiveCycleCardProps> = ({ cycle, averageVelocity }) => {
  const issues = useIssueStore((s) => s.issues);
  const updateIssue = useIssueStore((s) => s.updateIssue);
  const [isDragOver, setIsDragOver] = useState(false);

  const { scope, completed } = livePointsOf(issues, cycle.id);
  const percent = scope > 0 ? Math.round((completed / scope) * 100) : 0;
  const remaining = daysRemaining(cycle);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const issueId = e.dataTransfer.getData('text/plain');
    if (issueId) updateIssue(issueId, { cycleId: cycle.id });
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        'flex flex-col gap-5 p-5 bg-surface border rounded-xl transition-colors',
        isDragOver ? 'border-accent bg-accent/5' : 'border-default'
      )}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent" />
            <h2 className="text-base font-semibold text-primary">{cycle.name}</h2>
            <span className="text-xs text-tertiary">
              {formatDate(cycle.startsAt)} – {formatDate(cycle.endsAt)}
            </span>
          </div>
          <p className="text-xs text-tertiary">
            {remaining === 0 ? 'Termina hoy' : `${remaining} ${remaining === 1 ? 'día restante' : 'días restantes'}`}
          </p>
        </div>

        <div className="flex items-center gap-5 text-xs">
          <div className="flex flex-col items-end">
            <span className="text-tertiary">Scope</span>
            <span className="font-mono text-primary font-semibold">{scope} pts</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-tertiary">Completado</span>
            <span className="font-mono text-status-done font-semibold">
              {completed} pts ({percent}%)
            </span>
          </div>
          {averageVelocity > 0 && (
            <div className="flex flex-col items-end">
              <span className="text-tertiary" title="Promedio de los últimos 3 ciclos cerrados">
                Velocidad ref.
              </span>
              <span className="font-mono text-secondary font-semibold">{averageVelocity} pts</span>
            </div>
          )}
        </div>
      </div>

      <Burndown cycle={cycle} scope={scope} completed={completed} />

      {isDragOver && (
        <p className="text-center text-xs text-accent font-medium -mt-2">Soltar para sumar al ciclo</p>
      )}
    </div>
  );
};
