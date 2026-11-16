import { describe, expect, it } from 'vitest';
import { fixtureContext } from './pql/fixtures';
import { filtersToPql, pqlToFilters } from './pql-filter-conversion';
import { UNASSIGNED } from './issueFilters';
import { applyIssueFilters } from './issueFilters';
import { execute } from './pql';
import { fixtureIssues } from './pql/fixtures';
import type { FilterState, Issue } from '@/types';

describe('PQL and simple filters', () => {
  it('round trips supported filters, including unassigned and escaped text', () => {
    const filters: FilterState = { search: 'a "quoted" \\ name', status: ['todo', 'in_progress'], priority: [0, 2], type: ['story'], assigneeIds: ['user-a', UNASSIGNED], projectIds: [UNASSIGNED], epicIds: ['epic-a'], labelIds: ['label-a', 'label-b'], reviewStates: ['approved'] };
    expect(pqlToFilters(filtersToPql(filters, 'priority'), fixtureContext)).toEqual({ ok: true, filters, sortBy: 'priority' });
  });
  it('does not discard unsupported expressions or multiple sorting terms', () => {
    for (const query of ['status = todo OR assignee = me()', 'NOT status = done', 'priority < 3', 'status = todo AND status = done', 'ORDER BY priority ASC, updated DESC', 'ORDER BY estimate DESC']) {
      expect(pqlToFilters(query, fixtureContext).ok, query).toBe(false);
    }
  });
  it('matches simple filters for unassigned, labels, QA and the epic root', () => {
    const base: FilterState = { search: '', status: [], priority: [], type: [], assigneeIds: [], projectIds: [], epicIds: [], labelIds: [], reviewStates: [] };
    const cases: Partial<FilterState>[] = [
      { assigneeIds: [UNASSIGNED, 'user-a'] }, { labelIds: ['label-a', 'label-b'] },
      { epicIds: ['epic-a'] }, { reviewStates: ['approved'] }, { search: 'TES-12' },
      { priority: [0, 2], status: ['todo', 'done'] },
    ];
    for (const patch of cases) {
      const filters = { ...base, ...patch };
      const reference = applyIssueFilters(fixtureIssues as unknown as Issue[], filters).map(i => i.id).sort();
      const result = execute(filtersToPql(filters, 'manual'), fixtureIssues, fixtureContext);
      expect(result.ok && result.issues.map(i => i.id).sort()).toEqual(reference);
    }
  });
});
