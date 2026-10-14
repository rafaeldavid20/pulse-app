'use client';

import { useEffect, useState } from 'react';
import { FirestoreError } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/firebase';
import { waitForWorkspaceAccessForAll } from '@/lib/workspace-access';
import { useAppStore } from '@/stores/appStore';
import { Notification } from '@/types';
import { subscribeAllUserNotifications, describeSubscriptionError } from '@/lib/firestore';

interface NotificationsState {
  /** Usuario al que pertenece lo que hay en `notifications`. */
  userId: string | null;
  notifications: Notification[];
  loaded: boolean;
  error: string | null;
  workspaceScope: string;
}

const EMPTY_NOTIFICATIONS: NotificationsState = { userId: null, notifications: [], loaded: false, error: null, workspaceScope: '' };

/**
 * Todas las notificaciones del usuario (F3) — ver `subscribeAllUserNotifications`.
 *
 * Mismo criterio que `useTriageIssues`: el estado sabe de quién es, así que
 * cambiar de usuario no necesita limpiarlo con un `setState` sincrónico dentro
 * del efecto (renders en cascada) — el render deriva que lo que hay en memoria
 * es de otro y todavía no cargó. Además evita mostrarle a alguien, por un
 * frame, las notificaciones del usuario anterior.
 */
export function useUserNotifications() {
  const { user } = useAuth();
  const userWorkspaces = useAppStore((s) => s.userWorkspaces);
  const [state, setState] = useState<NotificationsState>(EMPTY_NOTIFICATIONS);

  useEffect(() => {
    if (!user) return;
    const userId = user.uid;
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || firebaseUser.uid !== userId) return;
    const workspaceIds = userWorkspaces.map((workspace) => workspace.id);
    const workspaceScope = [...workspaceIds].sort().join(',');
    const controller = new AbortController();
    const unsubscribers: Array<() => void> = [];
    let retryAttempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let opening = false;
    let subscribed = false;
    const open = () => {
      if (opening || subscribed || controller.signal.aborted) return;
      if (retryTimer) clearTimeout(retryTimer);
      opening = true;
      void waitForWorkspaceAccessForAll(firebaseUser, workspaceIds, controller.signal)
        .then(() => {
          if (controller.signal.aborted || auth.currentUser?.uid !== userId) return;
          subscribed = true;
          unsubscribers.push(subscribeAllUserNotifications(
            userId,
            workspaceIds,
            (next) => {
              if (controller.signal.aborted) return;
              setState({ userId, notifications: next, loaded: true, error: null, workspaceScope });
            },
            (err: FirestoreError) => {
              if (controller.signal.aborted) return;
              console.error('subscribeAllUserNotifications', err);
              unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
              subscribed = false;
              if (err.code !== 'permission-denied') {
                setState({ userId, notifications: [], loaded: true, error: describeSubscriptionError(err), workspaceScope });
                return;
              }
              const delay = [1000, 2000, 4000, 8000][retryAttempt++];
              if (delay === undefined) {
                setState({ userId, notifications: [], loaded: true, error: describeSubscriptionError(err), workspaceScope });
              } else {
                retryTimer = setTimeout(open, delay);
              }
            }
          ));
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const delay = [1000, 2000, 4000, 8000][retryAttempt++];
          if (delay === undefined) {
            const message = error instanceof Error ? error.message : 'No se pudo comprobar el acceso a tus workspaces.';
            setState({ userId, notifications: [], loaded: true, error: message, workspaceScope });
          } else {
            retryTimer = setTimeout(open, delay);
          }
        })
        .finally(() => { opening = false; });
    };
    open();
    window.addEventListener('online', open);
    window.addEventListener('focus', open);

    return () => {
      controller.abort();
      window.removeEventListener('online', open);
      window.removeEventListener('focus', open);
      if (retryTimer) clearTimeout(retryTimer);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [user, userWorkspaces]);

  const workspaceScope = userWorkspaces.map((workspace) => workspace.id).sort().join(',');
  const isCurrent = state.userId === (user?.uid ?? null) && state.workspaceScope === workspaceScope;
  return isCurrent
    ? { notifications: state.notifications, loaded: state.loaded, error: state.error }
    : { notifications: EMPTY_NOTIFICATIONS.notifications, loaded: false, error: null };
}
