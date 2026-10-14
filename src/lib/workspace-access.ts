import type { User } from 'firebase/auth';

const RETRY_DELAYS_MS = [0, 1000, 2000, 4000, 8000, 8000, 8000];

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** Wait for the membership trigger without starting unauthorized listeners. */
export async function waitForWorkspaceAccess(
  user: Pick<User, 'getIdTokenResult'>,
  workspaceId: string,
  signal: AbortSignal,
  retryDelaysMs: readonly number[] = RETRY_DELAYS_MS,
): Promise<void> {
  return waitForWorkspaceAccessForAll(user, [workspaceId], signal, retryDelaysMs);
}

/** Refresh once per attempt and confirm every workspace claim on the same token. */
export async function waitForWorkspaceAccessForAll(
  user: Pick<User, 'getIdTokenResult'>,
  workspaceIds: string[],
  signal: AbortSignal,
  retryDelaysMs: readonly number[] = RETRY_DELAYS_MS,
): Promise<void> {
  if (workspaceIds.length === 0) return;
  for (const delay of retryDelaysMs) {
    signal.throwIfAborted();
    if (delay > 0) await wait(delay, signal);
    let claims: Record<string, unknown>;
    try {
      ({ claims } = await user.getIdTokenResult(true));
    } catch {
      signal.throwIfAborted();
      // Transient refresh failures get the same bounded retry window.
      continue;
    }
    signal.throwIfAborted();
    const ws = claims.ws;
    if (ws && typeof ws === 'object' && workspaceIds.every((id) => Object.hasOwn(ws, id))) return;
  }
  throw new Error('No se pudo confirmar tu acceso al workspace. Recarga la página para reintentar. Si el problema continúa, pide al administrador que revise tu invitación.');
}
