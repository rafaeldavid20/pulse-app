'use client';

import React, { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { IssueList } from '@/components/issues/IssueList';
import { IssueBoard } from '@/components/issues/IssueBoard';
import { CyclePlanningPanel } from '@/components/cycles/CyclePlanningPanel';
import { useCycleStore } from '@/stores/cycleStore';
import { useIssueStore } from '@/stores/issueStore';
import { useAppStore } from '@/stores/appStore';
import { daysRemaining, livePointsOf } from '@/lib/cycles';
import { formatDate } from '@/lib/utils';
import { ArrowLeft, RotateCw } from 'lucide-react';

export default function CycleDetailPage({
  params,
}: {
  params: Promise<{ teamId: string; cycleId: string }>;
}) {
  const { teamId, cycleId } = use(params);
  const cycles = useCycleStore((s) => s.cycles);
  const issues = useIssueStore((s) => s.issues);
  const issuesLoaded = useIssueStore((s) => s.issuesLoaded);
  const activeView = useAppStore((s) => s.activeView);

  const cycle = cycles.find((c) => c.id === cycleId);

  const cycleIssues = useMemo(
    () => (cycle ? issues.filter((i) => i.cycleId === cycle.id && i.type !== 'epic') : []),
    [issues, cycle]
  );

  const backlogIssues = useMemo(
    () => issues.filter((i) => i.teamId === teamId && !i.cycleId && i.type !== 'epic'),
    [issues, teamId]
  );

  const live = cycle ? livePointsOf(issues, cycle.id) : { scope: 0, completed: 0 };

  /**
   * Scope al entrar a esta página de planeación, para comparar contra el
   * actual mientras se arrastran issues en esta misma sesión. No es el
   * snapshot de scope creep entre ciclos cerrados que agrega E5 — este solo
   * vive mientras el panel está abierto.
   */
  const [capturedInitialScope, setCapturedInitialScope] = useState<number | null>(null);
  useEffect(() => {
    if (cycle && issuesLoaded && capturedInitialScope === null) {
      setCapturedInitialScope(live.scope);
    }
  }, [cycle, issuesLoaded, live.scope, capturedInitialScope]);

  if (!cycle) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-secondary gap-4">
        <RotateCw className="w-10 h-10 text-accent" />
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-primary">Ciclo no encontrado</h2>
          <p className="text-xs text-secondary">El ciclo solicitado no existe o fue eliminado.</p>
        </div>
        <Link
          href={`/team/${teamId}/cycles`}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent text-white text-xs font-semibold rounded-md hover:bg-accent-hover transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver a ciclos</span>
        </Link>
      </div>
    );
  }

  const initialScope = capturedInitialScope ?? live.scope;
  const scopeDelta = live.scope - initialScope;
  const percent = live.scope > 0 ? Math.round((live.completed / live.scope) * 100) : 0;
  const remaining = daysRemaining(cycle);
  const editable = cycle.status !== 'completed';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <Header
        title={cycle.name}
        subtitle={`${formatDate(cycle.startsAt)} – ${formatDate(cycle.endsAt)}`}
        showViewToggle
        showFilterBar
      />

      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Resumen del ciclo: fijo arriba, no scrollea con el resto. */}
        <div className="sticky top-0 z-10 border-b border-subtle bg-base px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link
            href={`/team/${teamId}/cycles`}
            className="inline-flex items-center gap-1.5 text-xs text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Ciclos</span>
          </Link>

          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-tertiary">Scope inicial vs actual</span>
            <span className="font-mono text-sm text-primary font-semibold">
              {initialScope} pts
              {scopeDelta !== 0 && (
                <span className={scopeDelta > 0 ? 'text-priority-urgent' : 'text-status-done'}>
                  {' '}
                  ({scopeDelta > 0 ? '+' : ''}
                  {scopeDelta})
                </span>
              )}{' '}
              → {live.scope} pts
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-tertiary">Completado</span>
            <span className="font-mono text-sm text-status-done font-semibold">
              {live.completed}/{live.scope} pts ({percent}%)
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-tertiary">Días restantes</span>
            <span className="font-mono text-sm text-primary font-semibold">
              {cycle.status === 'completed'
                ? 'Ciclo cerrado'
                : `${remaining} ${remaining === 1 ? 'día' : 'días'}`}
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-6 flex flex-col gap-6">
          <CyclePlanningPanel
            cycle={cycle}
            cycleIssues={cycleIssues}
            backlogIssues={backlogIssues}
            editable={editable}
          />

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-primary">
              Issues del ciclo ({cycleIssues.length})
            </h3>
            {activeView === 'list' ? (
              <IssueList issues={cycleIssues} />
            ) : (
              <IssueBoard issues={cycleIssues} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
