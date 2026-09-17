'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import { DEFAULT_ISSUE_LIST_COLUMNS, IssueListColumn, IssueListDensity } from '@/types';

const STORAGE_KEY = 'pulse:list-prefs';

interface StoredListPrefs {
  density: IssueListDensity;
  columns: IssueListColumn[];
}

/**
 * Restaura densidad/columnas de IssueList guardadas y las persiste en
 * localStorage a medida que cambian. A diferencia de `useViewPersistence`,
 * esto es una preferencia de UI global (no depende de la ruta): alternar a
 * "compacta" en un equipo y verla seguir siendo "cómoda" en otro sería
 * inconsistente, es una preferencia de cómo se ve la lista, no un filtro.
 */
export function useListPreferences() {
  const restoredRef = useRef(false);

  useEffect(() => {
    const { setListPrefs } = useAppStore.getState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredListPrefs>;
        setListPrefs({
          density: parsed.density === 'compact' ? 'compact' : 'comfortable',
          columns: Array.isArray(parsed.columns) ? parsed.columns : DEFAULT_ISSUE_LIST_COLUMNS,
        });
      }
    } catch {
      // localStorage puede fallar en modo privado o con la cuota llena; si
      // falla, la lista simplemente arranca con los defaults del store.
    }
    restoredRef.current = true;

    const unsubscribe = useAppStore.subscribe((state) => {
      if (!restoredRef.current) return;
      try {
        const prefs: StoredListPrefs = { density: state.listDensity, columns: state.visibleColumns };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      } catch {
        // Ídem: persistir es un extra, no algo de lo que dependa la lista.
      }
    });

    return unsubscribe;
  }, []);
}
