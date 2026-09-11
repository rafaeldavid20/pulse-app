import {
  FilterState,
  Issue,
  IssueGroupBy,
  IssuePriority,
  IssueSortBy,
  Member,
  Project,
  getPriorityLabel,
  getStatusLabel,
} from '@/types';
import { ISSUE_STATUSES } from '@/lib/constants/issue';

/**
 * Sentinel para "sin asignar" / "sin proyecto" / "sin épica" en filtros y
 * agrupación. No puede ser `''` porque eso colisiona con claves de grupo
 * vacías reales en otros contextos, y no puede ser `undefined` porque los
 * chips necesitan un valor seleccionable en un array de ids.
 */
export const UNASSIGNED = '__unassigned__';

export function applyIssueFilters(issues: Issue[], filters: FilterState): Issue[] {
  return issues.filter((issue) => {
    if (filters.search) {
      const query = filters.search.toLowerCase();
      const matchesTitle = issue.title.toLowerCase().includes(query);
      const matchesId = issue.identifier.toLowerCase().includes(query);
      if (!matchesTitle && !matchesId) return false;
    }

    if (filters.status.length > 0 && !filters.status.includes(issue.status)) {
      return false;
    }

    if (filters.priority.length > 0 && !filters.priority.includes(issue.priority)) {
      return false;
    }

    if (filters.type.length > 0 && !filters.type.includes(issue.type ?? 'task')) {
      return false;
    }

    if (filters.assigneeIds.length > 0) {
      const assignee = issue.assigneeId || UNASSIGNED;
      if (!filters.assigneeIds.includes(assignee)) return false;
    }

    if (filters.projectIds.length > 0) {
      const project = issue.projectId || UNASSIGNED;
      if (!filters.projectIds.includes(project)) return false;
    }

    // Incluye la épica misma además de su subárbol, para que seleccionarla no
    // la haga desaparecer de su propia vista.
    if (filters.epicIds.length > 0) {
      const belongs = filters.epicIds.includes(issue.epicId || '') || filters.epicIds.includes(issue.id);
      if (!belongs) return false;
    }

    if (filters.labelIds.length > 0) {
      const labels = issue.labelIds || [];
      if (!filters.labelIds.some((id) => labels.includes(id))) return false;
    }

    return true;
  });
}

export function countActiveFilters(filters: FilterState): number {
  return (
    filters.status.length +
    filters.priority.length +
    filters.assigneeIds.length +
    filters.projectIds.length +
    filters.epicIds.length +
    filters.labelIds.length
  );
}

/** Orden intencional de prioridad: urgente(1) → baja(4), sin prioridad(0) al final. */
function priorityRank(priority: IssuePriority): number {
  return priority === 0 ? 5 : priority;
}

/**
 * `manual` no reordena: preserva el orden que ya trae el array (hoy, el de la
 * suscripción de Firestore). No hay un campo de posición persistido todavía,
 * así que "manual" es el único orden estable que se puede ofrecer sin
 * inventar ese campo.
 */
export function sortIssues(issues: Issue[], sortBy: IssueSortBy): Issue[] {
  if (sortBy === 'manual') return issues;

  const sorted = [...issues];
  switch (sortBy) {
    case 'priority':
      sorted.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
      break;
    case 'updated':
      sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      break;
    case 'created':
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    case 'estimate':
      sorted.sort((a, b) => (b.estimate ?? 0) - (a.estimate ?? 0));
      break;
  }
  return sorted;
}

export interface IssueGroup {
  key: string;
  label: string;
  issues: Issue[];
}

export interface GroupIssuesContext {
  members: Member[];
  projects: Project[];
  /** Épicas indexadas por id, para resolver el título del grupo "epic". */
  epicsById: Record<string, Issue>;
}

const UNASSIGNED_LABEL: Record<Exclude<IssueGroupBy, 'none' | 'status' | 'priority'>, string> = {
  assignee: 'Sin asignar',
  project: 'Sin proyecto',
  epic: 'Sin épica',
};

export function groupIssues(
  issues: Issue[],
  groupBy: IssueGroupBy,
  ctx: GroupIssuesContext
): IssueGroup[] {
  if (groupBy === 'none') {
    return [{ key: 'all', label: '', issues }];
  }

  const buckets = new Map<string, Issue[]>();
  const keyFor = (issue: Issue): string => {
    switch (groupBy) {
      case 'status':
        return issue.status;
      case 'priority':
        return String(issue.priority);
      case 'assignee':
        return issue.assigneeId || UNASSIGNED;
      case 'project':
        return issue.projectId || UNASSIGNED;
      case 'epic':
        return issue.epicId || UNASSIGNED;
    }
  };

  issues.forEach((issue) => {
    const key = keyFor(issue);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(issue);
  });

  const labelFor = (key: string): string => {
    if (key === UNASSIGNED && groupBy !== 'status' && groupBy !== 'priority') {
      return UNASSIGNED_LABEL[groupBy];
    }
    switch (groupBy) {
      case 'status':
        return getStatusLabel(key);
      case 'priority':
        return getPriorityLabel(Number(key) as IssuePriority);
      case 'assignee':
        return ctx.members.find((m) => m.userId === key)?.displayName ?? key;
      case 'project':
        return ctx.projects.find((p) => p.id === key)?.name ?? key;
      case 'epic':
        return ctx.epicsById[key]?.title ?? key;
    }
  };

  const orderFor = (key: string): number => {
    if (key === UNASSIGNED) return Number.MAX_SAFE_INTEGER;
    if (groupBy === 'status') return ISSUE_STATUSES.find((s) => s.value === key)?.order ?? 99;
    if (groupBy === 'priority') return priorityRank(Number(key) as IssuePriority);
    return 0;
  };

  return Array.from(buckets.entries())
    .map(([key, groupedIssues]) => ({ key, label: labelFor(key), issues: groupedIssues }))
    .sort((a, b) => {
      const orderDiff = orderFor(a.key) - orderFor(b.key);
      return orderDiff !== 0 ? orderDiff : a.label.localeCompare(b.label);
    });
}
