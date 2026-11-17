import { describe, expect, it } from 'vitest';
import { execute } from './evaluator';
import { fixtureCases, fixtureContext, fixtureIssues } from './fixtures';

describe('portable PQL corpus', () => {
  for (const fixture of fixtureCases) it(fixture.query || 'empty query', () => {
    const result = execute(fixture.query, fixtureIssues, fixtureContext);
    if ('ids' in fixture) expect(result.ok && result.issues.map(issue => issue.id)).toEqual([...fixture.ids]);
    else expect(result).toMatchObject({ ok: false, diagnostic: { code: fixture.code, start: fixture.start, end: fixture.end } });
  });
});
