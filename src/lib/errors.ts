/**
 * Lectura de errores desconocidos sin `any` (TES-239).
 *
 * En un `catch` el error es `unknown`: puede ser un `Error`, un `FirebaseError`
 * con `code`, o cualquier cosa que alguien haya tirado. Escribir `catch (err:
 * any)` y confiar en `err?.code` compila, pero apaga el chequeo de tipos justo
 * donde menos se sabe qué llegó.
 */

function asRecord(error: unknown): Record<string, unknown> | null {
  return typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : null;
}

/**
 * `code` de un error de Firebase (`auth/wrong-password`, `permission-denied`),
 * con el mensaje como fallback: es lo que espera `getFirebaseErrorMessage`, que
 * matchea por código y devuelve un texto genérico cuando no reconoce el valor.
 */
export function firebaseErrorCode(error: unknown): string {
  const record = asRecord(error);
  if (record && typeof record.code === 'string') return record.code;
  return errorMessage(error, '');
}

/** Mensaje legible de un error desconocido, o `fallback` si no tiene ninguno. */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  const record = asRecord(error);
  if (record && typeof record.message === 'string' && record.message) return record.message;
  return fallback;
}
