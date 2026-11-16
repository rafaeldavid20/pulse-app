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
  it('replaces only the token at the cursor including an incomplete quote', () => {
    const query = 'label = "back" AND status = done';
    const context = { ...fixtureContext, teamId: undefined };
    expect(completePql(query, 12, context)).toContainEqual(expect.objectContaining({ insert: '"backend"', start: 8, end: 14 }));
    expect(completePql('label = "back', 13, context)).toContainEqual(expect.objectContaining({ insert: '"backend"', start: 8, end: 13 }));
  });
});
