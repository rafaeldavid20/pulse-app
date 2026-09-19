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

import type { IssueStatus, IssuePriority, IssueType, ReviewState } from './domain';

export interface FilterState {
  search: string;
  status: IssueStatus[];
  priority: IssuePriority[];
  type: IssueType[];
  assigneeIds: string[];
  projectIds: string[];
  epicIds: string[];
  labelIds: string[];
  /** Estado de revisión de QA (D7) — `review:needs_human` es la cola de trabajo del humano. */
  reviewStates: ReviewState[];
}

/** Cómo se agrupan las filas de la lista de issues bajo la barra de filtros. */
export type IssueGroupBy = 'none' | 'status' | 'assignee' | 'priority' | 'project' | 'epic' | 'cycle';

/** Criterio de orden de las filas, dentro de cada grupo si hay uno activo. */
export type IssueSortBy = 'manual' | 'priority' | 'updated' | 'created' | 'estimate';

/** Densidad de las filas en IssueList: cómoda (default) o compacta. */
export type IssueListDensity = 'comfortable' | 'compact';

/** Columnas opcionales de IssueList. Tipo, estado y título son siempre visibles. */
export type IssueListColumn =
  | 'identifier'
  | 'priority'
  | 'labels'
  | 'project'
  | 'epic'
  | 'cycle'
  | 'assignee'
  | 'date'
  | 'estimate';

export const ISSUE_LIST_COLUMNS: { value: IssueListColumn; label: string }[] = [
  { value: 'identifier', label: 'Identificador' },
  { value: 'priority', label: 'Prioridad' },
  { value: 'labels', label: 'Labels' },
  { value: 'project', label: 'Proyecto' },
  { value: 'epic', label: 'Épica' },
  { value: 'cycle', label: 'Ciclo' },
  { value: 'assignee', label: 'Asignado' },
  { value: 'date', label: 'Fecha' },
  { value: 'estimate', label: 'Estimación' },
];

/** Set de columnas que reproduce lo que la lista mostraba antes de A7. */
export const DEFAULT_ISSUE_LIST_COLUMNS: IssueListColumn[] = [
  'identifier',
  'priority',
  'labels',
  'assignee',
  'date',
];
