import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TimelineView } from './TimelineView';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';
import { useCycleStore } from '@/stores/cycleStore';
import { fixtureContext } from '@/lib/pql/fixtures';
import type { Issue, Team, Workspace } from '@/types';

vi.mock('next/navigation', () => ({ usePathname: () => '/team/team-a/issues' }));
vi.mock('@/hooks/usePqlContext', () => ({ usePqlContext: () => fixtureContext }));
const issues = [
  { id: 'e1', identifier: 'TES-101', number: 101, title: 'Épica pendiente', type: 'epic', status: 'todo', workspaceId: 'fixture', teamId: 'team-a', startDate: '2024-01-01', dueDate: '2024-02-01' },
  { id: 'e2', identifier: 'TES-102', number: 102, title: 'Épica completada', type: 'epic', status: 'done', workspaceId: 'fixture', teamId: 'team-a' },
  { id: 'e3', identifier: 'TES-103', number: 103, title: 'Otro workspace', type: 'epic', status: 'done', workspaceId: 'other', teamId: 'team-a' },
  { id: 'i1', identifier: 'TES-104', number: 104, title: 'Hijo pendiente', type: 'story', status: 'todo', epicId: 'e2', workspaceId: 'fixture', teamId: 'team-a' },
] as Issue[];

beforeEach(() => {
  useAppStore.getState().resetView();
  useAppStore.setState({ activeWorkspace: { id: 'fixture' } as Workspace, workspaceUserId: 'user-a', activeTeam: { id: 'team-a' } as Team,
    workspaceCatalogReady: true, workspaceCatalogError: null, pqlAgentCatalog: { workspaceId: 'fixture', userId: 'user-a', agents: [], loading: false, error: null } });
  useIssueStore.getState().setIssues(issues);
  useCycleStore.getState().setCycles([]);
});
afterEach(cleanup);

it('shows only matching epic roots while retaining unfiltered progress', () => {
  useAppStore.getState().setFilterMode('pql', 'status=done');
  useAppStore.getState().setPqlApplied('status=done', 'fixture:user-a:/team/team-a/issues');
  render(<TimelineView filtered />);
  expect(screen.getByText('Épica completada')).toBeTruthy();
  expect(screen.queryByText('Épica pendiente')).toBeNull();
  expect(screen.queryByText('Otro workspace')).toBeNull();
  expect(screen.getByText('0/1')).toBeTruthy();
});

it('hides timeline content without a valid query and retains the last valid result for an invalid draft', () => {
  useAppStore.getState().setFilterMode('pql', 'status=');
  render(<TimelineView filtered />);
  expect(screen.getByRole('status').textContent).toContain('Esperando una consulta PQL válida');
  expect(screen.queryByText('Épica pendiente')).toBeNull();
  expect(screen.queryByText('Épica completada')).toBeNull();
  act(() => useAppStore.getState().setPqlApplied('status=done', 'fixture:user-a:/team/team-a/issues'));
  expect(screen.getByText('Épica completada')).toBeTruthy();
  act(() => useAppStore.getState().setPqlDraft('status='));
  expect(screen.getByText('Épica completada')).toBeTruthy();
  act(() => useAppStore.getState().setActiveWorkspace({ id: 'other' } as Workspace));
  expect(screen.queryByText('Épica completada')).toBeNull();
});

it('keeps the standalone epic timeline independent of issue filters', () => {
  useAppStore.getState().setFilterMode('pql', 'status=');
  render(<TimelineView />);
  expect(screen.getByText('Épica pendiente')).toBeTruthy();
  expect(screen.getByText('Épica completada')).toBeTruthy();
});
