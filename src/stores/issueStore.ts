import { create } from 'zustand';
import { Issue, IssueStatus, IssueType } from '@/types';
import { createRealIssue, updateRealIssue, deleteRealIssue, reparentIssue } from '@/lib/firestore';

interface IssueState {
  issues: Issue[];
  selectedIssueId: string | null;
  peekIssueId: string | null;
  selectedIssueIds: string[];
  defaultProjectId: string | null;
  /** Tipo preseleccionado al abrir el modal de creación (lo setea "Nueva Épica"). */
  defaultIssueType: IssueType;

  setIssues: (issues: Issue[]) => void;
  setSelectedIssueId: (id: string | null) => void;
  setPeekIssueId: (id: string | null) => void;
  setDefaultProjectId: (id: string | null) => void;
  setDefaultIssueType: (type: IssueType) => void;
  toggleIssueSelection: (id: string) => void;
  clearSelection: () => void;

  addIssue: (
    issueData: Partial<Issue> & { workspaceId: string; teamId: string; creatorId: string; teamKey?: string }
  ) => Promise<Issue>;
  updateIssue: (id: string, updates: Partial<Issue>) => Promise<void>;
  deleteIssue: (id: string) => Promise<void>;
  moveIssue: (id: string, parentId: string | null) => Promise<void>;
  bulkUpdateStatus: (ids: string[], status: IssueStatus) => Promise<void>;
}

export const useIssueStore = create<IssueState>((set) => ({
  issues: [],
  selectedIssueId: null,
  peekIssueId: null,
  selectedIssueIds: [],
  defaultProjectId: null,
  defaultIssueType: 'task',

  setIssues: (issues) => set({ issues }),
  setSelectedIssueId: (selectedIssueId) => set({ selectedIssueId }),
  setPeekIssueId: (peekIssueId) => set({ peekIssueId }),
  setDefaultProjectId: (defaultProjectId) => set({ defaultProjectId }),
  setDefaultIssueType: (defaultIssueType) => set({ defaultIssueType }),

  toggleIssueSelection: (id) =>
    set((state) => {
      const exists = state.selectedIssueIds.includes(id);
      return {
        selectedIssueIds: exists
          ? state.selectedIssueIds.filter((i) => i !== id)
          : [...state.selectedIssueIds, id],
      };
    }),

  clearSelection: () => set({ selectedIssueIds: [] }),

  addIssue: async (data) => {
    const newIssue = await createRealIssue(data as any);
    return newIssue;
  },

  updateIssue: async (id, updates) => {
    set((state) => ({
      issues: state.issues.map((iss) => (iss.id === id ? { ...iss, ...updates } : iss)),
    }));
    await updateRealIssue(id, updates);
  },

  deleteIssue: async (id) => {
    set((state) => ({
      issues: state.issues.filter((iss) => iss.id !== id),
      peekIssueId: state.peekIssueId === id ? null : state.peekIssueId,
      selectedIssueId: state.selectedIssueId === id ? null : state.selectedIssueId,
    }));
    await deleteRealIssue(id);
  },

  moveIssue: async (id, parentId) => {
    // Sin update optimista: el backend recalcula `epicId` de todo el subárbol,
    // así que el estado correcto llega por la suscripción de Firestore. Simular
    // el resultado acá significaría reimplementar esa lógica en el cliente.
    await reparentIssue(id, parentId);
  },

  bulkUpdateStatus: async (ids, status) => {
    for (const id of ids) {
      await updateRealIssue(id, { status });
    }
    set({ selectedIssueIds: [] });
  },
}));
