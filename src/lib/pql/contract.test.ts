import { describe, expect, it } from 'vitest';
import { execute } from './evaluator';
import { fixtureContext as ctx, fixtureIssues as issues } from './fixtures';

function ids(query: string) {
  const result = execute(query, issues, ctx);
  if (!result.ok) throw new Error(`${result.diagnostic.code}: ${result.diagnostic.message}`);
  return result.issues.map(i => i.id);
}
describe('PQL contract edge cases', () => {
  it('uses boolean precedence, explicit NOT, and case-insensitive words', () => {
    expect(ids('STATUS = todo OR status = in_progress AND NOT assignee IS EMPTY')).toEqual(['issue-a', 'epic-a']);
    expect(ids('(status = todo OR status = in_progress) AND assignee IS EMPTY')).toEqual([]);
  });
  it('handles text literally and labels as set membership', () => {
    expect(ids('text ~ "TES-12"')).toEqual(['issue-b', 'issue-a', 'epic-a']);
    expect(ids('label IS EMPTY')).toEqual(['issue-b']);
    expect(ids('label = urgente')).toEqual(['issue-a']);
    expect(ids('label != urgente')).toEqual(['issue-b', 'epic-a']);
  });
  it('uses UTC relative times and start of week', () => {
    expect(ids('updated >= startOfWeek()')).toEqual(['issue-a', 'epic-a']);
    expect(ids('updated < -1w')).toEqual([]);
    expect(ids('updated < -2d')).toEqual(['issue-b']);
  });
  it('fails closed for invalid syntax, types, enum values and unsupported ordering', () => {
    for (const query of ['status = missing', 'priority = 5', 'priority ~ 2', 'ORDER BY label', 'ORDER BY review.verdict', 'status = null', 'updated = 2024-01-31T10:00:00', 'assignee = no-such-user', 'status = todo status = done']) {
      expect(execute(query, issues, ctx).ok, query).toBe(false);
    }
  });
  it('handles absent and conflicting active cycles explicitly', () => {
    const noCycles = { ...ctx, cycles: [] };
    expect(execute('cycle = currentCycle()', issues, noCycles)).toMatchObject({ ok: true, issues: [] });
    expect(execute('due = endOfCycle()', issues, noCycles)).toMatchObject({ ok: false, diagnostic: { code: 'CONTEXT' } });
    expect(execute('cycle = currentCycle()', issues, { ...ctx, cycles: [...ctx.cycles, { id: 'c2', teamId: 'team-a', status: 'active' }] })).toMatchObject({ ok: false, diagnostic: { code: 'CONTEXT' } });
  });
  it('orders empty values last and applies a stable id tie-breaker', () => {
    const tied = [{ id: 'b', priority: 1 }, { id: 'a', priority: 1 }, { id: 'c' }];
    for (const direction of ['ASC', 'DESC']) {
      const result = execute(`ORDER BY priority ${direction}`, tied, ctx);
      expect(result.ok && result.issues.map(i => i.id)).toEqual(['a', 'b', 'c']);
    }
  });
  it('resolves every supported field against its authorized catalog', () => {
    const comprehensive = [{ id: 'issue-a', identifier: 'TES-123', title: 'Backend', type: 'story', status: 'in_review', priority: 2, estimate: 5, assigneeId: 'user-a', creatorId: 'user-b', projectId: 'project-a', parentId: 'epic-a', epicId: 'epic-a', teamId: 'team-a', cycleId: 'cycle-a', labelIds: ['label-a'], createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-30T00:00:00Z', dueDate: '2024-02-29T12:00:00Z', agent: { state: 'blocked' }, git: { prState: 'open' }, review: { state: 'approved', reviewerId: 'user-b', verdict: 'Looks good' } }];
    const query = 'status = in_review AND priority <= 2 AND type = story AND estimate = 5 AND assignee = Ada AND creator = Bob AND project = Proyecto AND parent = TES-122 AND epic = TES-122 AND team = TES AND cycle = currentCycle() AND label = backend AND created >= 2024-01-01 AND updated > -2d AND due = endOfCycle() AND agent.state = blocked AND git.prState = open AND review.state = approved AND review.reviewer = Bob AND review.verdict ~ "good" AND text ~ "backend"';
    expect(execute(query, comprehensive, ctx)).toMatchObject({ ok: true, issues: [{ id: 'issue-a' }] });
    expect(execute('assignee = member-a', comprehensive, ctx)).toMatchObject({ ok: false, diagnostic: { code: 'REFERENCE' } });
    expect(execute('epic = TES-123', comprehensive, ctx)).toMatchObject({ ok: false, diagnostic: { code: 'REFERENCE' } });
  });
  it('parses numeric exponents and ISO instants with offsets', () => {
    expect(ids('priority = 2e0')).toEqual(['issue-b']);
    expect(ids('due = 2024-02-29T09:00-03:00')).toEqual(['issue-a']);
  });
});
