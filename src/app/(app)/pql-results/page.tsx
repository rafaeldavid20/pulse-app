'use client';

import { useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { StatusBadge } from '@/components/issues/StatusBadge';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import { usePqlContext } from '@/hooks/usePqlContext';
import { execute } from '@/lib/pql';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';
import { usePqlSearchStore } from '@/stores/pqlSearchStore';

export default function PqlResultsPage() {
  const search = usePqlSearchStore(s => s.search);
  const workspaceId = useAppStore(s => s.activeWorkspace?.id);
  const actorId = useAppStore(s => s.workspaceUserId);
  const issues = useIssueStore(s => s.issues);
  const loaded = useIssueStore(s => s.issuesLoaded);
  const error = useIssueStore(s => s.issuesError);
  const setPeek = useIssueStore(s => s.setPeekIssueId);
  const context = usePqlContext();
  const allowed = !!search && search.workspaceId === workspaceId && search.actorId === actorId;
  const result = useMemo(() => {
    if (!allowed || !search || !workspaceId || !loaded || error) return null;
    const teamId = search.teamId && context.teams.some(t => t.id === search.teamId) ? search.teamId : undefined;
    return execute(search.query, issues.filter(i => i.workspaceId === workspaceId), { ...context, teamId, now: new Date().toISOString() });
  }, [allowed, search, workspaceId, loaded, error, issues, context]);
  return <div className="flex-1 flex flex-col h-full overflow-hidden">
    <Header title="Resultados PQL" showViewToggle={false} showSearch={false} showCreateButton={false} />
    <main className="flex-1 overflow-auto p-6 space-y-4">
      {!allowed ? <p role="status">La consulta ya no está disponible para este workspace. Abrí la paleta y ejecutala de nuevo.</p>
        : <><p className="font-mono text-sm text-secondary break-all">{search?.query}</p>
          {!loaded ? <p role="status">Cargando issues…</p> : error ? <p role="alert">{error}</p>
            : result && !result.ok ? <p role="alert">Línea {result.diagnostic.line}, columna {result.diagnostic.column}: {result.diagnostic.message}</p>
            : result?.ok ? <><p role="status" className="text-sm text-secondary">{result.issues.length} resultados</p>
              <ul className="divide-y divide-subtle border border-default rounded-lg">{result.issues.map(issue => <li key={issue.id}><button type="button" className="w-full flex items-center gap-3 p-3 text-left hover:bg-hover" onClick={() => setPeek(issue.id)}><span className="font-mono text-xs text-tertiary">{issue.identifier}</span><StatusBadge status={issue.status} /><span className="flex-1 text-sm">{issue.title}</span><PriorityBadge priority={issue.priority} /></button></li>)}</ul></> : null}
        </>}
    </main>
  </div>;
}
