import { create } from 'zustand';
import { Project } from '@/types';
import { createRealProject, updateRealProject } from '@/lib/firestore';

interface ProjectState {
  projects: Project[];
  /**
   * Si ya llegó la primera snapshot del workspace activo. Lo que se deriva de
   * "no hay ningún proyecto X" (la superficie de Salesforce, TES-270) tiene que
   * esperarlo: con la lista vacía de arranque, afirmaría algo falso.
   */
  loaded: boolean;
  setProjects: (projects: Project[]) => void;
  resetProjects: () => void;
  addProject: (projectData: Partial<Project> & { workspaceId: string; teamId: string; name: string }) => Promise<Project>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  loaded: false,
  setProjects: (projects) => set({ projects, loaded: true }),
  resetProjects: () => set({ projects: [], loaded: false }),

  addProject: async (data) => {
    const created = await createRealProject(data);
    return created;
  },

  updateProject: async (id, updates) => {
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
    await updateRealProject(id, updates);
  },
}));
