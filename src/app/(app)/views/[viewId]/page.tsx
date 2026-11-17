'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { IssueList } from '@/components/issues/IssueList';
import { IssueBoard } from '@/components/issues/IssueBoard';
import { usePqlContext } from '@/hooks/usePqlContext';
import { execute, parse, serialize } from '@/lib/pql';
import { viewAction } from '@/lib/saved-views';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';
import { useSavedViewStore } from '@/stores/savedViewStore';
import type { SavedView, SavedViewGrouping } from '@/types';

type Draft = { name: string; query: string; teamId: string; grouping: SavedViewGrouping; display: 'list' | 'board'; shared: boolean; icon: string; ordering: NonNullable<SavedView['ordering']> };
const draftOf = (view: SavedView): Draft => ({ name: view.name, query: view.query, teamId: view.teamId ?? '', grouping: view.grouping ?? 'none', display: view.display, shared: view.shared, icon: view.icon ?? 'list', ordering: view.ordering ?? [] });
const payload = (draft: Draft) => ({ ...draft, teamId: draft.teamId || null });

export default function SavedViewPage({ params }: { params: Promise<{ viewId: string }> }) {
  const { viewId } = use(params);
  const workspaceId = useAppStore(s => s.activeWorkspace?.id);
  const views = useSavedViewStore(s => s.views); const loaded = useSavedViewStore(s => s.loaded); const error = useSavedViewStore(s => s.error);
  const view = views.find(v => v.id === viewId && v.workspaceId === workspaceId);
  if (error) return <p role="alert" className="p-6">{error}</p>;
  if (!loaded) return <p role="status" className="p-6">Cargando vista…</p>;
  if (!view) return <div className="p-6"><p>La vista no está disponible o ya no tenés acceso.</p><Link href="/my-issues">Ir a Mis Issues</Link></div>;
  return <SavedViewEditor key={view.id} view={view} />;
}

