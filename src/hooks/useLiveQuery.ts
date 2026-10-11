'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { createLiveQuery, LiveSnapshot } from '@/lib/live-query';
import { useAppStore } from '@/stores/appStore';

const EMPTY: LiveSnapshot<never> = { loading: true, error: null };
const noopSubscribe = () => () => {};
const emptySnapshot = () => EMPTY;

/** Memoize `load` with useCallback. Scope includes identity and workspace so
 * a previous request cannot populate a new session or a different filter. */
export function useLiveQuery<T>(key: string | undefined, load: () => Promise<T>) {
  const userId = useAppStore((s) => s.workspaceUserId);
  const workspaceId = useAppStore((s) => s.activeWorkspace?.id);
  const resource = useMemo(() => key && userId && workspaceId ? createLiveQuery(load) : null,
    [key, userId, workspaceId, load]);
  const snapshot = useSyncExternalStore(resource?.subscribe ?? noopSubscribe,
    resource?.getSnapshot ?? emptySnapshot, emptySnapshot);
  return { ...snapshot, refresh: resource?.refresh ?? (() => Promise.resolve()) };
}
