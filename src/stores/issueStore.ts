import { create } from 'zustand';
import { toast } from 'sonner';
import { Issue, IssueStatus, IssueType } from '@/types';
import { createRealIssue, updateRealIssue, deleteRealIssue, reparentIssue } from '@/lib/firestore';

interface IssueState {
  issues: Issue[];
  liveIssues: Issue[];
  liveLoaded: boolean;
  visibleLimit: number;
  historicalIssues: Issue[];
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
  addHistoricalIssues: (issues: Issue[], appendPage?: boolean) => void;
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

const orderedPage = (values: Iterable<Issue>, maximum: number) => Array.from(values).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)).slice(0, maximum);

export const useIssueStore = create<IssueState>((set) => ({
  issues: [],
  liveIssues: [],
  liveLoaded: false,
  visibleLimit: 50,
  historicalIssues: [],
  selectedIssueId: null,
  peekIssueId: null,
  selectedIssueIds: [],
  defaultProjectId: null,
  defaultIssueType: 'task',
  issuesLoaded: false,
  issuesError: null,

  setIssues: (issues) => set((state) => {
    const incoming = new Map(issues.map(issue => [issue.id, issue]));
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const removed = new Set(state.liveIssues.filter(issue => !incoming.has(issue.id) && Date.parse(issue.updatedAt) >= cutoff).map(issue => issue.id));
    const historical = state.historicalIssues.filter(issue => !removed.has(issue.id)).map(issue => {
      const live = incoming.get(issue.id);
      return live && live.updatedAt >= issue.updatedAt ? live : issue;
    });
    const merged = new Map(historical.map(issue => [issue.id, issue]));
    issues.slice(0, 50).forEach(issue => {
      const old = merged.get(issue.id);
      if (!old || issue.updatedAt >= old.updatedAt) merged.set(issue.id, issue);
    });
    return { liveIssues: issues, liveLoaded: true, historicalIssues: historical, issues: orderedPage(merged.values(), state.visibleLimit), issuesLoaded: true, issuesError: null };
  }),
  addHistoricalIssues: (issues, appendPage = false) => set((state) => {
    const historical = new Map(state.historicalIssues.map((issue) => [issue.id, issue]));
    const live = new Map(state.liveIssues.map(issue => [issue.id, issue]));
    issues.forEach(issue => {
      const candidate = live.get(issue.id);
      // A completed live snapshot is authoritative for recent documents:
      // a delayed page must not resurrect a deleted or moved document.
      if (state.liveLoaded && !candidate && Date.parse(issue.updatedAt) >= Date.now() - 90 * 24 * 60 * 60 * 1000) return;
      const newest = candidate && candidate.updatedAt >= issue.updatedAt ? candidate : issue;
      const old = historical.get(issue.id);
      if (!old || newest.updatedAt >= old.updatedAt) historical.set(issue.id, newest);
    });
    const merged = new Map(historical);
    state.liveIssues.slice(0, 50).forEach(issue => {
      const old = merged.get(issue.id);
      if (!old || issue.updatedAt >= old.updatedAt) merged.set(issue.id, issue);
    });
    const visibleLimit = state.visibleLimit + (appendPage ? 50 : 0);
    return { issues: orderedPage(merged.values(), visibleLimit), visibleLimit, historicalIssues: Array.from(historical.values()), issuesLoaded: true };
  }),
  setIssuesError: (issuesError) => set({ issuesError, issuesLoaded: true }),
  resetIssuesSubscription: () => set({ issues: [], liveIssues: [], liveLoaded: false, visibleLimit: 50, historicalIssues: [], issuesLoaded: false, issuesError: null }),
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
    const newIssue = await createRealIssue(data);
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
