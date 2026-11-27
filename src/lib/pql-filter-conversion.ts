import type { FilterState, IssueSortBy } from '@/types';
import { UNASSIGNED } from '@/lib/issueFilters';
import { parse, resolve, type Context, type ResolvedExpression } from '@/lib/pql';

const quote = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const filterFields = {
  status: 'status', priority: 'priority', type: 'type', assignee: 'assigneeIds',
  project: 'projectIds', epic: 'epicIds', label: 'labelIds', 'review.state': 'reviewStates',
} as const;
type FilterField = keyof typeof filterFields;
const blank = (): FilterState => ({ search: '', status: [], priority: [], type: [], assigneeIds: [], projectIds: [], epicIds: [], labelIds: [], reviewStates: [] });

export function filtersToPql(filters: FilterState, sortBy: IssueSortBy): string {
  const parts: string[] = [];
  if (filters.search) parts.push(`text ~ ${quote(filters.search)}`);
  for (const [field, key] of Object.entries(filterFields)) {
    const values = filters[key as keyof FilterState] as (string | number)[];
    if (!values.length) continue;
    const isEmpty = values.includes(UNASSIGNED);
    const actual = values.filter(v => v !== UNASSIGNED);
    const comparison = actual.length ? `${field} IN (${actual.map(v => typeof v === 'number' ? String(v) : quote(v)).join(', ')})` : '';
    parts.push(isEmpty && comparison ? `(${comparison} OR ${field} IS EMPTY)` : isEmpty ? `${field} IS EMPTY` : comparison);
  }
  const sort = sortBy === 'priority' ? 'priority ASC' : sortBy === 'updated' ? 'updated DESC' : '';
  if (sort) parts.push(`ORDER BY ${sort}`);
  return parts.join(' AND ').replace(' AND ORDER BY ', ' ORDER BY ');
}

export type ConversionResult = { ok: true; filters: FilterState; sortBy: IssueSortBy } | { ok: false; reason: string };
export function pqlToFilters(source: string, context: Context): ConversionResult {
  const parsed = parse(source);
  if (!parsed.ok) return { ok: false, reason: parsed.diagnostic.message };
  const result = resolve(source, parsed.query, context);
  if (!result.ok) return { ok: false, reason: result.diagnostic.message };
  const { expression, orderBy } = result.query;
  if (orderBy.length > 1) return { ok: false, reason: 'El orden múltiple no se puede expresar con filtros simples.' };
  let sortBy: IssueSortBy = 'created';
  if (orderBy.length) {
    const o = orderBy[0];
    if (o.field === 'priority' && o.direction === 'asc') sortBy = 'priority';
    else if ((o.field === 'created' || o.field === 'updated') && o.direction === 'desc') sortBy = o.field;
    else return { ok: false, reason: 'Este orden no se puede expresar con filtros simples.' };
  }
  const filters = blank();
  const seen = new Set<string>();
  const selection = (node: ResolvedExpression): { field: FilterField; values: (string | number)[] } | null => {
    if (node.kind === 'or') {
      const left = selection(node.left), right = selection(node.right);
      return left && right && left.field === right.field ? { field: left.field, values: [...left.values, ...right.values] } : null;
    }
    if (node.kind !== 'comparison' || !Object.hasOwn(filterFields, node.field)) return null;
    const field = node.field as FilterField;
    if (node.operator === 'is empty' && (field === 'assignee' || field === 'project')) return { field, values: [UNASSIGNED] };
    if (!['=', 'in'].includes(node.operator) || node.values.some(v => v === null)) return null;
    return { field, values: node.values as (string | number)[] };
  };
  const apply = (node: ResolvedExpression): boolean => {
    if (node.kind === 'and') return apply(node.left) && apply(node.right);
    if (node.kind === 'comparison' && node.field === 'text' && node.operator === '~' && typeof node.values[0] === 'string' && !seen.has('text')) {
      seen.add('text'); filters.search = node.values[0]; return true;
    }
    const selected = selection(node);
    if (!selected || seen.has(selected.field)) return false;
    seen.add(selected.field);
    const key = filterFields[selected.field];
    // Each registry entry above maps to an array with the corresponding validated values.
    (filters as unknown as Record<string, (string | number)[]>)[key] = [...new Set(selected.values)];
    return true;
  };
  if (expression && !apply(expression)) return { ok: false, reason: 'Esta consulta no se puede expresar sin perder condiciones en filtros simples.' };
  return { ok: true, filters, sortBy };
}
