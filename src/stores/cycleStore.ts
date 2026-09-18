import { create } from 'zustand';
import { toast } from 'sonner';
import { Cycle } from '@/types';
import { createRealCycle, updateRealCycle } from '@/lib/firestore';

interface CycleState {
  cycles: Cycle[];
  cyclesLoaded: boolean;
  setCycles: (cycles: Cycle[]) => void;
  addCycle: (
    data: Partial<Cycle> & { workspaceId: string; teamId: string; startsAt: string; endsAt: string }
  ) => Promise<Cycle>;
  updateCycle: (id: string, updates: Partial<Cycle>) => Promise<void>;
}

export const useCycleStore = create<CycleState>((set) => ({
  cycles: [],
  cyclesLoaded: false,

  setCycles: (cycles) => set({ cycles, cyclesLoaded: true }),

  addCycle: async (data) => {
    const created = await createRealCycle(data);
    return created;
  },

  updateCycle: async (id, updates) => {
    let previous: Cycle | undefined;
    set((state) => {
      previous = state.cycles.find((c) => c.id === id);
      return {
        cycles: state.cycles.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      };
    });

    try {
      await updateRealCycle(id, updates);
    } catch (error) {
      if (previous) {
        const prevCycle = previous;
        set((state) => ({
          cycles: state.cycles.map((c) => (c.id === id ? prevCycle : c)),
        }));
      }
      toast.error('No se pudo actualizar el ciclo.');
      throw error;
    }
  },
}));
