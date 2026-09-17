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
  const restoredForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const { setViewState, resetView } = useAppStore.getState();
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + pathname);
      if (raw) {
        setViewState(JSON.parse(raw) as StoredView);
      } else {
        resetView();
      }
    } catch {
      resetView();
    }
    restoredForRef.current = pathname;

    const unsubscribe = useAppStore.subscribe((state) => {
      if (restoredForRef.current !== pathname) return;
      try {
        const view: StoredView = {
          filters: state.filterState,
          groupBy: state.groupBy,
          sortBy: state.sortBy,
        };
        localStorage.setItem(STORAGE_PREFIX + pathname, JSON.stringify(view));
      } catch {
        // localStorage puede fallar en modo privado o con la cuota llena; la
        // persistencia es un extra, no algo de lo que dependa poder filtrar.
      }
    });

    return unsubscribe;
  }, [enabled, pathname]);
}
