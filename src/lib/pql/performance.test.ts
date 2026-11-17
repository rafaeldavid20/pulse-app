import { expect, it } from 'vitest';
import { execute } from './evaluator';
import { fixtureContext } from './fixtures';

it('evaluates and sorts 5000 issues without mutating the input', () => {
  const issues = Array.from({ length: 5000 }, (_, n) => ({ id: `i${String(n).padStart(5, '0')}`, status: n % 2 ? 'todo' : 'done', priority: n % 5, createdAt: '2024-01-01T00:00:00Z' }));
  const start = performance.now();
  const result = execute('status = todo ORDER BY priority ASC, created DESC', issues, fixtureContext);
  const elapsed = performance.now() - start;
  expect(result.ok && result.issues).toHaveLength(2500);
  expect(issues[0].id).toBe('i00000');
  if (process.env.PQL_BENCH) console.info(`PQL 5000 issues: ${elapsed.toFixed(2)} ms; Node ${process.version}; ${process.platform}/${process.arch}`);
});
