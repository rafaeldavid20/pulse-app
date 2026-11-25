'use client';

import { useAppStore } from '@/stores/appStore';

/** Fail closed while the authorized catalog belongs to a different session,
 * is loading, or could not be refreshed. */
export function usePqlAgentStatus() {
  const workspace = useAppStore(s => s.activeWorkspace?.id);
  const user = useAppStore(s => s.workspaceUserId);
  const catalog = useAppStore(s => s.pqlAgentCatalog);
  const current = !!workspace && !!user && catalog?.workspaceId === workspace && catalog.userId === user;
  return { ready: !!current && !catalog.loading && !catalog.error, error: current ? catalog.error : null };
}
