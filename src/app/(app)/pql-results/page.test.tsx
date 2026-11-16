import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PqlResultsPage from './page';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';
import { usePqlSearchStore } from '@/stores/pqlSearchStore';
import { fixtureContext } from '@/lib/pql/fixtures';
import type { Issue, Workspace } from '@/types';

vi.mock('@/hooks/usePqlContext', () => ({ usePqlContext: () => fixtureContext }));
vi.mock('@/components/layout/Header', () => ({ Header: () => <header>Resultados PQL</header> }));
describe('workspace PQL results', () => {
  beforeEach(() => {
    useAppStore.setState({ activeWorkspace: { id: 'fixture' } as Workspace, workspaceUserId: 'user-a' });
    useIssueStore.getState().setIssues([{ id: 'a', workspaceId: 'fixture', identifier: 'TES-1', title: 'One', status: 'todo', priority: 2, createdAt: '2024-01-01' }, { id: 'b', workspaceId: 'other', identifier: 'OTHER-1', title: 'Private', status: 'todo', priority: 2, createdAt: '2024-01-01' }] as Issue[]);
    usePqlSearchStore.getState().setSearch({ workspaceId: 'fixture', actorId: 'user-a', query: 'status = todo' });
  });
  afterEach(cleanup);
  it('shows only the current workspace and discards the search on a workspace switch', () => {
    render(<PqlResultsPage />);
    expect(screen.getByText('TES-1')).toBeTruthy();
    expect(screen.queryByText('OTHER-1')).toBeNull();
    act(() => useAppStore.setState({ activeWorkspace: { id: 'other' } as Workspace }));
    expect(screen.getByText(/ya no está disponible/)).toBeTruthy();
    expect(usePqlSearchStore.getState().search).toBeNull();
  });
});
