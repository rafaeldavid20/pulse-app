/**
 * Los catálogos de estados/prioridades/tipos y la whitelist de campos
 * escribibles se movieron a `@/types/domain` — la fuente única que se sincroniza
 * con `pulse-backend` (antes estaban duplicados a mano a ambos lados del límite
 * entre repos, que es exactamente el problema que `npm run sync:types` resuelve).
 *
 * Este módulo se mantiene como re-export para no romper los imports existentes
 * de `@/lib/constants/issue`.
 */
export {
  ISSUE_STATUSES,
  ISSUE_PRIORITIES,
  ISSUE_TYPES,
  DEFAULT_ISSUE_TYPE,
  ISSUE_WRITABLE_FIELDS,
  PROJECT_WRITABLE_FIELDS,
  ALLOWED_PARENT_TYPES,
  MAX_HIERARCHY_DEPTH,
  getStatusLabel,
  getPriorityLabel,
  getIssueTypeLabel,
  canHaveParent,
  canBeChild,
  canHaveChildren,
  resolveEpicId,
  isCompletedStatus,
  COMPLETED_ISSUE_STATUSES,
} from '@/types/domain';

export type {
  IssueStatusOption,
  IssuePriorityOption,
  IssueTypeOption,
  IssueWritableField,
  ProjectWritableField,
} from '@/types/domain';
