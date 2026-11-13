import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useIssueStore } from './issueStore';
import type { Issue } from '@/types';

vi.mock('@/lib/firestore', () => ({createRealIssue:vi.fn(), updateRealIssue:vi.fn(), deleteRealIssue:vi.fn(), reparentIssue:vi.fn(), callPlatformAction:vi.fn()}));
const issue = (id: number, updatedAt = new Date().toISOString()) => ({id:`issue-${id}`, updatedAt, teamId:'team-a', workspaceId:'ws-a'} as Issue);

beforeEach(() => useIssueStore.getState().resetIssuesSubscription());
describe('team issue pagination', () => {
  it('keeps the first page at 50 while retaining a live window larger than a page', () => {
    const live = Array.from({length:60}, (_, i) => issue(i));
    useIssueStore.getState().setIssues(live);
    expect(useIssueStore.getState().issues).toHaveLength(50);
    expect(useIssueStore.getState().liveIssues).toHaveLength(60);
    useIssueStore.getState().addHistoricalIssues(live.slice(0, 50));
    useIssueStore.getState().setIssues([issue(99, new Date(Date.now() + 1000).toISOString()), ...live]);
    expect(useIssueStore.getState().issues).toHaveLength(50);
    useIssueStore.getState().addHistoricalIssues(live.slice(50), true);
    expect(useIssueStore.getState().issues).toHaveLength(61);
  });
  it('retains the newest version across live snapshots and late pages, and removes deleted live documents', () => {
    const old = issue(1, '2026-11-01T00:00:00.000Z');
    const newer = {...old, updatedAt:'2026-11-02T00:00:00.000Z', title:'new'};
    useIssueStore.getState().setIssues([old]);
    useIssueStore.getState().addHistoricalIssues([old]);
    useIssueStore.getState().setIssues([newer]);
    useIssueStore.getState().addHistoricalIssues([old]);
    expect(useIssueStore.getState().issues[0].title).toBe('new');
    useIssueStore.getState().setIssues([]);
    expect(useIssueStore.getState().issues).toHaveLength(0);
  });
});
