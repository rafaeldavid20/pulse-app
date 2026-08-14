import { create } from 'zustand';
import { Issue, IssueStatus, IssuePriority } from '@/types';
import { nanoid } from 'nanoid';

interface IssueState {
  issues: Issue[];
  selectedIssueId: string | null;
  peekIssueId: string | null;
  selectedIssueIds: string[]; // multi-select
  
  setIssues: (issues: Issue[]) => void;
  setSelectedIssueId: (id: string | null) => void;
  setPeekIssueId: (id: string | null) => void;
  toggleIssueSelection: (id: string) => void;
  clearSelection: () => void;
  
  addIssue: (issueData: Partial<Issue>) => Issue;
  updateIssue: (id: string, updates: Partial<Issue>) => void;
  deleteIssue: (id: string) => void;
  bulkUpdateStatus: (ids: string[], status: IssueStatus) => void;
}

const INITIAL_ISSUES: Issue[] = [
  {
    id: 'issue-1',
    teamId: 'eng',
    identifier: 'ENG-101',
    number: 101,
    title: 'Implementar autenticación con Google Sign-In',
    description: 'Configurar Firebase Auth con OAuth popup y sincronizar perfiles de usuario en Firestore.',
    status: 'in_progress',
    priority: 1,
    assigneeId: 'demo-user-123',
    creatorId: 'demo-user-123',
    labelIds: ['bug', 'auth'],
    createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'issue-2',
    teamId: 'eng',
    identifier: 'ENG-102',
    number: 102,
    title: 'Diseñar arquitectura local-first para mutaciones optimistas',
    description: 'Garantizar que todos los status y updates de prioridad se apliquen en <10ms en memoria antes de persistir en Firestore.',
    status: 'todo',
    priority: 2,
    assigneeId: 'user-2',
    creatorId: 'demo-user-123',
    labelIds: ['architecture', 'performance'],
    createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'issue-3',
    teamId: 'eng',
    identifier: 'ENG-103',
    number: 103,
    title: 'Cmd+K Command Palette universal',
    description: 'Integrar la librería cmdk de Rauno para permitir búsqueda fuzzy e instrucciones por teclado.',
    status: 'in_review',
    priority: 1,
    assigneeId: 'user-3',
    creatorId: 'user-2',
    labelIds: ['ui', 'ux'],
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 1).toISOString(),
  },
  {
    id: 'issue-4',
    teamId: 'eng',
    identifier: 'ENG-104',
    number: 104,
    title: 'Peek panel deslizable con tecla Space',
    description: 'Permitir inspeccionar y editar cualquier issue sin perder la posición de scroll en la lista principal.',
    status: 'done',
    priority: 3,
    assigneeId: 'demo-user-123',
    creatorId: 'demo-user-123',
    labelIds: ['feature'],
    createdAt: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24 * 1).toISOString(),
  },
  {
    id: 'issue-5',
    teamId: 'eng',
    identifier: 'ENG-105',
    number: 105,
    title: 'Optimización de rendering de lista con Inter font',
    description: 'Configurar tipografía ajustada de alta densidad visual idéntica a Linear.',
    status: 'backlog',
    priority: 4,
    assigneeId: undefined,
    creatorId: 'user-3',
    labelIds: ['design'],
    createdAt: new Date(Date.now() - 3600000 * 24 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24 * 6).toISOString(),
  },
];

export const useIssueStore = create<IssueState>((set, get) => ({
  issues: INITIAL_ISSUES,
  selectedIssueId: null,
  peekIssueId: null,
  selectedIssueIds: [],

  setIssues: (issues) => set({ issues }),
  setSelectedIssueId: (selectedIssueId) => set({ selectedIssueId }),
  setPeekIssueId: (peekIssueId) => set({ peekIssueId }),

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

  addIssue: (data) => {
    const currentIssues = get().issues;
    const nextNum = currentIssues.length + 106;
    const newIssue: Issue = {
      id: `issue-${nanoid(8)}`,
      teamId: data.teamId || 'eng',
      identifier: `ENG-${nextNum}`,
      number: nextNum,
      title: data.title || 'Nuevo Issue',
      description: data.description || '',
      status: data.status || 'todo',
      priority: (data.priority !== undefined ? data.priority : 3) as IssuePriority,
      assigneeId: data.assigneeId,
      creatorId: data.creatorId || 'demo-user-123',
      labelIds: data.labelIds || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set({ issues: [newIssue, ...currentIssues] });
    return newIssue;
  },

  updateIssue: (id, updates) =>
    set((state) => ({
      issues: state.issues.map((iss) =>
        iss.id === id
          ? { ...iss, ...updates, updatedAt: new Date().toISOString() }
          : iss
      ),
    })),

  deleteIssue: (id) =>
    set((state) => ({
      issues: state.issues.filter((iss) => iss.id !== id),
      peekIssueId: state.peekIssueId === id ? null : state.peekIssueId,
      selectedIssueId: state.selectedIssueId === id ? null : state.selectedIssueId,
    })),

  bulkUpdateStatus: (ids, status) =>
    set((state) => ({
      issues: state.issues.map((iss) =>
        ids.includes(iss.id)
          ? { ...iss, status, updatedAt: new Date().toISOString() }
          : iss
      ),
      selectedIssueIds: [],
    })),
}));
