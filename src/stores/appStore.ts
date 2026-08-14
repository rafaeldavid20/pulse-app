import { create } from 'zustand';
import { Workspace, Team, Member, FilterState } from '@/types';

interface AppState {
  activeWorkspace: Workspace | null;
  activeTeam: Team | null;
  members: Member[];
  isSidebarOpen: boolean;
  isCmdKOpen: boolean;
  isShortcutHelpOpen: boolean;
  isCreateIssueOpen: boolean;
  activeView: 'list' | 'board';
  filterState: FilterState;
  
  setActiveWorkspace: (workspace: Workspace | null) => void;
  setActiveTeam: (team: Team | null) => void;
  setMembers: (members: Member[]) => void;
  toggleSidebar: () => void;
  setCmdKOpen: (open: boolean) => void;
  setShortcutHelpOpen: (open: boolean) => void;
  setCreateIssueOpen: (open: boolean) => void;
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
  activeWorkspace: {
    id: 'ws-default',
    name: 'Pulse Workspace',
    slug: 'pulse',
    ownerId: 'demo-user-123',
    createdAt: new Date().toISOString(),
  },
  activeTeam: {
    id: 'eng',
    workspaceId: 'ws-default',
    name: 'Engineering',
    key: 'ENG',
    icon: '⚡',
    issueCount: 12,
    createdAt: new Date().toISOString(),
  },
  members: [
    {
      id: 'm-1',
      workspaceId: 'ws-default',
      userId: 'demo-user-123',
      role: 'owner',
      displayName: 'Rafael Rodriguez',
      email: 'rafaeldavidrodriguez.93@gmail.com',
      photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      joinedAt: new Date().toISOString(),
    },
    {
      id: 'm-2',
      workspaceId: 'ws-default',
      userId: 'user-2',
      role: 'admin',
      displayName: 'Sofia Chen',
      email: 'sofia@pulse.dev',
      joinedAt: new Date().toISOString(),
    },
    {
      id: 'm-3',
      workspaceId: 'ws-default',
      userId: 'user-3',
      role: 'member',
      displayName: 'Lucas Mateo',
      email: 'lucas@pulse.dev',
      joinedAt: new Date().toISOString(),
    },
  ],
  isSidebarOpen: true,
  isCmdKOpen: false,
  isShortcutHelpOpen: false,
  isCreateIssueOpen: false,
  activeView: 'list',
  filterState: initialFilters,

  setActiveWorkspace: (activeWorkspace) => set({ activeWorkspace }),
  setActiveTeam: (activeTeam) => set({ activeTeam }),
  setMembers: (members) => set({ members }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setCmdKOpen: (isCmdKOpen) => set({ isCmdKOpen }),
  setShortcutHelpOpen: (isShortcutHelpOpen) => set({ isShortcutHelpOpen }),
  setCreateIssueOpen: (isCreateIssueOpen) => set({ isCreateIssueOpen }),
  setActiveView: (activeView) => set({ activeView }),
  setFilterState: (filters) =>
    set((state) => ({ filterState: { ...state.filterState, ...filters } })),
  resetFilters: () => set({ filterState: initialFilters }),
}));
