import {
  Issue,
  IssueType,
  ALLOWED_PARENT_TYPES,
  canHaveParent,
  isCompletedStatus,
} from '@/types';

/**
 * Consultas de jerarquía sobre el array de issues que ya está en el store.
 *
 * Se calcula todo desde el array en memoria en vez de leer los contadores
 * denormalizados (`subIssueCount`/`subIssueDoneCount`): el store tiene la
 * suscripción completa del workspace, así que el árbol real está acá y no puede
 * quedar desfasado. Los contadores existen para el backend y el MCP, donde
 * cargar N hijos por cada barra de progreso sí costaría lecturas.
 */

export function isEpic(issue: Issue): boolean {
  return (issue.type ?? 'task') === 'epic';
}

export function epicsOf(issues: Issue[]): Issue[] {
  return issues.filter(isEpic);
}

/** Hijos directos de un issue, en orden estable. */
export function childrenOf(issues: Issue[], parentId: string): Issue[] {
  return issues
    .filter((i) => i.parentId === parentId)
    .sort((a, b) => a.number - b.number);
}

/** Todo el subárbol de una épica (a cualquier profundidad), vía el `epicId` denormalizado. */
export function descendantsOfEpic(issues: Issue[], epicId: string): Issue[] {
  return issues.filter((i) => i.epicId === epicId);
}

export interface Progress {
  total: number;
  closed: number;
  /** 0–100. Vale 0 cuando no hay hijos, no 100: una épica vacía no está lista. */
  percent: number;
}

export function progressFrom(items: Issue[]): Progress {
  const total = items.length;
  const closed = items.filter((i) => isCompletedStatus(i.status)).length;
  return { total, closed, percent: total === 0 ? 0 : Math.round((closed / total) * 100) };
}

/**
 * Progreso de un issue contenedor: para una épica cuenta todo su subárbol, para
 * cualquier otro solo sus hijos directos.
 */
export function progressOf(issues: Issue[], issue: Issue): Progress {
  return progressFrom(
    isEpic(issue) ? descendantsOfEpic(issues, issue.id) : childrenOf(issues, issue.id)
  );
}

/**
 * Issues que pueden ser padre de uno de tipo `type`, según la tabla compartida
 * de reglas. Excluye al propio issue y a su subárbol, que crearían un ciclo —
 * el backend igual lo rechaza, pero no tiene sentido ofrecerlo en un selector.
 */
export function validParentsFor(issues: Issue[], type: IssueType, selfId?: string): Issue[] {
  const allowed = ALLOWED_PARENT_TYPES[type];
  if (allowed.length === 0) return [];

  const excluded = selfId ? new Set(subtreeIdsOf(issues, selfId)) : new Set<string>();

  return issues
    .filter((i) => !excluded.has(i.id) && canHaveParent(type, i.type ?? 'task'))
    .sort((a, b) => a.identifier.localeCompare(b.identifier, undefined, { numeric: true }));
}

/** Ids del subárbol de `rootId`, incluyéndolo. */
export function subtreeIdsOf(issues: Issue[], rootId: string): string[] {
  const ids = [rootId];
  let frontier = [rootId];

  while (frontier.length > 0) {
    const next = issues.filter((i) => i.parentId && frontier.includes(i.parentId)).map((i) => i.id);
    const fresh = next.filter((id) => !ids.includes(id));
    if (fresh.length === 0) break;
    ids.push(...fresh);
    frontier = fresh;
  }

  return ids;
}

/** Cadena de ancestros de un issue, de la raíz hacia abajo, sin incluirlo. */
export function ancestorsOf(issues: Issue[], issue: Issue): Issue[] {
  const chain: Issue[] = [];
  let current = issue;

  // El tope evita un loop infinito si quedaran datos con un ciclo de antes de
  // que el backend validara la jerarquía.
  for (let hops = 0; current.parentId && hops < 8; hops++) {
    const parent = issues.find((i) => i.id === current.parentId);
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }

  return chain;
}
