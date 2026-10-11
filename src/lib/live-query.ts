/** Authorized callable data has no client-readable Firestore collection.
 * Keep only mounted readers alive; re-fetch at a bounded interval and on
 * reconnect/focus. Never store secrets or write this cache to storage. */
export interface LiveSnapshot<T> {
  data?: T;
  loading: boolean;
  error: string | null;
}

const activeQueries = new Set<() => Promise<void>>();

/** Called only after successful mutations; pending reads queue one follow-up. */
export function invalidateLiveQueries() {
  activeQueries.forEach((refresh) => { void refresh(); });
}

export function createLiveQuery<T>(load: () => Promise<T>, interval = 3000) {
  let snapshot: LiveSnapshot<T> = { loading: true, error: null };
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  let pending: Promise<void> | undefined;
  let again = false;
  const emit = () => listeners.forEach((listener) => listener());
  const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';
  const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;

  const refresh = (): Promise<void> => {
    if (!listeners.size) return Promise.resolve();
    if (pending) { again = true; return pending; }
    clearTimeout(timer);
    const current = generation;
    pending = Promise.resolve().then(load).then((data) => {
      if (current !== generation) return;
      snapshot = { data, loading: false, error: null };
      emit();
    }, (error: unknown) => {
      if (current !== generation) return;
      // Drop stale privileged data on errors (including permission changes).
      snapshot = { loading: false, error: error instanceof Error ? error.message : 'No se pudieron actualizar los datos.' };
      emit();
    }).finally(() => {
      if (current !== generation) return;
      pending = undefined;
      if (!listeners.size) return;
      if (again) { again = false; void refresh(); }
      else timer = setTimeout(tick, interval);
    });
    return pending;
  };
  const tick = () => {
    if (visible() && online()) void refresh();
    else timer = setTimeout(tick, interval);
  };
  const wake = () => { if (visible() && online()) void refresh(); };

  return {
    getSnapshot: () => snapshot,
    refresh,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        activeQueries.add(refresh);
        if (typeof window !== 'undefined') {
          window.addEventListener('online', wake);
          window.addEventListener('focus', wake);
          document.addEventListener('visibilitychange', wake);
        }
        void refresh();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size) return;
        activeQueries.delete(refresh);
        generation++;
        clearTimeout(timer);
        pending = undefined;
        again = false;
        snapshot = { loading: true, error: null };
        if (typeof window !== 'undefined') {
          window.removeEventListener('online', wake);
          window.removeEventListener('focus', wake);
          document.removeEventListener('visibilitychange', wake);
        }
      };
    },
  };
}
