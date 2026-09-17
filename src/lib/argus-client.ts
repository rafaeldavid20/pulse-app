import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '@/lib/firebase';

type ReportableError = Error & { digest?: string };

function asError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  return new Error('Error no identificado en Pulse App');
}

/**
 * The browser never receives an Argus key. Authenticated client errors go to
 * Pulse's callable relay, which validates and reports them from the backend.
 */
export async function reportPulseClientError(
  value: unknown,
  route: string,
): Promise<void> {
  if (!auth.currentUser) return;
  const error = asError(value);
  const report = httpsCallable<
    { error: { name: string; message: string; stack?: string }; route: string },
    { accepted: boolean }
  >(functions, 'pulseClientTelemetry', { timeout: 10_000 });

  try {
    await report({
      error: {
        name: error.name || 'Error',
        message: error.message || 'Error no identificado en Pulse App',
        ...(error.stack ? { stack: error.stack } : {}),
      },
      route,
    });
  } catch {
    // Observability must never affect the user-facing recovery path.
  }
}

export type { ReportableError };
