import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PqlBar } from './PqlBar';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';
import { useLabelStore } from '@/stores/labelStore';
import { useProjectStore } from '@/stores/projectStore';
import { useCycleStore } from '@/stores/cycleStore';
import type { Issue, Member, Team, Workspace } from '@/types';
import type { AgentSummary } from '@/lib/firestore';

const route = vi.hoisted(() => ({ path: '/team/t1/projects/p1' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.path }));
const all = [
  { id: 'e1', identifier: 'TES-101', title: 'Proyecto Uno', type: 'epic', workspaceId: 'w1', teamId: 't1', projectId: 'p1', cycleId: 'c1', status: 'todo', assigneeId: 'agent-a' },
  { id: 'e2', identifier: 'TES-102', title: 'Proyecto Dos', type: 'epic', workspaceId: 'w1', teamId: 't1', projectId: 'p2', cycleId: 'c2', status: 'todo' },
  { id: 'i1', identifier: 'TES-103', title: 'Tarea Uno', type: 'story', workspaceId: 'w1', teamId: 't1', projectId: 'p1', cycleId: 'c1', status: 'todo' },
  { id: 'i2', identifier: 'TES-104', title: 'Tarea Dos', type: 'story', workspaceId: 'w1', teamId: 't1', projectId: 'p2', cycleId: 'c2', status: 'todo' },
] as Issue[];

beforeEach(() => {
  vi.useFakeTimers(); route.path = '/team/t1/projects/p1';
  useAppStore.getState().resetView();
  useAppStore.setState({ activeWorkspace: { id: 'w1' } as Workspace, workspaceUserId: 'user-a', workspaceCatalogReady: true, workspaceCatalogError: null,
    teams: [{ id: 't1', workspaceId: 'w1', name: 'Equipo Uno' } as Team, { id: 't2', workspaceId: 'w1', name: 'Equipo Dos' } as Team], members: [{ id: 'm1', userId: 'user-a', displayName: 'Ada', workspaceId: 'w1' } as Member],
    pqlAgentCatalog: { workspaceId: 'w1', userId: 'user-a', loading: false, error: null, agents: [{ id: 'agent-a', workspaceId: 'w1', displayName: 'Build Agent' } as AgentSummary] },
  });
  useIssueStore.getState().setIssues(all);
  useProjectStore.getState().setProjects([
    { id: 'p1', teamId: 't1', name: 'Proyecto Alpha' },
    { id: 'p2', teamId: 't1', name: 'Proyecto Beta' },
    { id: 'p3', teamId: 't2', name: 'Proyecto Otro Equipo' },
  ] as import('@/types').Project[]);
  useCycleStore.getState().setCycles([
    { id: 'c1', teamId: 't1', workspaceId: 'w1', name: 'Ciclo Alpha' },
    { id: 'c2', teamId: 't1', workspaceId: 'w1', name: 'Ciclo Beta' },
    { id: 'c3', teamId: 't2', workspaceId: 'w1', name: 'Ciclo Otro Equipo' },
    { id: 'c4', teamId: 't1', workspaceId: 'w2', name: 'Ciclo Otro Workspace' },
  ] as import('@/types').Cycle[]);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('limits parent and epic suggestions to the project or cycle scope without narrowing resolution', () => {
  const { rerender } = render(<PqlBar issues={all.filter(i => i.projectId === 'p1')} />);
  fireEvent.click(screen.getByRole('button', { name: 'PQL' }));
  const input = screen.getByRole('combobox', { name: 'Consulta PQL' });
  fireEvent.change(input, { target: { value: 'epic = ' } });
  expect(screen.getByRole('option', { name: 'Proyecto Uno' })).toBeTruthy();
  expect(screen.queryByRole('option', { name: 'Proyecto Dos' })).toBeNull();
  fireEvent.change(input, { target: { value: 'parent = ' } });
  expect(screen.getByRole('option', { name: 'Tarea Uno' })).toBeTruthy();
  expect(screen.queryByRole('option', { name: 'Tarea Dos' })).toBeNull();
  route.path = '/team/t1/cycles/c2';
  rerender(<PqlBar issues={all.filter(i => i.cycleId === 'c2')} />);
  fireEvent.change(input, { target: { value: 'epic = ' } });
  expect(screen.getByRole('option', { name: 'Proyecto Dos' })).toBeTruthy();
  expect(screen.queryByRole('option', { name: 'Proyecto Uno' })).toBeNull();
  fireEvent.change(input, { target: { value: 'parent = ' } });
  expect(screen.getByRole('option', { name: 'Tarea Dos' })).toBeTruthy();
  expect(screen.queryByRole('option', { name: 'Tarea Uno' })).toBeNull();
  fireEvent.change(input, { target: { value: 'parent = TES-103' } });
  act(() => vi.advanceTimersByTime(200));
  expect(useAppStore.getState().pqlApplied).toBe('parent = TES-103');
});

it('inserts an authorized agent and resolves it to matching issues', () => {
  render(<PqlBar issues={all.filter(i => i.projectId === 'p1')} />);
  fireEvent.click(screen.getByRole('button', { name: 'PQL' }));
  const input = screen.getByRole('combobox', { name: 'Consulta PQL' }) as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'assignee = Build' } });
  expect(screen.getByRole('option', { name: 'Build Agent' })).toBeTruthy();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(input.value).toBe('assignee = "Build Agent"');
  act(() => vi.advanceTimersByTime(200));
  expect(useAppStore.getState().pqlApplied).toBe('assignee = "Build Agent"');
  expect(screen.getByRole('status').textContent).toContain('1 coincidencia');
});

