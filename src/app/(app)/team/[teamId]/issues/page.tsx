'use client';

import React from 'react';
import { Header } from '@/components/layout/Header';
import { IssueList } from '@/components/issues/IssueList';
import { IssueBoard } from '@/components/issues/IssueBoard';
import { TimelineView } from '@/components/timeline/TimelineView';
import { CalendarView } from '@/components/calendar/CalendarView';
import { useIssues } from '@/hooks/useIssues';
import { useAppStore } from '@/stores/appStore';
import { usePqlReady } from '@/hooks/usePqlReady';
import { useIssueStore } from '@/stores/issueStore';

export default function TeamIssuesPage() {
  const { teamIssues, totalCount } = useIssues();
  const pqlReady = usePqlReady();
  const loaded = useIssueStore(s => s.issuesLoaded);
  const error = useIssueStore(s => s.issuesError);
  const activeView = useAppStore((s) => s.activeView);
  const activeTeam = useAppStore((s) => s.activeTeam);
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);

  const teamName = activeTeam?.name || activeWorkspace?.name || 'Orden y Progreso';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <Header
        title={`${teamName} Issues`}
        subtitle={error ? 'Error al cargar issues' : !loaded ? 'Cargando issues…' : pqlReady ? `${totalCount} issues en total` : 'Esperando consulta válida'}
        showViewToggle
        showTimelineOption
        showCalendarOption
        showFilterBar
      />

      <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
        {activeView === 'list' ? (
          <IssueList issues={teamIssues} />
        ) : activeView === 'board' ? (
          <IssueBoard />
        ) : activeView === 'calendar' ? (
          <CalendarView />
        ) : (
          <TimelineView />
        )}
      </div>
    </div>
  );
}
