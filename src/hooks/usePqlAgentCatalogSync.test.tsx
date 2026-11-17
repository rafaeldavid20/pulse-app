import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { usePqlAgentCatalogSync } from './usePqlAgentCatalogSync';
import { usePqlAgentStatus } from './usePqlAgentStatus';
import { useAppStore } from '@/stores/appStore';
import type { Workspace } from '@/types';

const listAgents = vi.hoisted(() => vi.fn());
vi.mock('@/lib/firestore', () => ({ listAgents }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });
beforeEach(() => useAppStore.setState({ activeWorkspace: { id: 'w1' } as Workspace, workspaceUserId: 'u1', pqlAgentCatalog: null }));

it('loads the authorized catalog and rejects a late result from the previous workspace', async () => {
  let finishFirst!: (value: unknown) => void;
  listAgents.mockImplementation((id: string) => id === 'w1'
    ? new Promise(resolve => { finishFirst = resolve; })
    : Promise.resolve([{ id: 'agent-b', displayName: 'Beta', workspaceId: 'w2' }]));
  const { result } = renderHook(() => { usePqlAgentCatalogSync('u1'); return usePqlAgentStatus(); });
  await waitFor(() => expect(listAgents).toHaveBeenCalledWith('w1'));
  expect(result.current.ready).toBe(false);
  act(() => useAppStore.getState().setActiveWorkspace({ id: 'w2' } as Workspace));
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => { finishFirst([{ id: 'agent-a', workspaceId: 'w1' }]); });
  expect(useAppStore.getState().pqlAgentCatalog).toMatchObject({ workspaceId: 'w2', agents: [{ id: 'agent-b' }] });
});

it('blocks PQL and exposes catalog errors until a successful refresh', async () => {
  listAgents.mockRejectedValue(new Error('sin acceso'));
  const { result } = renderHook(() => { usePqlAgentCatalogSync('u1'); return usePqlAgentStatus(); });
  await waitFor(() => expect(result.current.error).toBe('sin acceso'));
  expect(result.current.ready).toBe(false);
  expect(useAppStore.getState().pqlAgentCatalog?.agents).toEqual([]);
});
