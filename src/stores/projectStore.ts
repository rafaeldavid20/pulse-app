import { create } from 'zustand';
import { Project } from '@/types';
import { createRealProject, updateRealProject } from '@/lib/firestore';

interface ProjectState {
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  addProject: (projectData: Partial<Project> & { workspaceId: string; teamId: string; name: string }) => Promise<Project>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  setProjects: (projects) => set({ projects }),

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
