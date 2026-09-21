'use client';

import { useEffect, useState } from 'react';
import { FirestoreError } from 'firebase/firestore';
import { useAppStore } from '@/stores/appStore';
import { Issue } from '@/types';
import { subscribeTriageIssues, describeSubscriptionError } from '@/lib/firestore';

interface TriageState {
  /** Workspace al que pertenece lo que hay en `issues`. `null` antes de la primera carga. */
  workspaceId: string | null;
  issues: Issue[];
  loaded: boolean;
  error: string | null;
}

const EMPTY_TRIAGE: TriageState = { workspaceId: null, issues: [], loaded: false, error: null };

/**
 * Cola de triage (F2) del workspace activo — ver `subscribeTriageIssues`.
 *
 * El estado guarda a qué workspace pertenece. Así el cambio de workspace no
 * necesita un `setState` sincrónico dentro del efecto para "limpiar" —eso
 * provoca renders en cascada— sino que el render deriva que lo que hay en
 * memoria es de otro workspace y todavía no cargó. De paso desaparece el
 * parpadeo en el que se veían los issues del workspace anterior.
 */
export function useTriageIssues() {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const [state, setState] = useState<TriageState>(EMPTY_TRIAGE);

  useEffect(() => {
    if (!activeWorkspace) return;
    const workspaceId = activeWorkspace.id;

    const unsub = subscribeTriageIssues(
      workspaceId,
      (next) => setState({ workspaceId, issues: next, loaded: true, error: null }),
      (err: FirestoreError) => {
        console.error('subscribeTriageIssues', err);
        setState({ workspaceId, issues: [], loaded: true, error: describeSubscriptionError(err) });
      }
    );

    return unsub;
  }, [activeWorkspace]);

  const isCurrent = state.workspaceId === (activeWorkspace?.id ?? null);
  return isCurrent
    ? { issues: state.issues, loaded: state.loaded, error: state.error }
    : { issues: EMPTY_TRIAGE.issues, loaded: false, error: null };
}
