'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/stores/appStore';
import { FilterState, IssueGroupBy, IssueSortBy } from '@/types';

const STORAGE_PREFIX = 'pulse:view:';

interface StoredView {
  filters: FilterState;
  groupBy: IssueGroupBy;
  sortBy: IssueSortBy;
  mode?: 'filters' | 'pql';
  query?: string;
  version?: number;
}
function validStoredView(view: StoredView): boolean {
  if (!view || typeof view !== 'object' || !view.filters || typeof view.filters !== 'object') return false;
  const filter = view.filters as unknown as Record<string, unknown>;
  if (filter.search !== undefined && typeof filter.search !== 'string') return false;
  for (const key of ['status', 'type', 'assigneeIds', 'projectIds', 'epicIds', 'labelIds', 'reviewStates']) {
    if (filter[key] !== undefined && (!Array.isArray(filter[key]) || !(filter[key] as unknown[]).every(v => typeof v === 'string'))) return false;
  }
  if (filter.priority !== undefined && (!Array.isArray(filter.priority) || !filter.priority.every(v => Number.isInteger(v) && v >= 0 && v <= 4))) return false;
  if (!['none', 'status', 'assignee', 'priority', 'project', 'epic', 'cycle'].includes(view.groupBy)) return false;
  if (!['manual', 'priority', 'updated', 'created', 'estimate'].includes(view.sortBy)) return false;
  return (view.mode === undefined || view.mode === 'filters' || view.mode === 'pql') && (view.query === undefined || typeof view.query === 'string');
}

/**
 * Restaura filtros/agrupación/orden guardados para la ruta actual, y los
 * persiste en localStorage a medida que cambian. Cada ruta tiene su propia
 * entrada: cambiar de equipo o de proyecto no debería arrastrar el filtro
 * de otra pantalla.
 *
 * Se suscribe directamente al store (en vez de leer `filterState` vía el hook
 * reactivo) para no depender del ciclo de render de React: guardar en un
 * `useEffect` disparado por el propio `setViewState` del restore terminaría
 * escribiendo el valor de la ruta anterior antes de que el store reflejara el
 * restore, porque el efecto de guardado correría con el `filterState` viejo
 * todavía en scope.
 */
export function useViewPersistence(enabled: boolean) {
  const pathname = usePathname();
  const workspaceId = useAppStore(s => s.activeWorkspace?.id);
  const userId = useAppStore(s => s.workspaceUserId);
  const restoredForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !workspaceId || !userId) return;
    const key = `${STORAGE_PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(workspaceId)}:${pathname}`;

    const { setViewState, resetView } = useAppStore.getState();
    try {
      const raw = localStorage.getItem(key) ?? localStorage.getItem(STORAGE_PREFIX + pathname);
      if (raw) {
        const view = JSON.parse(raw) as StoredView;
        if (!validStoredView(view)) throw new Error('Vista inválida');
        setViewState(view);
      } else {
        resetView();
      }
    } catch {
      resetView();
    }
    restoredForRef.current = key;

    const unsubscribe = useAppStore.subscribe((state) => {
      if (restoredForRef.current !== key || state.activeWorkspace?.id !== workspaceId || state.workspaceUserId !== userId) return;
      try {
        const view: StoredView = {
          filters: state.filterState,
          groupBy: state.groupBy,
          sortBy: state.sortBy,
          mode: state.filterMode,
          query: state.pqlDraft,
          version: 1,
        };
        localStorage.setItem(key, JSON.stringify(view));
      } catch {
        // localStorage puede fallar en modo privado o con la cuota llena; la
        // persistencia es un extra, no algo de lo que dependa poder filtrar.
      }
    });

    return unsubscribe;
  }, [enabled, pathname, workspaceId, userId]);
}
