import { create } from 'zustand';
import type { SavedView } from '@/types';

export const useSavedViewStore = create<{ views: SavedView[]; loaded: boolean; error: string | null; setViews: (views: SavedView[]) => void; setError: (error: string) => void; reset: () => void }>(set => ({
  views: [], loaded: false, error: null,
  setViews: views => set({ views, loaded: true, error: null }),
  setError: error => set({ views: [], loaded: true, error }),
  reset: () => set({ views: [], loaded: false, error: null }),
}));
