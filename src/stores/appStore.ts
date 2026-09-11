import { create } from 'zustand';
import { Workspace, Team, Member, FilterState, IssueGroupBy, IssueSortBy } from '@/types';

interface AppState {
  userWorkspaces: Workspace[];
  activeWorkspace: Workspace | null;
  teams: Team[];
  activeTeam: Team | null;
  members: Member[];
  
  isSidebarOpen: boolean;
  isCmdKOpen: boolean;
  isShortcutHelpOpen: boolean;
  isCreateMenuOpen: boolean;
  isCreateIssueOpen: boolean;
  isCreateWorkspaceOpen: boolean;
  isInviteMemberOpen: boolean;
  
  activeView: 'list' | 'board';
  /** Cómo se agrupa el board: columnas por estado, o swimlanes por épica. */
  boardGroupBy: 'status' | 'epic';
  filterState: FilterState;
  /** Agrupación de la vista lista (barra de filtros). Independiente de `boardGroupBy`. */
  groupBy: IssueGroupBy;
  sortBy: IssueSortBy;

  setUserWorkspaces: (workspaces: Workspace[]) => void;
  setActiveWorkspace: (workspace: Workspace | null) => void;
  setTeams: (teams: Team[]) => void;
  setActiveTeam: (team: Team | null) => void;
  setMembers: (members: Member[]) => void;
  
  toggleSidebar: () => void;
  setCmdKOpen: (open: boolean) => void;
  setShortcutHelpOpen: (open: boolean) => void;
  setCreateMenuOpen: (open: boolean) => void;
  setCreateIssueOpen: (open: boolean) => void;
  setCreateWorkspaceOpen: (open: boolean) => void;
  setInviteMemberOpen: (open: boolean) => void;
  setActiveView: (view: 'list' | 'board') => void;
  setBoardGroupBy: (groupBy: 'status' | 'epic') => void;
  setFilterState: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  setGroupBy: (groupBy: IssueGroupBy) => void;
  setSortBy: (sortBy: IssueSortBy) => void;
  /** Reemplaza filtros + agrupación + orden de una sola vez (restaurar desde localStorage). */
  setViewState: (view: { filters: FilterState; groupBy: IssueGroupBy; sortBy: IssueSortBy }) => void;
  /** A diferencia de `resetFilters`, también vuelve agrupación y orden a su default. */
  resetView: () => void;
}

const initialFilters: FilterState = {
  search: '',
  status: [],
  priority: [],
  type: [],
  assigneeIds: [],
  projectIds: [],
  epicIds: [],
  labelIds: [],
};

const initialGroupBy: IssueGroupBy = 'none';
const initialSortBy: IssueSortBy = 'manual';

export const useAppStore = create<AppState>((set) => ({
  userWorkspaces: [],
  activeWorkspace: null,
  teams: [],
  activeTeam: null,
  members: [],

  isSidebarOpen: true,
  isCmdKOpen: false,
  isShortcutHelpOpen: false,
  isCreateMenuOpen: false,
  isCreateIssueOpen: false,
  isCreateWorkspaceOpen: false,
  isInviteMemberOpen: false,
  activeView: 'list',
  boardGroupBy: 'status',
  filterState: initialFilters,
  groupBy: initialGroupBy,
  sortBy: initialSortBy,

  setUserWorkspaces: (userWorkspaces) =>
    set((state) => {
      let active = state.activeWorkspace;
      if (!active || !userWorkspaces.some((w) => w.id === active?.id)) {
        active = userWorkspaces[0] || null;
      }
      return { userWorkspaces, activeWorkspace: active };
    }),

  setActiveWorkspace: (activeWorkspace) => set({ activeWorkspace }),
  setTeams: (teams) =>
    set((state) => {
      let active = state.activeTeam;
      if (!active || !teams.some((t) => t.id === active?.id)) {
        active = teams[0] || null;
      }
      return { teams, activeTeam: active };
    }),
  setActiveTeam: (activeTeam) => set({ activeTeam }),
  setMembers: (members) => set({ members }),

  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setCmdKOpen: (isCmdKOpen) => set({ isCmdKOpen }),
  setShortcutHelpOpen: (isShortcutHelpOpen) => set({ isShortcutHelpOpen }),
  setCreateMenuOpen: (isCreateMenuOpen) => set({ isCreateMenuOpen }),
  setCreateIssueOpen: (isCreateIssueOpen) => set({ isCreateIssueOpen }),
  setCreateWorkspaceOpen: (isCreateWorkspaceOpen) => set({ isCreateWorkspaceOpen }),
  setInviteMemberOpen: (isInviteMemberOpen) => set({ isInviteMemberOpen }),
  setActiveView: (activeView) => set({ activeView }),
  setBoardGroupBy: (boardGroupBy) => set({ boardGroupBy }),
  setFilterState: (filters) =>
    set((state) => ({ filterState: { ...state.filterState, ...filters } })),
  resetFilters: () => set({ filterState: initialFilters }),
  setGroupBy: (groupBy) => set({ groupBy }),
  setSortBy: (sortBy) => set({ sortBy }),
  setViewState: ({ filters, groupBy, sortBy }) =>
    set({ filterState: filters, groupBy, sortBy }),
  resetView: () => set({ filterState: initialFilters, groupBy: initialGroupBy, sortBy: initialSortBy }),
}));
