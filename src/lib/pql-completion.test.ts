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
  it('limits issue suggestions without using ambiguous names from outside the scope', () => {
    const context = { ...fixtureContext, issues: [
      { id: 'a', name: 'Duplicado', type: 'epic', teamId: 'team-a' },
      { id: 'b', name: 'Duplicado', type: 'epic', teamId: 'team-a' },
    ] };
    const suggestions = completePql('epic = ', 7, context, new Set(['a']));
    expect(suggestions).toEqual([expect.objectContaining({ label: 'a', insert: '"a"' })]);
  });
  it('matches escaped quote and backslash prefixes with incomplete input and intermediate cursors', () => {
    const context = { ...fixtureContext, teamId: undefined, labels: [
      { id: 'q', name: 'API "core"' },
      { id: 's', name: 'path\\server' },
      { id: 'a', name: "team's repo" },
    ] };
    const cases = [
      { query: String.raw`label = "API \"c`, prefix: String.raw`label = "API \"c`, name: 'API "core"', insert: String.raw`"API \"core\""` },
      { query: String.raw`label = "API \"core\"" AND status=done`, prefix: String.raw`label = "API \"c`, name: 'API "core"', insert: String.raw`"API \"core\""` },
      { query: String.raw`label IN ("path\\ser", "other")`, prefix: String.raw`label IN ("path\\s`, name: 'path\\server', insert: String.raw`"path\\server"` },
      { query: String.raw`label = 'team\'s`, prefix: String.raw`label = 'team\'s`, name: "team's repo", insert: `"team's repo"` },
      { query: String.raw`label = "API ` + '\\', prefix: String.raw`label = "API ` + '\\', name: 'API "core"', insert: String.raw`"API \"core\""` },
      { query: String.raw`label = "path\\`, prefix: String.raw`label = "path` + '\\', name: 'path\\server', insert: String.raw`"path\\server"` },
    ];
    for (const { query, prefix, name, insert } of cases) {
      const result = completePql(query, prefix.length, context).find(item => item.label === name);
      expect(result, query).toEqual(expect.objectContaining({ insert, start: query.indexOf('"') === -1 ? query.indexOf("'") : query.indexOf('"') }));
      const replaced = query.slice(0, result!.start) + result!.insert + query.slice(result!.end);
      expect(replaced.slice(result!.start, result!.start + insert.length)).toBe(insert);
      if (query.includes(' AND ')) expect(replaced.endsWith(' AND status=done')).toBe(true);
      if (query.includes(', ')) expect(replaced.endsWith(', "other")')).toBe(true);
    }
    const complete = String.raw`label = "API \"core\""`;
    expect(completePql(complete, complete.length, context)).toContainEqual(expect.objectContaining({ label: 'API "core"' }));
  });
  it('replaces only the token at the cursor including an incomplete quote', () => {
    const query = 'label = "back" AND status = done';
    const context = { ...fixtureContext, teamId: undefined };
    expect(completePql(query, 12, context)).toContainEqual(expect.objectContaining({ insert: '"backend"', start: 8, end: 14 }));
    expect(completePql('label = "back', 13, context)).toContainEqual(expect.objectContaining({ insert: '"backend"', start: 8, end: 13 }));
  });
});
