'use client';

import { useEffect, useState } from 'react';
import { FirestoreError } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { Notification } from '@/types';
import { subscribeAllUserNotifications, describeSubscriptionError } from '@/lib/firestore';

interface NotificationsState {
  /** Usuario al que pertenece lo que hay en `notifications`. */
  userId: string | null;
  notifications: Notification[];
  loaded: boolean;
  error: string | null;
}

const EMPTY_NOTIFICATIONS: NotificationsState = { userId: null, notifications: [], loaded: false, error: null };

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
  const [state, setState] = useState<NotificationsState>(EMPTY_NOTIFICATIONS);

  useEffect(() => {
    if (!user) return;
    const userId = user.uid;

    const unsub = subscribeAllUserNotifications(
      userId,
      (next) => setState({ userId, notifications: next, loaded: true, error: null }),
      (err: FirestoreError) => {
        console.error('subscribeAllUserNotifications', err);
        setState({ userId, notifications: [], loaded: true, error: describeSubscriptionError(err) });
      }
    );

    return unsub;
  }, [user]);

  const isCurrent = state.userId === (user?.uid ?? null);
  return isCurrent
    ? { notifications: state.notifications, loaded: state.loaded, error: state.error }
    : { notifications: EMPTY_NOTIFICATIONS.notifications, loaded: false, error: null };
}
