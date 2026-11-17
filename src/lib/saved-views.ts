import { collection, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import type { SavedView } from '@/types';

export type ViewInput = Pick<SavedView, 'name' | 'query' | 'display' | 'shared'> & Partial<Pick<SavedView, 'teamId' | 'icon' | 'grouping' | 'ordering'>>;
export async function viewAction<T>(action: 'create' | 'update' | 'delete', data: Record<string, unknown>): Promise<T> {
  const callable = httpsCallable(functions, 'pulsePlatformAction');
  const response = await callable({ actionCode: `views.${action}`, data });
  const envelope = response.data as { success: boolean; data?: T; error?: string };
  if (!envelope.success || !envelope.data) throw new Error(envelope.error || 'No se pudo guardar la vista.');
  return envelope.data;
}

/** Two queries match the security rules; never fetch private views of others. */
export function subscribeSavedViews(workspaceId: string, userId: string, update: (views: SavedView[]) => void, onError: (message: string) => void): Unsubscribe {
  let own: SavedView[] | null = null, shared: SavedView[] | null = null;
  let alive = true;
  let failed = false;
  const publish = () => {
    if (!alive || failed || !own || !shared) return;
    const merged = new Map([...own, ...shared].map(view => [view.id, view]));
    update([...merged.values()].sort((a, b) => a.name.localeCompare(b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
  };
  const collectionRef = collection(db, 'saved_views');
  const error = () => { if (alive) { failed = true; own = null; shared = null; onError('No se pudieron cargar las vistas.'); } };
  const ownStop = onSnapshot(query(collectionRef, where('workspaceId', '==', workspaceId), where('ownerId', '==', userId)), snap => { own = snap.docs.map(d => ({ ...d.data(), id: d.id }) as SavedView); publish(); }, error);
  const sharedStop = onSnapshot(query(collectionRef, where('workspaceId', '==', workspaceId), where('shared', '==', true)), snap => { shared = snap.docs.map(d => ({ ...d.data(), id: d.id }) as SavedView); publish(); }, error);
  return () => { alive = false; ownStop(); sharedStop(); };
}
