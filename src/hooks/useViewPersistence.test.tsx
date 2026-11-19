import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useViewPersistence } from './useViewPersistence';
import { useAppStore } from '@/stores/appStore';
import type { Workspace } from '@/types';

vi.mock('next/navigation', () => ({ usePathname: () => '/team/team-a/issues' }));
describe('view persistence', () => {
  beforeEach(() => { localStorage.clear(); useAppStore.getState().resetView(); useAppStore.setState({ workspaceUserId: 'u1', activeWorkspace: { id: 'w1' } as Workspace }); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
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
  it('preserves each workspace across the synchronous reset and return', () => {
    renderHook(() => useViewPersistence(true));
    act(() => useAppStore.getState().setFilterMode('pql', 'status = todo'));
    act(() => useAppStore.getState().setActiveWorkspace({ id: 'w2' } as Workspace));
    expect(JSON.parse(localStorage.getItem('pulse:view:u1:w1:/team/team-a/issues')!).query).toBe('status = todo');
    act(() => useAppStore.getState().setFilterMode('pql', 'status = done'));
    act(() => useAppStore.getState().setActiveWorkspace({ id: 'w1' } as Workspace));
    expect(useAppStore.getState()).toMatchObject({ filterMode: 'pql', pqlDraft: 'status = todo' });
    expect(JSON.parse(localStorage.getItem('pulse:view:u1:w2:/team/team-a/issues')!).query).toBe('status = done');
  });
  it('migrates a legacy view once and isolates other workspaces and users', () => {
    const legacyKey = 'pulse:view:/team/team-a/issues';
    const legacy = { filters: { search: 'secreto A', labelIds: ['label-a'] }, groupBy: 'none', sortBy: 'manual', mode: 'pql', query: 'text ~ "secreto A"' };
    localStorage.setItem(legacyKey, JSON.stringify(legacy));
    renderHook(() => useViewPersistence(true));
    expect(useAppStore.getState()).toMatchObject({ filterMode: 'pql', pqlDraft: legacy.query, filterState: { search: 'secreto A' } });
    expect(JSON.parse(localStorage.getItem('pulse:view:u1:w1:/team/team-a/issues')!)).toEqual(legacy);
    expect(localStorage.getItem(legacyKey)).toBeNull();
    act(() => useAppStore.getState().setActiveWorkspace({ id: 'w2' } as Workspace));
    expect(useAppStore.getState()).toMatchObject({ filterMode: 'filters', pqlDraft: '', filterState: { search: '', labelIds: [] } });
    act(() => useAppStore.getState().setActiveWorkspace({ id: 'w1' } as Workspace));
    expect(useAppStore.getState()).toMatchObject({ filterMode: 'pql', pqlDraft: legacy.query });
    act(() => { useAppStore.getState().setWorkspaceUser('u2'); useAppStore.getState().setActiveWorkspace({ id: 'w1' } as Workspace); });
    expect(useAppStore.getState()).toMatchObject({ filterMode: 'filters', pqlDraft: '', filterState: { search: '' } });
  });
  it('does not leak legacy data if deletion fails', () => {
    const legacyKey = 'pulse:view:/team/team-a/issues';
    localStorage.setItem(legacyKey, JSON.stringify({ filters: { search: 'privado' }, groupBy: 'none', sortBy: 'manual' }));
    const remove = Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key) {
      if (key === legacyKey) throw new Error('blocked');
      return remove.call(this, key);
    });
    renderHook(() => useViewPersistence(true));
    expect(useAppStore.getState().filterState.search).toBe('privado');
    expect(localStorage.getItem(legacyKey)).not.toBeNull();
    act(() => useAppStore.getState().setActiveWorkspace({ id: 'w2' } as Workspace));
    expect(useAppStore.getState().filterState.search).toBe('');
    act(() => { useAppStore.getState().setWorkspaceUser('u2'); useAppStore.getState().setActiveWorkspace({ id: 'w1' } as Workspace); });
    expect(useAppStore.getState().filterState.search).toBe('');
  });
  it('does not apply a legacy view if its identity claim cannot be persisted', () => {
    localStorage.setItem('pulse:view:/team/team-a/issues', JSON.stringify({ filters: { search: 'privado' }, groupBy: 'none', sortBy: 'manual' }));
    const set = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key.startsWith('pulse:view-migration:')) throw new Error('quota');
      return set.call(this, key, value);
    });
    renderHook(() => useViewPersistence(true));
    expect(useAppStore.getState().filterState.search).toBe('');
    expect(localStorage.getItem('pulse:view:u1:w1:/team/team-a/issues')).toBeNull();
  });
  it('preserves a scoped view when a stale legacy view exists', () => {
    localStorage.setItem('pulse:view:/team/team-a/issues', JSON.stringify({ filters: { search: 'viejo' }, groupBy: 'none', sortBy: 'manual' }));
    localStorage.setItem('pulse:view:u1:w1:/team/team-a/issues', JSON.stringify({ filters: { search: 'actual' }, groupBy: 'none', sortBy: 'manual' }));
    renderHook(() => useViewPersistence(true));
    expect(useAppStore.getState().filterState.search).toBe('actual');
    act(() => useAppStore.getState().setActiveWorkspace({ id: 'w2' } as Workspace));
    expect(useAppStore.getState().filterState.search).toBe('');
  });
  it('ignores invalid legacy data without exposing it to another workspace', () => {
    localStorage.setItem('pulse:view:/team/team-a/issues', '{bad');
    renderHook(() => useViewPersistence(true));
    expect(useAppStore.getState().filterMode).toBe('filters');
    act(() => useAppStore.getState().setActiveWorkspace({ id: 'w2' } as Workspace));
    expect(useAppStore.getState().pqlDraft).toBe('');
  });
  it('ignores corrupt stored values', () => {
    localStorage.setItem('pulse:view:u1:w1:/team/team-a/issues', '{bad');
    renderHook(() => useViewPersistence(true));
    expect(useAppStore.getState().filterMode).toBe('filters');
  });
});
