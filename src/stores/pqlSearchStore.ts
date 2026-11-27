import { create } from 'zustand';
import { useAppStore } from './appStore';

export interface PqlSearch { workspaceId: string; actorId: string; teamId?: string; query: string }
export const usePqlSearchStore = create<{ search: PqlSearch | null; setSearch: (search: PqlSearch | null) => void }>(set => ({
  search: null,
  setSearch: search => set({ search }),
}));

useAppStore.subscribe((state, previous) => {
  if (state.activeWorkspace?.id !== previous.activeWorkspace?.id || state.workspaceUserId !== previous.workspaceUserId) {
    usePqlSearchStore.getState().setSearch(null);
  }
});