it('inserts an escaped catalog name at a middle cursor and preserves the rest of the query', () => {
  useLabelStore.getState().setLabels([{ id: 'label-special', name: 'API "core"', teamId: 't1' } as import('@/types').Label]);
  render(<PqlBar issues={all.filter(i => i.projectId === 'p1')} />);
  fireEvent.click(screen.getByRole('button', { name: 'PQL' }));
  const input = screen.getByRole('combobox', { name: 'Consulta PQL' }) as HTMLInputElement;
  const query = String.raw`label = "API \"core\"" AND status=todo`;
  const cursor = String.raw`label = "API \"c`.length;
  fireEvent.change(input, { target: { value: query, selectionStart: cursor, selectionEnd: cursor } });
  fireEvent.select(input, { target: { selectionStart: cursor, selectionEnd: cursor } });
  expect(screen.getByRole('option', { name: 'API "core"' })).toBeTruthy();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(input.value).toBe(query);
  act(() => vi.advanceTimersByTime(200));
  expect(useAppStore.getState().pqlApplied).toBe(query);
});

it('restricts all route-bound reference suggestions and keeps cross-scope resolution intact', () => {
  // Empty issue scopes still offer the current route entity, not arbitrary peers.
  const { rerender } = render(<PqlBar issues={[]} />);
  fireEvent.click(screen.getByRole('button', { name: 'PQL' }));
  const input = screen.getByRole('combobox', { name: 'Consulta PQL' });
  fireEvent.change(input, { target: { value: 'project = ' } });
  expect(screen.getByRole('option', { name: 'Proyecto Alpha' })).toBeTruthy();
  expect(screen.queryByRole('option', { name: 'Proyecto Beta' })).toBeNull();
  expect(screen.queryByRole('option', { name: 'Proyecto Otro Equipo' })).toBeNull();
  fireEvent.change(input, { target: { value: 'team = ' } });
  expect(screen.getByRole('option', { name: 'Equipo Uno' })).toBeTruthy();
  expect(screen.queryByRole('option', { name: 'Equipo Dos' })).toBeNull();
  fireEvent.change(input, { target: { value: 'project = "Proyecto Beta"' } });
  act(() => vi.advanceTimersByTime(200));
  expect(useAppStore.getState().pqlApplied).toBe('project = "Proyecto Beta"');
  route.path = '/team/t1/cycles/c2';
  rerender(<PqlBar issues={[]} />);
  fireEvent.change(input, { target: { value: 'cycle = ' } });
  expect(screen.getByRole('option', { name: 'Ciclo Beta' })).toBeTruthy();
  expect(screen.queryByRole('option', { name: 'Ciclo Alpha' })).toBeNull();
  expect(screen.queryByRole('option', { name: 'Ciclo Otro Equipo' })).toBeNull();
  expect(screen.queryByRole('option', { name: 'Ciclo Otro Workspace' })).toBeNull();
  fireEvent.change(input, { target: { value: 'cycle = "Ciclo Alpha"' } });
  act(() => vi.advanceTimersByTime(200));
  expect(useAppStore.getState().pqlApplied).toBe('cycle = "Ciclo Alpha"');
});

it('does not suggest workspace catalogs on an unauthorized team route', () => {
  route.path = '/team/unknown/projects/p1';
  render(<PqlBar issues={all} />);
  fireEvent.click(screen.getByRole('button', { name: 'PQL' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Consulta PQL' }), { target: { value: 'project = ' } });
  expect(screen.queryByRole('listbox')).toBeNull();
});

it('allows team-scoped catalogs when the route has no project or cycle restriction', () => {
  route.path = '/team/t1/issues';
  render(<PqlBar issues={all} />);
  fireEvent.click(screen.getByRole('button', { name: 'PQL' }));
  const input = screen.getByRole('combobox', { name: 'Consulta PQL' });
  fireEvent.change(input, { target: { value: 'project = ' } });
  expect(screen.getByRole('option', { name: 'Proyecto Alpha' })).toBeTruthy();
  expect(screen.getByRole('option', { name: 'Proyecto Beta' })).toBeTruthy();
  expect(screen.queryByRole('option', { name: 'Proyecto Otro Equipo' })).toBeNull();
  fireEvent.change(input, { target: { value: 'cycle = ' } });
  expect(screen.getByRole('option', { name: 'Ciclo Alpha' })).toBeTruthy();
  expect(screen.getByRole('option', { name: 'Ciclo Beta' })).toBeTruthy();
  expect(screen.queryByRole('option', { name: 'Ciclo Otro Equipo' })).toBeNull();
  expect(screen.queryByRole('option', { name: 'Ciclo Otro Workspace' })).toBeNull();
});

it('keeps authorized workspace catalogs available on the global issues page', () => {
  route.path = '/my-issues';
  render(<PqlBar issues={all} />);
  fireEvent.click(screen.getByRole('button', { name: 'PQL' }));
  const input = screen.getByRole('combobox', { name: 'Consulta PQL' });
  fireEvent.change(input, { target: { value: 'team = ' } });
  expect(screen.getByRole('option', { name: 'Equipo Uno' })).toBeTruthy();
  expect(screen.getByRole('option', { name: 'Equipo Dos' })).toBeTruthy();
  fireEvent.change(input, { target: { value: 'project = ' } });
  expect(screen.getByRole('option', { name: 'Proyecto Alpha' })).toBeTruthy();
  expect(screen.getByRole('option', { name: 'Proyecto Otro Equipo' })).toBeTruthy();
  fireEvent.change(input, { target: { value: 'cycle = ' } });
  expect(screen.getByRole('option', { name: 'Ciclo Otro Equipo' })).toBeTruthy();
  expect(screen.queryByRole('option', { name: 'Ciclo Otro Workspace' })).toBeNull();
});
