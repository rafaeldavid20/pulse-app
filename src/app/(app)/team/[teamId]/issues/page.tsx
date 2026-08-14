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

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <Header
        title={`${activeTeam?.name || 'Engineering'} Issues`}
        subtitle={`${totalCount} issues en total`}
        showViewToggle
      />

      <div className="flex-1 p-6 overflow-y-auto">
        {activeView === 'list' ? (
          <IssueList issues={issues} />
        ) : (
          <IssueBoard />
        )}
      </div>
    </div>
  );
}
