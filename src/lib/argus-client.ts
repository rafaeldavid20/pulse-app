import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '@/lib/firebase';

type ReportableError = Error & { digest?: string };

function asError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  return new Error('Error no identificado en Pulse App');
}

// Extensiones del navegador (y otros orígenes cross-domain) inyectan scripts en la
// página; sus errores llegan al mismo listener global que los de Pulse pero no son
// accionables acá.
const FOREIGN_ORIGIN_SCHEMES = ['chrome-extension://', 'moz-extension://', 'safari-extension://', 'about:'];

function pointsToForeignOrigin(source?: string): boolean {
  return !!source && FOREIGN_ORIGIN_SCHEMES.some((scheme) => source.includes(scheme));
}

function isForeignOriginError(error: Error, filename?: string): boolean {
  return pointsToForeignOrigin(filename) || pointsToForeignOrigin(error.stack);
}

function firstStackFrame(stack?: string): string {
  if (!stack) return '';
  const frame = stack.split('\n').slice(1).find((line) => line.trim().length > 0);
  return frame?.trim() ?? '';
}

function errorSignature(error: Error): string {
  return `${error.name}|${error.message}|${firstStackFrame(error.stack)}`;
}

// Estado por sesión de página: se resetea con una recarga completa, lo que alcanza
// para cortar los loops de errores repetidos que motivaron este límite.
const DEDUPE_WINDOW_MS = 60_000;
const SESSION_REPORT_LIMIT = 20;
const recentSignatures = new Map<string, number>();
let sessionReportCount = 0;

function shouldSkipDuplicate(signature: string, now: number): boolean {
  if (sessionReportCount >= SESSION_REPORT_LIMIT) return true;
  const lastSeen = recentSignatures.get(signature);
  return lastSeen !== undefined && now - lastSeen < DEDUPE_WINDOW_MS;
}

/**
 * The browser never receives an Argus key. Authenticated client errors go to
 * Pulse's callable relay, which validates and reports them from the backend.
 */
export async function reportPulseClientError(
  value: unknown,
  route: string,
  filename?: string,
): Promise<void> {
  if (!auth.currentUser) return;
  const error = asError(value);
  if (isForeignOriginError(error, filename)) return;

  const now = Date.now();
  const signature = errorSignature(error);
  if (shouldSkipDuplicate(signature, now)) return;
  recentSignatures.set(signature, now);
  sessionReportCount += 1;

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
