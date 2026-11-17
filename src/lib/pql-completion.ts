import { fields, operatorsFor, type Context, type Entity } from '@/lib/pql';

export interface Suggestion { label: string; insert: string; start: number; end: number }
const quote = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
function tokenBounds(source: string, cursor: number): { start: number; end: number; text: string } {
  // Mirror the tokenizer's delimiters while tolerating unfinished strings.
  // Scan quoted tokens as a unit so escaped quotes and operators inside strings
  // never affect replacement boundaries.
  const delimiter = /[\s(),=!<>~"']/;
  let i = 0;
  while (i < source.length) {
    const start = i;
    const char = source[i];
    if (char === '"' || char === "'") {
      i++;
      while (i < source.length) {
        if (source[i] === '\\') { i = Math.min(i + 2, source.length); continue; }
        if (source[i++] === char) break;
      }
      if (cursor > start && cursor <= i) return { start, end: i, text: source.slice(start + 1, cursor).toLowerCase() };
    } else if (delimiter.test(char)) {
      i++;
    } else {
      while (i < source.length && !delimiter.test(source[i])) i++;
      if (cursor >= start && cursor <= i) return { start, end: i, text: source.slice(start, cursor).toLowerCase() };
    }
  }
  return { start: cursor, end: cursor, text: '' };
}

const label = (item: Entity) => item.displayName ?? item.name ?? item.identifier ?? item.key ?? item.id;
const names = (items: Entity[], all: Entity[] = items): string[] => {
  const counts = new Map<string, number>();
  for (const item of all) { const key = label(item).toLowerCase(); counts.set(key, (counts.get(key) ?? 0) + 1); }
  return items.map(item => (counts.get(label(item).toLowerCase()) ?? 0) > 1 ? item.userId ?? item.id : label(item));
};
export function completePql(source: string, cursor: number, context: Context, allowedIssueIds?: ReadonlySet<string>): Suggestion[] {
  const token = tokenBounds(source, cursor);
  const before = source.slice(0, token.start);
  const order = /\border\s+by\s+(?:[^,]+,\s*)?$/i.test(before);
  const valueMatch = /([\w.]+)\s*(?:not\s+in\b|in\b|!=|<=|>=|=|<|>|~)\s*(?:\([^)]*)?$/i.exec(before);
  const fieldMatch = /(?:^|\b(?:and|or|not)\s+|\()([\w.]+)\s+$/i.exec(before);
  const emptyKeyword = /\bis\s+(?:not\s+)?$/i.test(before);
  const orderDirection = /\border\s+by\s+(?:[^,]+,\s*)?[\w.]+\s+$/i.test(before);
  const connector = !valueMatch && !fieldMatch && /(?:[\w"']|\))\s+$/.test(before) && /(?:=|!=|<=|>=|<|>|~|\bin\b|\bempty\b)/i.test(before);
  let options: { label: string; insert: string }[];
  if (emptyKeyword) {
    options = ['EMPTY', ...(/\bis\s+$/i.test(before) ? ['NOT EMPTY'] : [])].map(value => ({ label: value, insert: value }));
  } else if (orderDirection) {
    options = ['ASC', 'DESC'].map(value => ({ label: value, insert: value }));
  } else if (connector) {
    options = ['AND', 'OR', 'ORDER BY'].map(value => ({ label: value, insert: value }));
  } else if (order || (!valueMatch && !fieldMatch)) {
    options = Object.entries(fields).filter(([, spec]) => !order || spec.sortable).map(([field]) => ({ label: field, insert: field }));
  } else if (valueMatch) {
    const field = valueMatch[1].toLowerCase();
    const spec = Object.hasOwn(fields, field) ? fields[field] : undefined;
    if (!spec) return [];
    const catalog = field === 'assignee' || field === 'creator' || field === 'review.reviewer' ? [...context.members, ...context.agents]
      : field === 'team' ? context.teams : field === 'project' ? context.projects : field === 'label' ? context.labels
      : field === 'cycle' ? context.cycles : field === 'epic' ? context.issues.filter(i => i.type === 'epic') : field === 'parent' ? context.issues : [];
    const scopedCatalog = context.teamId && ['project', 'label', 'cycle', 'epic', 'parent'].includes(field) ? catalog.filter(item => item.teamId === context.teamId) : catalog;
    const visibleCatalog = allowedIssueIds && (field === 'parent' || field === 'epic') ? scopedCatalog.filter(item => allowedIssueIds.has(item.id)) : scopedCatalog;
    const values = spec.values ? [...spec.values] : names(visibleCatalog, catalog);
    options = values.map(value => ({ label: value, insert: quote(value) }));
    const functions = field === 'assignee' || field === 'creator' || field === 'review.reviewer' ? ['me()']
      : field === 'cycle' ? ['currentCycle()'] : spec.type === 'date' ? ['now()', 'startOfWeek()', 'endOfCycle()'] : [];
    options.push(...functions.map(fn => ({ label: fn, insert: fn })));
  } else {
    const field = fieldMatch![1].toLowerCase();
    const spec = Object.hasOwn(fields, field) ? fields[field] : undefined;
    options = spec ? operatorsFor(spec.type).map(op => ({ label: op.toUpperCase(), insert: op.toUpperCase() })) : [];
  }
  return options.filter(o => o.label.toLowerCase().startsWith(token.text)).slice(0, 20).map(o => ({ ...o, start: token.start, end: token.end }));
}
