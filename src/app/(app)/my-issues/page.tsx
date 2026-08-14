'use client';

import React from 'react';
import { Header } from '@/components/layout/Header';
import { IssueList } from '@/components/issues/IssueList';
import { useIssues } from '@/hooks/useIssues';
import { useAuth } from '@/hooks/useAuth';

export default function MyIssuesPage() {
  const { allIssues } = useIssues();
  const { user } = useAuth();

  const myIssues = allIssues.filter(
    (i) => i.assigneeId === (user?.uid || 'demo-user-123')
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <Header
        title="Mis Issues"
        subtitle={`${myIssues.length} asignados a ti`}
        showViewToggle={false}
      />

      <div className="flex-1 p-6 overflow-y-auto">
        <IssueList issues={myIssues} />
      </div>
    </div>
  );
}
