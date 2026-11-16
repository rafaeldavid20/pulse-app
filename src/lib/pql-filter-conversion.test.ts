import { describe, expect, it } from 'vitest';
import { fixtureContext } from './pql/fixtures';
import { filtersToPql, pqlToFilters } from './pql-filter-conversion';
import { UNASSIGNED } from './issueFilters';
import type { FilterState } from '@/types';

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
});
