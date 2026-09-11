'use client';

import React from 'react';
import { Zap, Plus } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { EpicCard } from '@/components/epics/EpicCard';
import { Button } from '@/components/ui/Button';
import { useIssues } from '@/hooks/useIssues';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';
import { progressFrom } from '@/lib/hierarchy';

export default function TeamEpicsPage() {
  const { epics } = useIssues();
  const activeTeam = useAppStore((s) => s.activeTeam);
  const setCreateIssueOpen = useAppStore((s) => s.setCreateIssueOpen);
  const setDefaultIssueType = useIssueStore((s) => s.setDefaultIssueType);

  const openEpicCreation = () => {
    setDefaultIssueType('epic');
    setCreateIssueOpen(true);
  };

  const overall = progressFrom(epics.flatMap((e) => e.children));

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <Header
        title={`Épicas de ${activeTeam?.name || 'tu equipo'}`}
        subtitle={
          epics.length > 0
            ? `${epics.length} épicas · ${overall.closed}/${overall.total} issues cerrados`
            : undefined
        }
        showViewToggle={false}
      />

      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-type-epic" />
            <h2 className="text-base font-semibold text-primary">Épicas</h2>
          </div>

          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={openEpicCreation}
          >
            Nueva Épica
          </Button>
        </div>

        {epics.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {epics.map(({ epic, children }) => (
              <EpicCard key={epic.id} epic={epic} issues={children} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 bg-surface border border-default rounded-2xl text-center gap-4 my-8">
            <div className="w-12 h-12 rounded-xl bg-type-epic/15 flex items-center justify-center text-type-epic">
              <Zap className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-1 max-w-sm">
              <h3 className="text-base font-bold text-primary">Todavía no hay épicas</h3>
              <p className="text-xs text-secondary">
                Una épica agrupa historias y tareas bajo un mismo objetivo. Es un issue como
                cualquier otro: tiene identificador, estado y comentarios, pero además lleva el
                progreso de todo lo que cuelga de ella.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={openEpicCreation}
              className="mt-2"
            >
              Crear Primera Épica
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
