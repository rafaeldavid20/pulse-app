'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/appStore';
import { filtersToPql } from '@/lib/pql-filter-conversion';
import { queryWithRouteScope } from '@/lib/saved-view-scope';
import { viewAction } from '@/lib/saved-views';
import type { SavedView } from '@/types';

export function SaveViewDialog({ close }: { close: () => void }) {
  const router = useRouter(); const pathname = usePathname();
  const workspaceId = useAppStore(s => s.activeWorkspace?.id);
  const filters = useAppStore(s => s.filterState); const mode = useAppStore(s => s.filterMode);
  const query = useAppStore(s => s.pqlDraft); const sortBy = useAppStore(s => s.sortBy);
  const grouping = useAppStore(s => s.groupBy); const activeView = useAppStore(s => s.activeView);
  const [name, setName] = useState(''); const [icon, setIcon] = useState('list');
  const [shared, setShared] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const save = async () => {
    if (!workspaceId) return;
    setBusy(true); setError('');
    try {
      const source = queryWithRouteScope(mode === 'pql' ? query : filtersToPql(filters, sortBy), pathname);
      const teamId = /^\/team\/([^/]+)(?:\/|$)/.exec(pathname)?.[1];
      const result = await viewAction<SavedView>('create', { workspaceId, name, icon, query: source, grouping, display: activeView === 'board' ? 'board' : 'list', shared, ...(teamId ? { teamId } : {}) });
      close(); router.push(`/views/${result.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar la vista.'); }
    finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation">
    <div role="dialog" aria-modal="true" aria-labelledby="save-view-title" className="w-full max-w-md rounded-xl border border-default bg-surface p-5 shadow-xl space-y-4">
      <h2 id="save-view-title" className="font-semibold text-primary">Guardar como vista</h2>
      <label className="block text-sm">Nombre<input autoFocus value={name} maxLength={80} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded border border-default bg-base p-2" /></label>
      <label className="block text-sm">Icono<select value={icon} onChange={e => setIcon(e.target.value)} className="ml-2 rounded border border-default bg-base p-1">{['list', 'inbox', 'user', 'eye', 'flag', 'calendar', 'lock', 'zap'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} /> Compartir con el workspace</label>
      {error && <p role="alert" className="text-sm text-priority-urgent">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" onClick={close} disabled={busy}>Cancelar</button><button type="button" onClick={save} disabled={busy || !name.trim()} className="rounded bg-accent px-3 py-1 text-white">{busy ? 'Guardando…' : 'Guardar'}</button></div>
    </div>
  </div>;
}
