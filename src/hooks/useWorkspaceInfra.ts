'use client';

import { useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { getGithubStatus, listAgents, listEnvironments } from '@/lib/firestore';
import { useLiveQuery } from './useLiveQuery';

/** No permanent cache: mounted readers recover automatically after changes. */
export function useWorkspaceInfra(enabled = true) {
  const workspaceId = useAppStore((s) => s.activeWorkspace?.id);
  const load = useCallback(async () => {
    const [status, agents, environments] = await Promise.all([
      getGithubStatus(workspaceId!), listAgents(workspaceId!), listEnvironments(workspaceId!),
    ]);
    return { repos: status.repositories ?? [], connected: status.connected, agents, environments };
  }, [workspaceId]);
  const { data, loading } = useLiveQuery(enabled ? workspaceId : undefined, load);
  return { repos: data?.repos ?? [], agents: data?.agents ?? [], environments: data?.environments ?? [],
    connected: data?.connected ?? false, loading };
}
