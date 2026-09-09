/**
 * Punto de entrada de tipos del frontend.
 *
 * El modelo de dominio vive en `./domain.ts` — ese archivo es la fuente única
 * compartida con `pulse-backend` (ver `scripts/sync-types.mjs`). Acá se
 * re-exporta entero para que el resto de la app siga importando de
 * `@/types` sin cambios, y se agregan los tipos que son *solo* de la UI y no
 * tienen por qué viajar al backend.
 */
export * from './domain';

import type { IssueStatus, IssuePriority, IssueType } from './domain';

export interface FilterState {
  search: string;
  status: IssueStatus[];
  priority: IssuePriority[];
  type: IssueType[];
  assigneeId?: string;
  projectId?: string;
  epicId?: string;
  labelIds: string[];
}
