import { Suspense } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ProjectDetailPage from './page';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';
import { useProjectStore } from '@/stores/projectStore';
import { fixtureContext } from '@/lib/pql/fixtures';
import type { Issue, Project, Workspace } from '@/types';

vi.mock('next/navigation', () => ({ usePathname: () => '/team/team-a/projects/project-a' }));
vi.mock('@/hooks/usePqlContext', () => ({ usePqlContext: () => fixtureContext }));
vi.mock('@/components/layout/Header', () => ({ Header: () => null }));
vi.mock('@/components/projects/QaMetricsCard', () => ({ QaMetricsCard: () => null }));
vi.mock('@/components/projects/ProjectModal', () => ({ ProjectModal: () => null }));

beforeEach(() => {
  useAppStore.getState().resetView();
  useAppStore.setState({ activeWorkspace: { id: 'fixture' } as Workspace, workspaceUserId: 'user-a', workspaceCatalogReady: true, workspaceCatalogError: null, activeView: 'list' });
  useProjectStore.getState().setProjects([{ id: 'project-a', name: 'Proyecto', teamId: 'team-a', status: 'planned' } as Project]);
  useIssueStore.getState().setIssues([
    { id: 'in', identifier: 'TES-101', number: 101, title: 'Dentro', workspaceId: 'fixture', teamId: 'team-a', projectId: 'project-a', status: 'todo', priority: 1 },
    { id: 'out', identifier: 'TES-102', number: 102, title: 'Fuera', workspaceId: 'fixture', teamId: 'team-a', projectId: 'project-b', status: 'todo', priority: 1 },
  ] as Issue[]);
  useAppStore.getState().setFilterMode('pql', 'status=todo');
  useAppStore.getState().setPqlApplied('status=todo', 'fixture:user-a:/team/team-a/projects/project-a');
});
afterEach(cleanup);

it('keeps project scope in the real list and board when switching views', async () => {
  const params = Promise.resolve({ teamId: 'team-a', projectId: 'project-a' });
  await act(async () => { render(<Suspense fallback={null}><ProjectDetailPage params={params} /></Suspense>); });
  expect(await screen.findByText('Dentro')).toBeTruthy();
  expect(screen.queryByText('Fuera')).toBeNull();
  act(() => useAppStore.getState().setActiveView('board'));
  expect(screen.getByRole('option', { name: 'TES-101 Dentro' })).toBeTruthy();
  expect(screen.queryByRole('option', { name: /Fuera/ })).toBeNull();
});
