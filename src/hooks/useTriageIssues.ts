'use client';

import { useEffect, useState } from 'react';
import { FirestoreError } from 'firebase/firestore';
import { useAppStore } from '@/stores/appStore';
import { Issue } from '@/types';
import { subscribeTriageIssues, describeSubscriptionError } from '@/lib/firestore';

/** Cola de triage (F2) del workspace activo — ver `subscribeTriageIssues`. */
export function useTriageIssues() {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeWorkspace) {
      setIssues([]);
      setLoaded(false);
      setError(null);
      return;
    }

    setLoaded(false);
    setError(null);

    const unsub = subscribeTriageIssues(
      activeWorkspace.id,
      (next) => {
        setIssues(next);
        setLoaded(true);
      },
      (err: FirestoreError) => {
        console.error('subscribeTriageIssues', err);
        setError(describeSubscriptionError(err));
        setLoaded(true);
      }
    );

    return unsub;
  }, [activeWorkspace]);

  return { issues, loaded, error };
}
