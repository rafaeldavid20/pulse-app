'use client';

import { usePathname } from 'next/navigation';
import { useAppStore } from '@/stores/appStore';

export function usePqlReady(): boolean {
  const pathname = usePathname();
  const mode = useAppStore(s => s.filterMode);
  const applied = useAppStore(s => s.pqlApplied);
  const scope = useAppStore(s => s.pqlScope);
  const workspace = useAppStore(s => s.activeWorkspace?.id);
  const actor = useAppStore(s => s.workspaceUserId);
  return mode === 'filters' || (applied !== null && !!workspace && scope === `${workspace}:${actor ?? undefined}:${pathname}`);
}
