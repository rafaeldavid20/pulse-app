import { parse, serialize } from '@/lib/pql';

const quote = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
/** Makes implicit route filters explicit before a view leaves that route. */
export function queryWithRouteScope(source: string, pathname: string): string {
  const parsed = parse(source);
  if (!parsed.ok) throw new Error(parsed.diagnostic.message);
  const match = /^\/team\/[^/]+\/(projects|cycles)\/([^/]+)\/?$/.exec(pathname);
  const constraint = match ? `${match[1] === 'projects' ? 'project' : 'cycle'} = ${quote(decodeURIComponent(match[2]))}` : pathname === '/my-issues' ? 'assignee = me()' : '';
  if (!constraint) return source;
  const predicate = serialize({ expression: parsed.query.expression, orderBy: [] });
  const order = serialize({ orderBy: parsed.query.orderBy });
  return [predicate ? `(${predicate}) AND ${constraint}` : constraint, order].filter(Boolean).join(' ');
}
