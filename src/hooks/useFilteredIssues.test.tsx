import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFilteredIssues } from './useFilteredIssues';
import { useAppStore } from '@/stores/appStore';
import { fixtureContext } from '@/lib/pql/fixtures';
import type { Issue } from '@/types';

vi.mock('next/navigation', () => ({ usePathname: () => '/team/team-a/issues' }));
vi.mock('./usePqlContext', () => ({ usePqlContext: () => fixtureContext }));

describe('PQL scope', () => {
  beforeEach(() => useAppStore.getState().resetView());
  it('intersects route and workspace before evaluating OR or NOT', () => {
    const issues = [
      { id: 'a', workspaceId: 'fixture', teamId: 'team-a', status: 'todo' },
      { id: 'b', workspaceId: 'fixture', teamId: 'team-b', status: 'todo' },
      { id: 'c', workspaceId: 'other', teamId: 'team-a', status: 'todo' },
    ] as Issue[];
    useAppStore.getState().setFilterMode('pql', 'status = todo OR NOT status = done');
    useAppStore.getState().setPqlApplied('status = todo OR NOT status = done', 'fixture:user-a:/team/team-a/issues');
    const { result } = renderHook(() => useFilteredIssues(issues));
    expect(result.current.map(i => i.id)).toEqual(['a']);
    useAppStore.getState().setPqlApplied('', 'other:user-a:/team/team-a/issues');
    const next = renderHook(() => useFilteredIssues(issues));
    expect(next.result.current).toEqual([]);
  });
});
