import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IssueBoard } from './IssueBoard';
import { IssueList } from './IssueList';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';
import { fixtureContext } from '@/lib/pql/fixtures';
import type { Issue, Workspace } from '@/types';

vi.mock('next/navigation', () => ({ usePathname: () => '/team/team-a/issues' }));
vi.mock('@/hooks/usePqlContext', () => ({ usePqlContext: () => fixtureContext }));

const epic = { id: 'epic-a', identifier: 'TES-122', number: 122, title: 'Épica raíz', workspaceId: 'fixture', teamId: 'team-a', projectId: 'project-a', type: 'epic', status: 'todo', priority: 1, createdAt: '2024-01-01T00:00:00Z' } as Issue;
const child = { id: 'issue-a', identifier: 'TES-123', number: 123, title: 'Hijo', workspaceId: 'fixture', teamId: 'team-a', projectId: 'project-a', epicId: 'epic-a', type: 'story', status: 'done', priority: 1, createdAt: '2024-01-02T00:00:00Z' } as Issue;
const other = { id: 'other', identifier: 'TES-999', number: 999, title: 'Otro proyecto', workspaceId: 'fixture', teamId: 'team-a', projectId: 'project-b', status: 'todo', priority: 1, createdAt: '2024-01-03T00:00:00Z' } as Issue;

describe('PQL list and board rendering', () => {
  beforeEach(() => {
    useAppStore.getState().resetView();
    useAppStore.setState({ activeWorkspace: { id: 'fixture' } as Workspace, workspaceUserId: 'user-a', workspaceCatalogReady: true, workspaceCatalogError: null, boardGroupBy: 'epic' });
    useIssueStore.getState().setIssues([epic, child, other]);
  });
  afterEach(cleanup);
  it('renders a matching epic as a card even when no children match', () => {
    useAppStore.getState().setFilterMode('pql', 'epic=TES-122 AND status=todo');
    useAppStore.getState().setPqlApplied('epic=TES-122 AND status=todo', 'fixture:user-a:/team/team-a/issues');
    const list = render(<IssueList issues={[epic, child]} />);
    expect(screen.getByText('Épica raíz')).toBeTruthy();
    expect(screen.queryByText('Hijo')).toBeNull();
    list.unmount();
    render(<IssueBoard issues={[epic, child]} />);
    const card = screen.getByRole('option', { name: 'TES-122 Épica raíz' });
    expect(card).toBeTruthy();
    expect(screen.queryByRole('option', { name: /Hijo/ })).toBeNull();
  });
  it('shows the same project-scoped matching cards as the list', () => {
    useAppStore.getState().setFilterMode('pql', 'status=todo');
    useAppStore.getState().setPqlApplied('status=todo', 'fixture:user-a:/team/team-a/issues');
    const scoped = [epic, child];
    const list = render(<IssueList issues={scoped} />);
    expect(screen.getByText('Épica raíz')).toBeTruthy();
    expect(screen.queryByText('Otro proyecto')).toBeNull();
    list.unmount();
    const board = render(<IssueBoard issues={scoped} />);
    expect(within(board.container).getAllByRole('option').map(node => node.getAttribute('aria-label'))).toEqual(['TES-122 Épica raíz']);
  });
});
