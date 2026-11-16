import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useViewPersistence } from './useViewPersistence';
import { useAppStore } from '@/stores/appStore';
import type { Workspace } from '@/types';

vi.mock('next/navigation', () => ({ usePathname: () => '/team/team-a/issues' }));
describe('view persistence', () => {
  beforeEach(() => { localStorage.clear(); useAppStore.getState().resetView(); useAppStore.setState({ workspaceUserId: 'u1', activeWorkspace: { id: 'w1' } as Workspace }); });
  afterEach(cleanup);
  it('restores PQL per user, workspace and route without saving results', () => {
    const first = renderHook(() => useViewPersistence(true));
    act(() => useAppStore.getState().setFilterMode('pql', 'status = todo'));
    act(() => useAppStore.getState().setPqlApplied('status = todo', 'w1:u1:/team/team-a/issues'));
    first.unmount();
    useAppStore.getState().resetView();
    renderHook(() => useViewPersistence(true));
    expect(useAppStore.getState()).toMatchObject({ filterMode: 'pql', pqlDraft: 'status = todo', pqlApplied: null });
    expect(localStorage.getItem('pulse:view:u1:w1:/team/team-a/issues')).not.toContain('pqlApplied');
    act(() => useAppStore.setState({ activeWorkspace: { id: 'w2' } as Workspace }));
    expect(useAppStore.getState().filterMode).toBe('filters');
  });
  it('ignores corrupt stored values', () => {
    localStorage.setItem('pulse:view:u1:w1:/team/team-a/issues', '{bad');
    renderHook(() => useViewPersistence(true));
    expect(useAppStore.getState().filterMode).toBe('filters');
  });
});
