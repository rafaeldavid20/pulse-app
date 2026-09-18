'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Cycle } from '@/types';
import { useIssueStore } from '@/stores/issueStore';
import { useCycleStore } from '@/stores/cycleStore';
import { livePointsOf } from '@/lib/cycles';
import { cn, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Calendar, CheckCircle2, Zap, Repeat } from 'lucide-react';

interface CycleListItemProps {
  cycle: Cycle;
  /** Ciclos `upcoming` aceptan drop de issues y se pueden activar manualmente
   *  (no hay auto-scheduler todavía — eso es E4). Los `completed` son de solo lectura. */
  editable: boolean;
}

export const CycleListItem: React.FC<CycleListItemProps> = ({ cycle, editable }) => {
  const issues = useIssueStore((s) => s.issues);
  const updateIssue = useIssueStore((s) => s.updateIssue);
  const updateCycle = useCycleStore((s) => s.updateCycle);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activating, setActivating] = useState(false);

  const live = livePointsOf(issues, cycle.id);
  const scope = cycle.snapshot?.scope ?? live.scope;
  const completed = cycle.snapshot?.completed ?? live.completed;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!editable) return;
    const issueId = e.dataTransfer.getData('text/plain');
    if (issueId) updateIssue(issueId, { cycleId: cycle.id });
  };

  const handleActivate = async () => {
    setActivating(true);
    try {
      await updateCycle(cycle.id, { status: 'active' });
    } finally {
      setActivating(false);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        if (!editable) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-3 bg-surface border rounded-lg transition-colors',
        isDragOver ? 'border-accent bg-accent/5' : 'border-subtle'
      )}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <Link
          href={`/team/${cycle.teamId}/cycles/${cycle.id}`}
          className="text-sm font-medium text-primary truncate hover:text-accent hover:underline w-fit"
        >
          {cycle.name}
        </Link>
        <span className="flex items-center gap-1 text-xs text-tertiary">
          <Calendar className="w-3 h-3" />
          {formatDate(cycle.startsAt)} – {formatDate(cycle.endsAt)}
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0 text-xs">
        {scope > 0 && (
          <span className="flex items-center gap-1 text-secondary">
            <CheckCircle2 className="w-3.5 h-3.5 text-status-done" />
            {completed}/{scope} pts
          </span>
        )}
        {cycle.snapshot && (
          <span className="flex items-center gap-1 text-secondary" title="Velocidad de este ciclo">
            <Zap className="w-3.5 h-3.5 text-tertiary" />
            {cycle.snapshot.velocity} pts
          </span>
        )}
        {cycle.snapshot && (
          <span
            className="flex items-center gap-1 text-secondary"
            title="% de los puntos de este ciclo que no se completaron y pasaron al siguiente"
          >
            <Repeat className="w-3.5 h-3.5 text-tertiary" />
            {cycle.snapshot.carryover}% carryover
          </span>
        )}
        {editable && (
          <Button size="sm" variant="secondary" onClick={handleActivate} disabled={activating}>
            {activating ? 'Activando...' : 'Activar'}
          </Button>
        )}
      </div>
    </div>
  );
};
