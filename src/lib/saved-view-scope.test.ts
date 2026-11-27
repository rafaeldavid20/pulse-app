import { expect, it } from 'vitest';
import { queryWithRouteScope } from './saved-view-scope';

it('retains route constraints and existing ordering when saving a view', () => {
  expect(queryWithRouteScope('status = todo OR status = done ORDER BY updated DESC', '/team/t/projects/p')).toBe('(status=todo OR status=done) AND project = "p" ORDER BY updated DESC');
  expect(queryWithRouteScope('', '/my-issues')).toBe('assignee = me()');
  expect(queryWithRouteScope('', '/team/t/cycles/c')).toBe('cycle = "c"');
});
