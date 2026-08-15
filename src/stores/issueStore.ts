import { create } from 'zustand';
import { Issue, IssueStatus, IssuePriority } from '@/types';
import { createRealIssue, updateRealIssue, deleteRealIssue } from '@/lib/firestore';

interface IssueState {
  issues: Issue[];
  selectedIssueId: string | null;
  peekIssueId: string | null;
  selectedIssueIds: string[];
  defaultProjectId: string | null;

  setIssues: (issues: Issue[]) => void;
  setSelectedIssueId: (id: string | null) => void;
  setPeekIssueId: (id: string | null) => void;
  setDefaultProjectId: (id: string | null) => void;
  toggleIssueSelection: (id: string) => void;
  clearSelection: () => void;

  addIssue: (
    issueData: Partial<Issue> & { workspaceId: string; teamId: string; creatorId: string; teamKey?: string }
  ) => Promise<Issue>;
  updateIssue: (id: string, updates: Partial<Issue>) => Promise<void>;
  deleteIssue: (id: string) => Promise<void>;
  bulkUpdateStatus: (ids: string[], status: IssueStatus) => Promise<void>;
}

export const useIssueStore = create<IssueState>((set) => ({
  issues: [],
  selectedIssueId: null,
  peekIssueId: null,
  selectedIssueIds: [],
  defaultProjectId: null,

  setIssues: (issues) => set({ issues }),
  setSelectedIssueId: (selectedIssueId) => set({ selectedIssueId }),
  setPeekIssueId: (peekIssueId) => set({ peekIssueId }),
  setDefaultProjectId: (defaultProjectId) => set({ defaultProjectId }),

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

  bulkUpdateStatus: async (ids, status) => {
    for (const id of ids) {
      await updateRealIssue(id, { status });
    }
    set({ selectedIssueIds: [] });
  },
}));
