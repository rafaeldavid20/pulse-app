import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CalendarView } from './CalendarView';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';
import { fixtureContext } from '@/lib/pql/fixtures';
import type { Issue, Team, Workspace } from '@/types';

vi.mock('next/navigation', () => ({ usePathname: () => '/team/team-a/issues' }));
vi.mock('@/hooks/usePqlContext', () => ({ usePqlContext: () => fixtureContext }));
beforeEach(() => {
  useAppStore.getState().resetView();
  useAppStore.setState({ activeWorkspace: { id: 'fixture' } as Workspace, workspaceUserId: 'user-a', activeTeam: { id: 'team-a' } as Team,
    workspaceCatalogReady: true, workspaceCatalogError: null, pqlAgentCatalog: { workspaceId: 'fixture', userId: 'user-a', agents: [], loading: false, error: null } });
  useIssueStore.getState().setIssues([{ id: 'i1', identifier: 'TES-101', title: 'Tarea anterior', status: 'todo', workspaceId: 'fixture', teamId: 'team-a' }] as Issue[]);
});
afterEach(cleanup);

it('clears stale panel contents when the applied query or workspace changes', () => {
  useAppStore.getState().setFilterMode('pql', 'status=todo');
  useAppStore.getState().setPqlApplied('status=todo', 'fixture:user-a:/team/team-a/issues');
  render(<CalendarView />);
  fireEvent.click(screen.getByRole('button', { name: /1 sin fecha/ }));
  expect(screen.getByText('Tarea anterior')).toBeTruthy();
  act(() => useAppStore.getState().setPqlApplied('status=done', 'fixture:user-a:/team/team-a/issues'));
  expect(screen.queryByText('Tarea anterior')).toBeNull();
  act(() => useAppStore.getState().setActiveWorkspace({ id: 'other' } as Workspace));
  expect(screen.queryByText('Tarea anterior')).toBeNull();
});

it('does not present an empty calendar as a valid result when no query has been applied', () => {
  useAppStore.getState().setFilterMode('pql', 'status=');
  render(<CalendarView />);
  expect(screen.getByRole('status').textContent).toContain('Esperando una consulta PQL válida');
  expect(screen.queryByText('Tarea anterior')).toBeNull();
});
