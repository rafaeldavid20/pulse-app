import { describe, expect, it } from 'vitest';
import { completePql } from './pql-completion';
import { fixtureContext } from './pql/fixtures';

describe('PQL completion', () => {
  it('offers fields, compatible operators and values', () => {
    expect(completePql('sta', 3, fixtureContext)).toContainEqual(expect.objectContaining({ insert: 'status', start: 0, end: 3 }));
    expect(completePql('priority ', 9, fixtureContext)).toContainEqual(expect.objectContaining({ insert: '<=' }));
    expect(completePql('status IN (to', 13, fixtureContext)).toContainEqual(expect.objectContaining({ insert: '"todo"' }));
    expect(completePql('assignee = me', 13, fixtureContext)).toContainEqual(expect.objectContaining({ insert: 'me()' }));
  });
  it('recognizes values adjacent to comparison operators and preserves suffixes', () => {
    for (const [query, cursor, start, end] of [
      ['status=to', 9, 7, 9], ['status!=todo AND priority=2', 10, 8, 12],
      ['status IN(to,done)', 12, 10, 12],
    ] as const) {
      expect(completePql(query, cursor, fixtureContext)).toContainEqual(expect.objectContaining({ label: 'todo', start, end }));
    }
    const quoted = 'label="back" AND status=done';
    expect(completePql(quoted, 10, { ...fixtureContext, teamId: undefined })).toContainEqual(expect.objectContaining({ label: 'backend', start: 6, end: 12 }));
  });
  it('replaces only the token at the cursor including an incomplete quote', () => {
    const query = 'label = "back" AND status = done';
    const context = { ...fixtureContext, teamId: undefined };
    expect(completePql(query, 12, context)).toContainEqual(expect.objectContaining({ insert: '"backend"', start: 8, end: 14 }));
    expect(completePql('label = "back', 13, context)).toContainEqual(expect.objectContaining({ insert: '"backend"', start: 8, end: 13 }));
  });
});
