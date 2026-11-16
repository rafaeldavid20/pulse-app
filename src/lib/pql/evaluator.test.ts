import { describe, expect, it } from 'vitest';
import { execute } from './evaluator';
import { parse } from './parser';
import { serialize } from './serializer';
import type { Context } from './resolver';

const context: Context = {
  workspaceId: 'ws', actorId: 'u1', now: '2024-01-31T12:00:00Z', teamId: 't1',
  members: [{ id: 'm1', userId: 'u1', displayName: 'Ana' }],
  teams: [{ id: 't1', key: 'TES', name: 'Team' }], projects: [],
  labels: [{ id: 'l1', name: 'backend' }], cycles: [{ id: 'c1', teamId: 't1', status: 'active', endsAt: '2024-02-15T00:00:00Z' }],
  issues: [{ id: 'e1', identifier: 'TES-122', type: 'epic' }],
};
const issues = [
  { id: 'e1', type: 'epic', title: 'Epic', status: 'todo', priority: 0, assigneeId: 'u1', labelIds: ['l1'], createdAt: '2024-01-01T00:00:00Z' },
  { id: 'i1', epicId: 'e1', title: 'Task', status: 'in_progress', priority: 1, assigneeId: 'u1', labelIds: ['l1'], createdAt: '2024-01-02T00:00:00Z' },
  { id: 'i2', title: 'Other', status: 'todo', priority: 2, labelIds: [], createdAt: '2024-01-03T00:00:00Z' },
];
describe('PQL evaluation', () => {
  it('resolves identity, labels and inclusive epic before sorting', () => {
    const result = execute('epic = TES-122 AND assignee = me() AND label IN (backend) ORDER BY priority ASC', issues, context);
    expect(result.ok && result.issues.map(i => i.id)).toEqual(['i1', 'e1']);
  });
  it('distinguishes empty scalar from empty label set and preserves input', () => {
    expect(execute('assignee != me()', issues, context)).toMatchObject({ ok: true, issues: [] });
    expect(execute('label != backend', issues, context)).toMatchObject({ ok: true, issues: [{ id: 'i2' }] });
    expect(issues.map(i => i.id)).toEqual(['e1', 'i1', 'i2']);
  });
  it('resolves UTC calendar months and requires an explicit cycle team', () => {
    const dated = [{ id: 'a', dueDate: '2024-02-29T12:00:00Z' }];
    expect(execute('due = +1m', dated, context)).toMatchObject({ ok: true, issues: [{ id: 'a' }] });
    expect(execute('cycle = currentCycle()', issues, { ...context, teamId: undefined })).toMatchObject({ ok: false, diagnostic: { code: 'CONTEXT' } });
  });
  it('rejects ambiguous references and invalid fields', () => {
    expect(execute('assignee = Ana', issues, { ...context, members: [...context.members, { id: 'm2', userId: 'u2', displayName: 'Ana' }] })).toMatchObject({ ok: false, diagnostic: { code: 'REFERENCE' } });
    expect(execute('nope = x', issues, context)).toMatchObject({ ok: false, diagnostic: { code: 'FIELD' } });
  });
  it('preserves semantics when serialized and rejects normalized invalid dates', () => {
    const input = 'NOT (label = backend OR assignee IS EMPTY) AND text ~ "a\\"b" ORDER BY created DESC, priority ASC';
    const parsed = parse(input);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const serialized = serialize(parsed.query);
    expect(execute(serialized, issues, context)).toEqual(execute(input, issues, context));
    expect(execute('due = 2024-02-30T12:00:00Z', issues, context)).toMatchObject({ ok: false, diagnostic: { code: 'TYPE' } });
  });
  it('rejects unsafe field names and out-of-range relative dates', () => {
    expect(execute('constructor = x', issues, context)).toMatchObject({ ok: false, diagnostic: { code: 'FIELD' } });
    expect(execute('due = +999999999999999999999m', issues, context)).toMatchObject({ ok: false, diagnostic: { code: 'TYPE' } });
  });
});
