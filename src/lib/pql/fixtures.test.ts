import { describe, expect, it } from 'vitest';
import { execute } from './evaluator';
import { fixtureCases, fixtureContext, fixtureIssues } from './fixtures';

describe('portable PQL corpus', () => {
  for (const fixture of fixtureCases) it(fixture.query || 'empty query', () => {
    const context = 'context' in fixture && fixture.context === 'noCycle' ? { ...fixtureContext, cycles: [] }
      : 'context' in fixture && fixture.context === 'ambiguous' ? { ...fixtureContext, members: [...fixtureContext.members, { id: 'member-c', userId: 'user-c', displayName: 'Ada' }] }
      : fixtureContext;
    const result = execute(fixture.query, fixtureIssues, context);
    if ('ids' in fixture) expect(result.ok && result.issues.map(issue => issue.id)).toEqual([...fixture.ids]);
    else if ('execute' in fixture) expect(result.ok).toBe(true);
    else expect(result).toMatchObject({ ok: false, diagnostic: { code: fixture.code, ...('diagnostic' in fixture ? fixture.diagnostic : {}) } });
  });
});
