'use client';

import { useCallback, useEffect } from 'react';
import { listAgents } from '@/lib/firestore';
import { useAppStore } from '@/stores/appStore';
import { useLiveQuery } from './useLiveQuery';

/** A single workspace-scoped authorized catalog shared by PQL consumers. */
export function usePqlAgentCatalogSync(userId: string | undefined) {
  const workspaceId = useAppStore(s => s.activeWorkspace?.id);
  const workspaceUserId = useAppStore(s => s.workspaceUserId);
  const setCatalog = useAppStore(s => s.setPqlAgentCatalog);
  const load = useCallback(() => listAgents(workspaceId!), [workspaceId]);
  const snapshot = useLiveQuery(workspaceId && userId === workspaceUserId ? workspaceId : undefined, load);
  useEffect(() => {
    if (!workspaceId || !userId || workspaceUserId !== userId) return;
    const current = useAppStore.getState();
    if (current.activeWorkspace?.id !== workspaceId || current.workspaceUserId !== userId) return;
    setCatalog({ workspaceId, userId, agents: snapshot.data ?? [], loading: snapshot.loading, error: snapshot.error });
  }, [workspaceId, userId, workspaceUserId, snapshot.data, snapshot.loading, snapshot.error, setCatalog]);
}
