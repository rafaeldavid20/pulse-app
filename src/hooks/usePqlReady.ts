'use client';

import { usePathname } from 'next/navigation';
import { useAppStore } from '@/stores/appStore';
import { usePqlAgentStatus } from './usePqlAgentStatus';

export function usePqlReady(): boolean {
  const pathname = usePathname();
  const agents = usePqlAgentStatus();
  const mode = useAppStore(s => s.filterMode);
  const applied = useAppStore(s => s.pqlApplied);
  const scope = useAppStore(s => s.pqlScope);
  const workspace = useAppStore(s => s.activeWorkspace?.id);
  const actor = useAppStore(s => s.workspaceUserId);
  const catalogReady = useAppStore(s => s.workspaceCatalogReady);
  const catalogError = useAppStore(s => s.workspaceCatalogError);
  return mode === 'filters' || (applied !== null && catalogReady && !catalogError && agents.ready && !!workspace && scope === `${workspace}:${actor ?? undefined}:${pathname}`);
}
