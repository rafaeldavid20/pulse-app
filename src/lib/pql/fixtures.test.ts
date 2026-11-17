import { describe, expect, it } from 'vitest';
import { execute } from './evaluator';
import { parse } from './parser';
import { serialize } from './serializer';
import { fixtureCases, fixtureContexts, fixtureIssues } from './fixtures';

describe('portable PQL corpus', () => {
  for (const fixture of fixtureCases) it(fixture.query || 'empty query', () => {
    const context = fixtureContexts['context' in fixture ? fixture.context : 'default'];
    const result = execute(fixture.query, fixtureIssues, context);
    if ('ids' in fixture) {
      expect(result.ok && result.issues.map(issue => issue.id)).toEqual([...fixture.ids]);
      const parsed = parse(fixture.query);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) throw new Error(parsed.diagnostic.message);
      const roundTrip = execute(serialize(parsed.query), fixtureIssues, context);
      expect(roundTrip.ok && roundTrip.issues.map(issue => issue.id)).toEqual([...fixture.ids]);
    }
    else expect(result).toMatchObject({ ok: false, diagnostic: { code: fixture.code, ...fixture.diagnostic } });
  });
});
