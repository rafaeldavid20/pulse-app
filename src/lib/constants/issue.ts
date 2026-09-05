import { IssuePriority, IssueStatus } from '@/types';

/**
 * Single source of truth for the list of valid issue statuses and their
 * display order/label. Previously this list was duplicated verbatim across
 * `CreateIssueModal.tsx`, `IssuePeekPanel.tsx`, `useIssues.ts`'s board
 * grouping, and `getStatusLabel` in `lib/utils.ts` — adding a status meant
 * touching all four (plus `StatusBadge.tsx`'s icon switch, which stays
 * separate since it renders per-status SVG icons rather than a value list).
 */
export interface IssueStatusOption {
  value: IssueStatus;
  label: string;
  order: number;
}

export const ISSUE_STATUSES: IssueStatusOption[] = [
  { value: 'backlog', label: 'Backlog', order: 0 },
  { value: 'todo', label: 'Por hacer', order: 1 },
  { value: 'in_progress', label: 'En progreso', order: 2 },
  { value: 'in_review', label: 'En revisión', order: 3 },
  { value: 'done', label: 'Completado', order: 4 },
  { value: 'canceled', label: 'Cancelado', order: 5 },
];

/**
 * Single source of truth for issue priorities. Order intentionally matches
 * the existing UI convention (urgent → low, "none" listed last) rather than
 * the numeric value order.
 */
export interface IssuePriorityOption {
  value: IssuePriority;
  label: string;
}

export const ISSUE_PRIORITIES: IssuePriorityOption[] = [
  { value: 1, label: 'Urgente' },
  { value: 2, label: 'Alta' },
  { value: 3, label: 'Media' },
  { value: 4, label: 'Baja' },
  { value: 0, label: 'Sin prioridad' },
];

export function getStatusLabel(status: IssueStatus | string): string {
  return ISSUE_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function getPriorityLabel(priority: IssuePriority | number): string {
  return ISSUE_PRIORITIES.find((p) => p.value === priority)?.label ?? 'Sin prioridad';
}

/**
 * Fields a caller (client SDK fallback or an MCP tool) may set on an issue.
 * Mirrors `pulse-backend/functions/src/common/utils/issue-fields.ts` — keep
 * both in sync. `id`, `identifier`, `number`, `workspaceId`, `teamId`,
 * `creatorId`, `createdAt`, `updatedAt` are server-assigned and deliberately
 * excluded.
 */
export const ISSUE_WRITABLE_FIELDS = [
  'title',
  'description',
  'status',
  'priority',
  'projectId',
  'assigneeId',
  'labelIds',
  'parentId',
  'dueDate',
  'estimate',
] as const;
