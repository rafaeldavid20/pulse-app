import { fields, operatorsFor, type Context, type Entity } from '@/lib/pql';

export interface Suggestion { label: string; insert: string; start: number; end: number }
const quote = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
function tokenBounds(source: string, cursor: number): { start: number; end: number; text: string } {
  let start = cursor;
  while (start > 0 && !/[\s(),]/.test(source[start - 1])) start--;
  let end = cursor;
  while (end < source.length && !/[\s(),]/.test(source[end])) end++;
  const quoteStart = Math.max(source.lastIndexOf('"', cursor - 1), source.lastIndexOf("'", cursor - 1));
  if (quoteStart >= 0 && (quoteStart === 0 || /[\s(,]/.test(source[quoteStart - 1]))) {
    const q = source[quoteStart];
    let close = quoteStart + 1;
    while (close < source.length && (source[close] !== q || source[close - 1] === '\\')) close++;
    if (close >= cursor) { start = quoteStart; end = Math.min(source.length, close + 1); }
  }
  return { start, end, text: source.slice(start, cursor).replace(/^["']/, '').toLowerCase() };
}
const names = (items: Entity[]): string[] => items.map(item => {
  const name = item.displayName ?? item.name ?? item.identifier ?? item.key ?? item.id;
  const duplicates = items.filter(other => (other.displayName ?? other.name ?? other.identifier ?? other.key ?? other.id).toLowerCase() === name.toLowerCase());
  return duplicates.length > 1 ? item.userId ?? item.id : name;
});
export function completePql(source: string, cursor: number, context: Context): Suggestion[] {
  const token = tokenBounds(source, cursor);
  const before = source.slice(0, token.start);
  const order = /\border\s+by\s+(?:[^,]+,\s*)?$/i.test(before);
  const valueMatch = /([\w.]+)\s+(?:not\s+in|in|!=|=|<=|>=|<|>|~)\s*(?:\([^)]*)?$/i.exec(before);
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
    const catalog = field === 'assignee' || field === 'creator' || field === 'review.reviewer' ? context.members
      : field === 'team' ? context.teams : field === 'project' ? context.projects : field === 'label' ? context.labels
      : field === 'cycle' ? context.cycles : field === 'epic' ? context.issues.filter(i => i.type === 'epic') : field === 'parent' ? context.issues : [];
    const scopedCatalog = context.teamId && ['project', 'label', 'cycle', 'epic', 'parent'].includes(field) ? catalog.filter(item => item.teamId === context.teamId) : catalog;
    const values = spec.values ? [...spec.values] : names(scopedCatalog);
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
