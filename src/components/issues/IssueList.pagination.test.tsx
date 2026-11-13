import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IssueList } from './IssueList';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';
import type { Issue, Team, Workspace } from '@/types';

const { load } = vi.hoisted(() => ({load:vi.fn()}));
vi.mock('@/lib/firestore', () => ({loadPreviousTeamIssues:load,createRealIssue:vi.fn(),updateRealIssue:vi.fn(),deleteRealIssue:vi.fn(),reparentIssue:vi.fn(),callPlatformAction:vi.fn()}));
const ws = {id:'ws-a'} as Workspace;
const a = {id:'team-a'} as Team;
const b = {id:'team-b'} as Team;
beforeEach(() => { load.mockReset(); useIssueStore.getState().resetIssuesSubscription(); useIssueStore.getState().setIssues([]); useAppStore.setState({activeWorkspace:ws,activeTeam:a}); });
afterEach(cleanup);
it('discards an old historical response even if the user returns to the same team', async () => {
  let finish!: (page: Issue[]) => void;
  load.mockReturnValue(new Promise(resolve => {finish = resolve;}));
  render(<IssueList issues={[]} />);
  fireEvent.click(screen.getByRole('button',{name:'Cargar anteriores'}));
  await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  act(() => useAppStore.setState({activeTeam:b}));
  act(() => useAppStore.setState({activeTeam:a}));
  await act(async () => finish([{id:'stale',teamId:'team-a',workspaceId:'ws-a',updatedAt:'2020-01-01'} as Issue]));
  expect(useIssueStore.getState().issues).toEqual([]);
  expect(screen.getByRole('button',{name:'Cargar anteriores'})).toBeTruthy();
});
