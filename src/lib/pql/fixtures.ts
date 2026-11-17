import type { Context } from './resolver';

/** Portable corpus for consumers of the generated backend copy. */
export const fixtureContext: Context = {
  workspaceId: 'fixture', actorId: 'user-a', now: '2024-01-31T12:00:00Z', teamId: 'team-a',
  members: [{ id: 'member-a', userId: 'user-a', displayName: 'Ada' }, { id: 'member-b', userId: 'user-b', displayName: 'Bob' }],
  agents: [{ id: 'agent-a', displayName: 'Build agent' }],
  teams: [{ id: 'team-a', key: 'TES', name: 'Equipo' }],
  projects: [{ id: 'project-a', name: 'Proyecto' }],
  labels: [{ id: 'label-a', name: 'backend' }, { id: 'label-b', name: 'urgente' }],
  cycles: [{ id: 'cycle-a', name: 'Ciclo', teamId: 'team-a', status: 'active', endsAt: '2024-02-29T12:00:00Z' }],
  issues: [{ id: 'epic-a', identifier: 'TES-122', type: 'epic' }, { id: 'issue-a', identifier: 'TES-123', type: 'story' }],
};
export const fixtureIssues = [
  { id: 'epic-a', identifier: 'TES-122', title: 'Épica', type: 'epic', teamId: 'team-a', status: 'todo', priority: 0, assigneeId: 'user-a', labelIds: ['label-a'], createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-30T00:00:00Z' },
  { id: 'issue-a', identifier: 'TES-123', title: 'Backend', type: 'story', epicId: 'epic-a', parentId: 'epic-a', teamId: 'team-a', status: 'in_progress', priority: 1, assigneeId: 'user-a', labelIds: ['label-b'], cycleId: 'cycle-a', dueDate: '2024-02-29T12:00:00Z', createdAt: '2024-01-02T00:00:00Z', updatedAt: '2024-01-30T00:00:00Z', review: { state: 'approved', reviewerId: 'user-b', verdict: 'Bien' } },
  { id: 'issue-b', identifier: 'TES-124', title: 'Otra tarea', teamId: 'team-a', status: 'done', priority: 2, labelIds: [], createdAt: '2024-01-03T00:00:00Z', updatedAt: '2024-01-25T00:00:00Z' },
];
export const fixtureCases = [
  { query: '', ids: ['issue-b', 'issue-a', 'epic-a'] },
  { query: 'epic = TES-122 AND assignee = me() ORDER BY priority ASC', ids: ['issue-a', 'epic-a'] },
  { query: 'label NOT IN (backend, urgente)', ids: ['issue-b'] },
  { query: 'assignee IS EMPTY OR review.state = approved', ids: ['issue-b', 'issue-a'] },
  { query: 'cycle = currentCycle() AND due = endOfCycle()', ids: ['issue-a'] },
  { query: 'due = +1m', ids: ['issue-a'] },
  { query: 'updated > -7d ORDER BY updated DESC, priority ASC', ids: ['issue-a', 'epic-a', 'issue-b'] },
  { query: 'type = task', ids: ['issue-b'] },
  { query: 'review.reviewer = Bob AND review.verdict ~ "bien"', ids: ['issue-a'] },
  { query: 'unknown = 1', code: 'FIELD' },
  { query: 'status IN ()', code: 'SYNTAX' },
  { query: 'assignee = Desconocido', code: 'REFERENCE' },
  ...[
    'status != done', 'status IN (todo, done)', 'status NOT IN (todo)', 'status IS EMPTY', 'status IS NOT EMPTY',
    'priority = 1', 'priority != 0', 'priority < 3', 'priority <= 2', 'priority > 0', 'priority >= 1', 'priority IN (1, 2)', 'priority NOT IN (0)',
    'type = epic', 'estimate IS EMPTY', 'assignee = user-a', 'creator = Ada', 'project = Proyecto', 'parent = TES-122', 'team = TES',
    'label = backend', 'label != backend', 'label IN (backend, urgente)', 'label NOT IN (urgente)', 'epic = TES-122', 'created < 2024-01-03',
    'updated >= -1w', 'due IS NOT EMPTY', 'agent.state IS EMPTY', 'git.prState IS EMPTY', 'review.state = approved', 'review.reviewer = Bob',
    'review.verdict = bien', 'text = Backend', 'text != missing', 'text ~ end', 'cycle = Ciclo', 'assignee = "Build agent"',
  ].map(query => ({ query, execute: true as const })),
  { query: 'assignee = Ada', code: 'REFERENCE', context: 'ambiguous' as const, diagnostic: { start: 11, end: 14, line: 1, column: 12 } },
  { query: 'project = foranea', code: 'REFERENCE', diagnostic: { start: 10, end: 17, line: 1, column: 11 } },
  { query: 'priority = "uno"', code: 'TYPE', diagnostic: { start: 11, end: 16, line: 1, column: 12 } },
  { query: 'status ~ done', code: 'OPERATOR', diagnostic: { start: 0, end: 13, line: 1, column: 1 } },
  { query: 'status IN ()', code: 'SYNTAX', diagnostic: { start: 11, end: 12, line: 1, column: 12 } },
  { query: 'due = 2024-02-30T12:00:00Z', code: 'TYPE', diagnostic: { start: 6, end: 26, line: 1, column: 7 } },
  { query: 'cycle != currentCycle()', ids: [], context: 'noCycle' as const },
  { query: 'cycle NOT IN (currentCycle())', ids: [], context: 'noCycle' as const },
  { query: 'unknown = 1', code: 'FIELD', diagnostic: { start: 0, end: 11, line: 1, column: 1 } },
  { query: 'status =', code: 'SYNTAX', diagnostic: { start: 8, end: 8, line: 1, column: 9 } },
  { query: 'due = 2024-01-01T00:00:00', code: 'TYPE', diagnostic: { start: 6, end: 25, line: 1, column: 7 } },
  { query: 'a'.repeat(4097), code: 'TEXT_LIMIT', diagnostic: { start: 4096, end: 4097, line: 1, column: 4097 } },
  { query: Array(501).fill('x').join(' '), code: 'TOKEN_LIMIT', diagnostic: { start: 1000, end: 1001, line: 1, column: 1001 } },
] as const;