function SavedViewEditor({ view }: { view: SavedView }) {
  const router = useRouter();
  const actorId = useAppStore(s => s.workspaceUserId);
  const members = useAppStore(s => s.members);
  const teams = useAppStore(s => s.teams);
  const catalogReady = useAppStore(s => s.workspaceCatalogReady);
  const catalogError = useAppStore(s => s.workspaceCatalogError);
  const issues = useIssueStore(s => s.issues);
  const issuesLoaded = useIssueStore(s => s.issuesLoaded);
  const issuesError = useIssueStore(s => s.issuesError);
  const context = usePqlContext();
  const [draft, setDraft] = useState(() => draftOf(view));
  const [saved, setSaved] = useState(() => draftOf(view));
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const role = members.find(m => m.userId === actorId)?.role;
  const canEdit = actorId === view.ownerId || (!!view.systemKey && view.shared && (role === 'owner' || role === 'admin'));
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const result = useMemo(() => {
    if (!issuesLoaded || issuesError || !catalogReady || catalogError || context.workspaceId !== view.workspaceId) return null;
    if (draft.teamId && !context.teams.some(team => team.id === draft.teamId)) return { ok: false as const, diagnostic: { message: 'El equipo de la vista no está disponible.', line: 1, column: 1 } };
    const parsed = parse(draft.query);
    if (!parsed.ok) return parsed;
    const ordering = !parsed.query.orderBy.length && draft.ordering.length ? serialize({ orderBy: draft.ordering.map(o => ({ ...o, start: 0, end: 0 })) }) : '';
    const source = [draft.query, ordering].filter(Boolean).join(' ');
    const scoped = issues.filter(issue => issue.workspaceId === view.workspaceId && (!draft.teamId || issue.teamId === draft.teamId));
    return execute(source, scoped, { ...context, teamId: draft.teamId || undefined, now: new Date().toISOString() });
  }, [context, draft.query, draft.teamId, draft.ordering, issues, issuesLoaded, issuesError, catalogReady, catalogError, view.workspaceId]);
  const parsed = parse(draft.query);
  const hasOrder = parsed.ok && parsed.query.orderBy.length > 0;
  const orderValue = draft.ordering.length === 1 ? `${draft.ordering[0].field}:${draft.ordering[0].direction}` : draft.ordering.length ? 'custom' : '';
  const act = async (action: 'update' | 'create' | 'delete') => {
    if (action === 'delete' && !window.confirm('¿Eliminar esta vista?')) return;
    setBusy(true); setError('');
    try {
      if (action === 'delete') { await viewAction('delete', { id: view.id }); router.push('/my-issues'); return; }
      if (action === 'create') {
        const created = await viewAction<SavedView>('create', { workspaceId: view.workspaceId, ...payload({ ...draft, name: `${draft.name} · copia`.slice(0, 80), shared: false }) });
        router.push(`/views/${created.id}`); return;
      }
      const updated = await viewAction<SavedView>('update', { id: view.id, ...payload(draft) });
      const next = draftOf(updated); setDraft(next); setSaved(next);
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo completar la acción.'); }
    finally { setBusy(false); }
  };
  return <div className="flex-1 flex flex-col h-full overflow-hidden">
    <Header title={view.name} showViewToggle={false} showSearch={false} showCreateButton={false} />
    <main className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-xs text-secondary"><span>{view.shared ? 'Compartida' : 'Privada'}{draft.teamId ? ' · Equipo' : ' · Workspace'}</span>{view.systemKey === 'blocked' && <span>Bloqueos del agente</span>}{dirty && <span role="status">Cambios sin guardar</span>}</div>
      <div className="grid gap-3 rounded-lg border border-default bg-surface p-4">
        <label className="text-xs">Nombre<input value={draft.name} maxLength={80} onChange={e => setDraft({ ...draft, name: e.target.value })} className="mt-1 block w-full rounded border border-default bg-base p-2 text-sm" /></label>
        <label className="text-xs">Consulta PQL<textarea value={draft.query} onChange={e => setDraft({ ...draft, query: e.target.value })} className="mt-1 block w-full rounded border border-default bg-base p-2 font-mono text-sm" rows={3} /></label>
        <div className="flex flex-wrap gap-4 text-xs">
          <label>Icono <select value={draft.icon} onChange={e => setDraft({ ...draft, icon: e.target.value })}>{['list', 'inbox', 'user', 'eye', 'flag', 'calendar', 'lock', 'zap'].map(icon => <option key={icon} value={icon}>{icon}</option>)}</select></label>
          <label>Ámbito <select value={draft.teamId} onChange={e => setDraft({ ...draft, teamId: e.target.value })}><option value="">Workspace</option>{teams.filter(t => t.workspaceId === view.workspaceId).map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
          <label>Agrupar <select value={draft.grouping} onChange={e => setDraft({ ...draft, grouping: e.target.value as SavedViewGrouping })}>{['none', 'status', 'assignee', 'priority', 'project', 'epic', 'cycle'].map(v => <option key={v} value={v}>{v}</option>)}</select></label>
          <label>Presentación <select value={draft.display} onChange={e => setDraft({ ...draft, display: e.target.value as 'list' | 'board' })}><option value="list">Lista</option><option value="board">Board</option></select></label>
          <label>Orden <select disabled={hasOrder} value={orderValue} onChange={e => { const [field, direction] = e.target.value.split(':'); if (field !== 'custom') setDraft({ ...draft, ordering: field ? [{ field, direction: direction as 'asc' | 'desc' }] : [] }); }}><option value="">Predeterminado</option>{orderValue === 'custom' && <option value="custom">Personalizado</option>}<option value="priority:asc">Prioridad</option><option value="updated:desc">Actualizado</option><option value="created:desc">Creado</option><option value="estimate:desc">Estimación</option></select></label>
          <label><input type="checkbox" checked={draft.shared} disabled={!!view.systemKey} onChange={e => setDraft({ ...draft, shared: e.target.checked })} /> Compartida</label>
        </div>
        {hasOrder && <p className="text-xs text-tertiary">El ORDER BY de la consulta define el orden.</p>}
        <div className="flex flex-wrap gap-3 text-xs">
          {canEdit && <button type="button" disabled={busy || !dirty || !result?.ok || !draft.name.trim()} onClick={() => act('update')}>Guardar</button>}
          <button type="button" disabled={busy || !dirty} onClick={() => { const next = draftOf(view); setDraft(next); setSaved(next); setError(''); }}>Descartar</button>
          <button type="button" disabled={busy || !result?.ok || !draft.name.trim()} onClick={() => act('create')}>Guardar copia</button>
          {canEdit && <button type="button" disabled={busy} onClick={() => act('delete')}>Eliminar</button>}
        </div>
        {error && <p role="alert" className="text-xs text-priority-urgent">{error}</p>}
      </div>
      {issuesError || catalogError ? <p role="alert">{issuesError || catalogError}</p> : !issuesLoaded || !catalogReady ? <p role="status">Cargando issues y catálogos…</p>
        : result && !result.ok ? <p role="alert">Línea {result.diagnostic.line}, columna {result.diagnostic.column}: {result.diagnostic.message}</p>
        : result?.ok ? <><p role="status" className="text-xs text-secondary">{result.issues.length} resultados{draft.query.toLowerCase().includes('currentcycle()') && draft.teamId && !context.cycles.some(c => c.teamId === draft.teamId && c.status === 'active') ? ' · Este equipo no tiene un ciclo activo.' : ''}</p>
          {draft.display === 'board' ? <IssueBoard issues={result.issues} alreadyFiltered groupByOverride={draft.grouping === 'epic' ? 'epic' : 'status'} /> : <IssueList issues={result.issues} alreadyFiltered groupByOverride={draft.grouping} />}</> : null}
    </main>
  </div>;
}
