'use client';

import React, { useMemo, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { IssueList } from '@/components/issues/IssueList';
import { ActiveCycleCard } from '@/components/cycles/ActiveCycleCard';
import { CycleListItem } from '@/components/cycles/CycleListItem';
import { CycleModal } from '@/components/cycles/CycleModal';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';
import { useCycleStore } from '@/stores/cycleStore';
import { currentCycle, upcomingCycles, pastCycles, averageVelocity } from '@/lib/cycles';
import { Button } from '@/components/ui/Button';
import { Plus, RotateCw } from 'lucide-react';

export default function TeamCyclesPage() {
  const activeTeam = useAppStore((s) => s.activeTeam);
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const issues = useIssueStore((s) => s.issues);
  const cycles = useCycleStore((s) => s.cycles);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const teamId = activeTeam?.id || '';
  const teamName = activeTeam?.name || activeWorkspace?.name || 'Orden y Progreso';

  const active = useMemo(() => currentCycle(cycles, teamId), [cycles, teamId]);
  const upcoming = useMemo(() => upcomingCycles(cycles, teamId), [cycles, teamId]);
  const past = useMemo(() => pastCycles(cycles, teamId), [cycles, teamId]);
  const refVelocity = useMemo(() => averageVelocity(past, 3), [past]);

  // Issues del equipo sin ciclo asignado: el "backlog" desde el que se
  // arrastra hacia el ciclo activo o uno próximo.
  const unplannedIssues = useMemo(
    () => issues.filter((i) => i.teamId === teamId && !i.cycleId && i.type !== 'epic'),
    [issues, teamId]
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <Header
        title={`Ciclos de ${teamName}`}
        subtitle={`${cycles.filter((c) => c.teamId === teamId).length} ciclos en total`}
        showViewToggle={false}
      />

      <div className="flex-1 p-4 sm:p-6 overflow-y-auto flex flex-col gap-6">
        {/* Ciclo activo */}
        {active ? (
          <ActiveCycleCard cycle={active} averageVelocity={refVelocity} />
        ) : (
          <div className="flex flex-col items-center justify-center p-8 bg-surface border border-dashed border-default rounded-xl text-center gap-3">
            <RotateCw className="w-6 h-6 text-tertiary" />
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-primary">Este equipo no tiene un ciclo activo</h3>
              <p className="text-xs text-tertiary max-w-sm">
                Creá un ciclo y marcalo como activo, o activá uno de los ciclos próximos.
              </p>
            </div>
            <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setIsCreateOpen(true)}>
              Nuevo ciclo
            </Button>
          </div>
        )}

        {/* Ciclos próximos */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-secondary uppercase tracking-wide">
              Próximos ({upcoming.length})
            </h3>
            <Button
              variant="ghost"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setIsCreateOpen(true)}
            >
              Nuevo ciclo
            </Button>
          </div>
          {upcoming.length === 0 ? (
            <p className="px-1 text-xs text-tertiary">No hay ciclos planeados todavía.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {upcoming.map((cycle) => (
                <CycleListItem key={cycle.id} cycle={cycle} editable />
              ))}
            </div>
          )}
        </section>

        {/* Ciclos pasados */}
        {past.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-secondary uppercase tracking-wide">
              Pasados ({past.length})
            </h3>
            <div className="flex flex-col gap-2">
              {past.map((cycle) => (
                <CycleListItem key={cycle.id} cycle={cycle} editable={false} />
              ))}
            </div>
          </section>
        )}

        {/* Backlog del equipo: fuente para arrastrar issues a un ciclo */}
        <section className="flex flex-col gap-2 mt-2">
          <h3 className="text-xs font-semibold text-secondary uppercase tracking-wide">
            Sin ciclo ({unplannedIssues.length}) — arrastrá un issue al ciclo activo o a uno próximo
          </h3>
          <IssueList issues={unplannedIssues} />
        </section>
      </div>

      <CycleModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} hasActiveCycle={!!active} />
    </div>
  );
}
