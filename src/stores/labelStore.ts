import { create } from 'zustand';
import { Label } from '@/types';
import { createRealLabel } from '@/lib/firestore';

interface LabelState {
  labels: Label[];
  setLabels: (labels: Label[]) => void;
  addLabel: (data: { workspaceId: string; teamId: string; name: string; color: string }) => Promise<Label>;
}

export const useLabelStore = create<LabelState>((set) => ({
  labels: [],
  setLabels: (labels) => set({ labels }),

  addLabel: async ({ workspaceId, teamId, name, color }) => {
    const created = await createRealLabel(workspaceId, teamId, name, color);
    return created;
  },
}));
