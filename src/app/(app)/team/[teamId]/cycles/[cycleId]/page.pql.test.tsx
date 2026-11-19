import { Suspense } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CycleDetailPage from './page';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';
import { useCycleStore } from '@/stores/cycleStore';
import type { Cycle, Issue, Member, Team, Workspace } from '@/types';

vi.mock('next/navigation', () => ({ usePathname: () => '/team/t1/cycles/c1' }));
// Keep the real Header, PqlBar, filtering and views; planning is unrelated.
vi.mock('@/components/cycles/CyclePlanningPanel', () => ({ CyclePlanningPanel: () => null }));
vi.mock('@/hooks/useListPreferences', () => ({ useListPreferences: () => {} }));
const all = [
  { id: 'epic-a', identifier: 'TES-101', number: 101, title: 'Épica relevante', type: 'epic', workspaceId: 'w1', teamId: 't1', status: 'todo', priority: 1 },
  { id: 'epic-b', identifier: 'TES-102', number: 102, title: 'Épica ajena al ciclo', type: 'epic', workspaceId: 'w1', teamId: 't1', status: 'todo', priority: 1 },
  { id: 'epic-other-team', identifier: 'TES-103', number: 103, title: 'Épica de otro equipo', type: 'epic', workspaceId: 'w1', teamId: 't2', status: 'todo', priority: 1 },
  { id: 'epic-other-ws', identifier: 'TES-104', number: 104, title: 'Épica de otro workspace', type: 'epic', workspaceId: 'w2', teamId: 't1', status: 'todo', priority: 1 },
  { id: 'parent-a', identifier: 'TES-105', number: 105, title: 'Padre relevante', type: 'story', workspaceId: 'w1', teamId: 't1', status: 'todo', priority: 1 },
  { id: 'child-a', identifier: 'TES-106', number: 106, title: 'Hijo del ciclo', type: 'task', workspaceId: 'w1', teamId: 't1', cycleId: 'c1', epicId: 'epic-a', parentId: 'parent-a', status: 'todo', priority: 1 },
  { id: 'bad-ref-team', identifier: 'TES-107', number: 107, title: 'Referencia a otro equipo', type: 'task', workspaceId: 'w1', teamId: 't1', cycleId: 'c1', epicId: 'epic-other-team', status: 'todo', priority: 1 },
  { id: 'bad-ref-ws', identifier: 'TES-108', number: 108, title: 'Referencia a otro workspace', type: 'task', workspaceId: 'w1', teamId: 't1', cycleId: 'c1', epicId: 'epic-other-ws', status: 'todo', priority: 1 },
] as Issue[];

beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear();
  useAppStore.getState().resetView();
  useAppStore.setState({ activeWorkspace: { id: 'w1' } as Workspace, workspaceUserId: 'u1', activeTeam: { id: 't1', workspaceId: 'w1', name: 'Equipo' } as Team,
    teams: [{ id: 't1', workspaceId: 'w1', name: 'Equipo' } as Team, { id: 't2', workspaceId: 'w1', name: 'Otro' } as Team],
    members: [{ id: 'm1', userId: 'u1', workspaceId: 'w1', displayName: 'Ada' } as Member],
    workspaceCatalogReady: true, workspaceCatalogError: null, activeView: 'list',
    pqlAgentCatalog: { workspaceId: 'w1', userId: 'u1', agents: [], loading: false, error: null } });
  useIssueStore.getState().setIssues(all);
  useCycleStore.getState().setCycles([{ id: 'c1', name: 'Ciclo Uno', workspaceId: 'w1', teamId: 't1', status: 'completed', startsAt: '2024-01-01', endsAt: '2024-02-01' }] as Cycle[]);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('suggests and executes a relevant epic from actual cycle issues, without unrelated or unauthorized epics', async () => {
  const params = Promise.resolve({ teamId: 't1', cycleId: 'c1' });
  await act(async () => { render(<Suspense fallback={null}><CycleDetailPage params={params} /></Suspense>); });
  fireEvent.click(screen.getByRole('button', { name: 'PQL' }));
  const input = screen.getByRole('combobox', { name: 'Consulta PQL' }) as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'epic = ' } });
  expect(screen.getByRole('option', { name: 'Épica relevante' })).toBeTruthy();
  expect(screen.queryByRole('option', { name: 'Épica ajena al ciclo' })).toBeNull();
  expect(screen.queryByRole('option', { name: 'Épica de otro equipo' })).toBeNull();
  expect(screen.queryByRole('option', { name: 'Épica de otro workspace' })).toBeNull();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(input.value).toBe('epic = "Épica relevante"');
  act(() => vi.advanceTimersByTime(200));
  expect(screen.getByRole('status').textContent).toContain('1 coincidencia');
  expect(screen.getByText('Hijo del ciclo')).toBeTruthy();
  expect(screen.queryByText('Referencia a otro equipo')).toBeNull();
  fireEvent.change(input, { target: { value: 'parent = ' } });
  expect(screen.getByRole('option', { name: 'Padre relevante' })).toBeTruthy();
  expect(screen.queryByRole('option', { name: 'Épica ajena al ciclo' })).toBeNull();
});
