/** No cloud polling. Hidden views detach; showing the view reconciles once. */
export function visibleSignalRefresh(
  subscribe: (changed: () => void, failed: () => void) => () => void,
  refresh: (observe?: boolean) => Promise<void>,
  failed: () => void,
) {
  let stopped = false; let unsubscribe: (() => void) | undefined;
  let inFlight = false; let dirty = false; let observe = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function flush() {
    if (stopped || document.visibilityState === 'hidden' || inFlight) return;
    inFlight = true; dirty = false; const requestObservation = observe; observe = false;
    try { await refresh(requestObservation); } catch { if (!stopped) failed(); }
    finally { inFlight = false; if (dirty && !stopped) schedule(); }
  }
  function schedule(requestObservation = false) {
    dirty = true; observe ||= requestObservation;
    if (!timer) timer = setTimeout(() => { timer = undefined; void flush(); }, 75);
  }
  function attach() {
    unsubscribe?.(); unsubscribe = undefined;
    if (document.visibilityState === 'hidden') return;
    // Initial server snapshot also covers changes made while disconnected/hidden.
    schedule(true);
    unsubscribe = subscribe(() => schedule(), () => { if (!stopped) failed(); });
  }
  document.addEventListener('visibilitychange', attach);
  window.addEventListener('online', attach);
  attach();
  return {
    refresh: attach,
    stop: () => { stopped = true; unsubscribe?.(); clearTimeout(timer); document.removeEventListener('visibilitychange', attach); window.removeEventListener('online', attach); },
  };
}
