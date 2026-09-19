'use client';

import { useEffect, useState } from 'react';
import { FirestoreError } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { Notification } from '@/types';
import { subscribeAllUserNotifications, describeSubscriptionError } from '@/lib/firestore';

/** Todas las notificaciones del usuario (F3) — ver `subscribeAllUserNotifications`. */
export function useUserNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoaded(false);
      setError(null);
      return;
    }

    setLoaded(false);
    setError(null);

    const unsub = subscribeAllUserNotifications(
      user.uid,
      (next) => {
        setNotifications(next);
        setLoaded(true);
      },
      (err: FirestoreError) => {
        console.error('subscribeAllUserNotifications', err);
        setError(describeSubscriptionError(err));
        setLoaded(true);
      }
    );

    return unsub;
  }, [user]);

  return { notifications, loaded, error };
}
