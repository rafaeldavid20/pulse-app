import { create } from 'zustand';
import { toast } from 'sonner';
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
  /** false hasta que llega la primera snapshot de Firestore para el workspace activo. */
  issuesLoaded: boolean;
  /** Mensaje de la suscripción de issues (permiso denegado / offline), null si está sana. */
  issuesError: string | null;

  setIssues: (issues: Issue[]) => void;
  setIssuesError: (error: string | null) => void;
  resetIssuesSubscription: () => void;
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
  setIssueRepo: (id: string, repoFullName: string) => Promise<void>;
  bulkUpdateStatus: (ids: string[], status: IssueStatus) => Promise<void>;
}

export const useIssueStore = create<IssueState>((set) => ({
  issues: [],
  selectedIssueId: null,
  peekIssueId: null,
  selectedIssueIds: [],
  defaultProjectId: null,
  defaultIssueType: 'task',
  issuesLoaded: false,
  issuesError: null,

  setIssues: (issues) => set({ issues, issuesLoaded: true, issuesError: null }),
  setIssuesError: (issuesError) => set({ issuesError, issuesLoaded: true }),
  resetIssuesSubscription: () => set({ issues: [], issuesLoaded: false, issuesError: null }),
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
    let previous: Issue | undefined;
    set((state) => {
      previous = state.issues.find((iss) => iss.id === id);
      return {
        issues: state.issues.map((iss) => (iss.id === id ? { ...iss, ...updates } : iss)),
      };
    });

    try {
      await updateRealIssue(id, updates);
    } catch (error) {
      // El servidor rechazó el cambio: volver al valor previo en vez de dejar
      // a la UI mostrando un estado que nunca se guardó.
      if (previous) {
        const prevIssue = previous;
        set((state) => ({
          issues: state.issues.map((iss) => (iss.id === id ? prevIssue : iss)),
        }));
      }
      toast.error('No se pudo actualizar el issue.');
      throw error;
    }
  },

  deleteIssue: async (id) => {
    set((state) => ({
      issues: state.issues.filter((iss) => iss.id !== id),
      peekIssueId: state.peekIssueId === id ? null : state.peekIssueId,
      selectedIssueId: state.selectedIssueId === id ? null : state.selectedIssueId,
    }));
    await deleteRealIssue(id);
  },

  setIssueRepo: async (id, repoFullName) => {
    // El backend recibe `repoFullName` a nivel raíz y lo guarda en
    // `git.repoFullName`. El update optimista tiene que escribir donde la UI
    // lee, o el selector se ve sin cambios hasta que llegue la snapshot.
    set((state) => ({
      issues: state.issues.map((iss) =>
        iss.id === id
          ? { ...iss, git: { ...iss.git, repoFullName: repoFullName || undefined } }
          : iss
      ),
    }));
    await updateRealIssue(id, { repoFullName });
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
