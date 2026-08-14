import { create } from 'zustand';
import { Project } from '@/types';

interface ProjectState {
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
}

const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    teamId: 'eng',
    name: 'Pulse MVP Launch',
    description: 'Construcción del Jira Killer con experiencia ultra-rápida tipo Linear.',
    status: 'in_progress',
    leadId: 'demo-user-123',
    color: '#5E6AD2',
    targetDate: '2026-09-01T00:00:00.000Z',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'proj-2',
    teamId: 'eng',
    name: 'Dark Mode Design System',
    description: 'Creación de tokens CSS, animaciones suaves y componentes UI minimalistas.',
    status: 'completed',
    leadId: 'user-2',
    color: '#F09436',
    targetDate: '2026-08-15T00:00:00.000Z',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'proj-3',
    teamId: 'eng',
    name: 'Integración GitHub & Webhooks',
    description: 'Sincronización automática de commits, ramas y pull requests.',
    status: 'planned',
    leadId: 'user-3',
    color: '#5E94E4',
    targetDate: '2026-10-01T00:00:00.000Z',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const useProjectStore = create<ProjectState>((set) => ({
  projects: INITIAL_PROJECTS,
  setProjects: (projects) => set({ projects }),
  addProject: (project) =>
    set((state) => ({ projects: [project, ...state.projects] })),
  updateProject: (id, updates) =>
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
}));
