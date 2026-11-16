import { describe, expect, it } from 'vitest';
import { parse } from './parser';

describe('PQL parser', () => {
  it('respects precedence and multiple order terms', () => {
    const result = parse('status = todo OR status = in_progress AND NOT assignee IS EMPTY ORDER BY priority ASC, updated DESC');
    expect(result).toMatchObject({ ok: true, query: { expression: { kind: 'or', right: { kind: 'and', right: { kind: 'not' } } }, orderBy: [{ field: 'priority', direction: 'asc' }, { field: 'updated', direction: 'desc' }] } });
  });
  it('supports empty queries, functions and nonempty lists', () => {
    expect(parse('')).toMatchObject({ ok: true, query: { orderBy: [] } });
    expect(parse('assignee = me() AND status NOT IN (todo, done)')).toMatchObject({ ok: true });
    for (const query of ['status IN ()', 'status IN (todo,)', 'status = todo trailing', 'status = null AND', 'ORDER BY']) {
      expect(parse(query).ok, query).toBe(false);
    }
  });
  it('rejects excessive nesting and ordering', () => {
    expect(parse(`${'('.repeat(21)}status = todo${')'.repeat(21)}`).ok).toBe(false);
    expect(parse('ORDER BY a,b,c,d,e,f').ok).toBe(false);
  });
});
