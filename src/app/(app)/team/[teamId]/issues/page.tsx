'use client';

import React from 'react';
import { Header } from '@/components/layout/Header';
import { IssueList } from '@/components/issues/IssueList';
import { IssueBoard } from '@/components/issues/IssueBoard';
import { useIssues } from '@/hooks/useIssues';
import { useAppStore } from '@/stores/appStore';

export default function TeamIssuesPage() {
  const { issues, totalCount } = useIssues();
  const activeView = useAppStore((s) => s.activeView);
  const activeTeam = useAppStore((s) => s.activeTeam);
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);

  const teamName = activeTeam?.name || activeWorkspace?.name || 'Orden y Progreso';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <Header
        title={`${teamName} Issues`}
        subtitle={`${totalCount} issues en total`}
        showViewToggle
      />

      <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
        {activeView === 'list' ? (
          <IssueList issues={issues} />
        ) : (
          <IssueBoard />
        )}
      </div>
    </div>
  );
}
