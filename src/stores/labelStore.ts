import { create } from 'zustand';
import { Label } from '@/types';
import { nanoid } from 'nanoid';

interface LabelState {
  labels: Label[];
  addLabel: (label: { name: string; color: string; teamId?: string }) => Label;
  deleteLabel: (id: string) => void;
}

const INITIAL_LABELS: Label[] = [
  { id: 'l-bug', teamId: 'eng', name: 'bug', color: '#F75555' },
  { id: 'l-feature', teamId: 'eng', name: 'feature', color: '#5E6AD2' },
  { id: 'l-frontend', teamId: 'eng', name: 'frontend', color: '#F09436' },
  { id: 'l-backend', teamId: 'eng', name: 'backend', color: '#5E94E4' },
  { id: 'l-design', teamId: 'eng', name: 'design', color: '#EC4899' },
  { id: 'l-auth', teamId: 'eng', name: 'auth', color: '#10B981' },
  { id: 'l-api', teamId: 'eng', name: 'api', color: '#8B5CF6' },
  { id: 'l-performance', teamId: 'eng', name: 'performance', color: '#F7C948' },
];

export const useLabelStore = create<LabelState>((set, get) => ({
  labels: INITIAL_LABELS,

  addLabel: ({ name, color, teamId = 'eng' }) => {
    const newLabel: Label = {
      id: `l-${nanoid(6)}`,
      teamId,
      name: name.trim().toLowerCase(),
      color: color || '#5E6AD2',
    };
    set((state) => ({ labels: [...state.labels, newLabel] }));
    return newLabel;
  },

  deleteLabel: (id) =>
    set((state) => ({ labels: state.labels.filter((l) => l.id !== id) })),
}));
