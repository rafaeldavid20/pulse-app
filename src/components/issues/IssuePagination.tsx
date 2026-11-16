'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { loadPreviousTeamIssues } from '@/lib/firestore';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';
import type { Issue } from '@/types';

/** Pages always cover the active team, even when the current view is filtered. */
export function IssuePagination() {
  const teamId = useAppStore(s => s.activeTeam?.id);
  const workspaceId = useAppStore(s => s.activeWorkspace?.id);
  const issues = useIssueStore(s => s.issues);
  const addHistoricalIssues = useIssueStore(s => s.addHistoricalIssues);
  const scope = `${workspaceId ?? ''}:${teamId ?? ''}`;
  const [state, setState] = useState<{ scope: string; hasOlder: boolean; cursor?: Issue; loading: boolean }>({ scope, hasOlder: true, loading: false });
  const [previousScope, setPreviousScope] = useState(scope);
  if (previousScope !== scope) {
    setPreviousScope(scope);
    setState({ scope, hasOlder: true, loading: false });
  }
  const generation = useRef(0);
  useEffect(() => { const counter = generation; counter.current++; return () => { counter.current++; }; }, [scope]);
  const current = state.scope === scope ? state : { scope, hasOlder: true, loading: false, cursor: undefined };

  async function loadOlder() {
    if (!teamId || !workspaceId || current.loading) return;
    const cursor = current.cursor ?? [...issues].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
    const requestedGeneration = generation.current;
    setState({ ...current, loading: true });
    try {
      const page = await loadPreviousTeamIssues(workspaceId, teamId, cursor);
      if (generation.current !== requestedGeneration || useAppStore.getState().activeTeam?.id !== teamId || useAppStore.getState().activeWorkspace?.id !== workspaceId) return;
      addHistoricalIssues(page, true);
      setState({ scope, hasOlder: page.length === 50, cursor: page.at(-1) || cursor, loading: false });
    } catch {
      if (generation.current === requestedGeneration) {
        setState({ ...current, loading: false });
        toast.error('No se pudieron cargar issues anteriores. Volvé a intentarlo.');
      }
    }
  }

  if (!teamId || !current.hasOlder) return null;
  return <div className="flex justify-center py-4"><Button size="sm" variant="secondary" disabled={current.loading} onClick={loadOlder}>{current.loading ? 'Cargando…' : 'Cargar anteriores'}</Button></div>;
}
