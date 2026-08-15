import { create } from 'zustand';
import { Workspace, Team, Member, FilterState } from '@/types';

interface AppState {
  userWorkspaces: Workspace[];
  activeWorkspace: Workspace | null;
  teams: Team[];
  activeTeam: Team | null;
  members: Member[];
  
  isSidebarOpen: boolean;
  isCmdKOpen: boolean;
  isShortcutHelpOpen: boolean;
  isCreateIssueOpen: boolean;
  isCreateWorkspaceOpen: boolean;
  isInviteMemberOpen: boolean;
  
  activeView: 'list' | 'board';
  filterState: FilterState;
  
  setUserWorkspaces: (workspaces: Workspace[]) => void;
  setActiveWorkspace: (workspace: Workspace | null) => void;
  setTeams: (teams: Team[]) => void;
  setActiveTeam: (team: Team | null) => void;
  setMembers: (members: Member[]) => void;
  
  toggleSidebar: () => void;
  setCmdKOpen: (open: boolean) => void;
  setShortcutHelpOpen: (open: boolean) => void;
  setCreateIssueOpen: (open: boolean) => void;
  setCreateWorkspaceOpen: (open: boolean) => void;
  setInviteMemberOpen: (open: boolean) => void;
  setActiveView: (view: 'list' | 'board') => void;
  setFilterState: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
}

const initialFilters: FilterState = {
  search: '',
  status: [],
  priority: [],
  labelIds: [],
};

export const useAppStore = create<AppState>((set) => ({
  userWorkspaces: [],
  activeWorkspace: null,
  teams: [],
  activeTeam: null,
  members: [],

  isSidebarOpen: true,
  isCmdKOpen: false,
  isShortcutHelpOpen: false,
  isCreateIssueOpen: false,
  isCreateWorkspaceOpen: false,
  isInviteMemberOpen: false,
  activeView: 'list',
  filterState: initialFilters,

  setUserWorkspaces: (userWorkspaces) =>
    set((state) => {
      // Auto-set activeWorkspace if null or not in userWorkspaces
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
  setCreateIssueOpen: (isCreateIssueOpen) => set({ isCreateIssueOpen }),
  setCreateWorkspaceOpen: (isCreateWorkspaceOpen) => set({ isCreateWorkspaceOpen }),
  setInviteMemberOpen: (isInviteMemberOpen) => set({ isInviteMemberOpen }),
  setActiveView: (activeView) => set({ activeView }),
  setFilterState: (filters) =>
    set((state) => ({ filterState: { ...state.filterState, ...filters } })),
  resetFilters: () => set({ filterState: initialFilters }),
}));
