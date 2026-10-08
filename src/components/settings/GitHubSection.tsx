'use client';

import React, { useEffect, useState } from 'react';
import { GitBranch, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/stores/appStore';
import { getGithubStatus, getGithubInstallUrl, saveGithubConnection, GithubStatus } from '@/lib/firestore';

export function GitHubSection() {
  const workspaceId = useAppStore(s => s.activeWorkspace?.id);
  return workspaceId ? <WorkspaceGitHub key={workspaceId} workspaceId={workspaceId} /> : null;
}

function WorkspaceGitHub({ workspaceId }: { workspaceId: string }) {
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [installationId, setInstallationId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const choices = status?.availableConnections || [];
  const choice = choices.find(c => c.installationId === installationId);

  useEffect(() => {
    let active = true;
    getGithubStatus(workspaceId).then(value => {
      if (!active) return;
      setStatus(value);
      setInstallationId(value.availableConnections?.some(c => c.installationId === value.installationId) ? value.installationId! : value.availableConnections?.[0]?.installationId || '');
      setSelected(value.selectedRepositories || value.repositories || []);
      setEditing(!value.connected || !!value.uninstalled || !value.repositories?.length);
    }).catch(err => {
      if (active) setError(err instanceof Error ? err.message : 'Error al consultar GitHub.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [workspaceId]);

  const refresh = async () => {
    setBusy(true); setError(null);
    try {
      const value = await getGithubStatus(workspaceId);
      setStatus(value);
      setInstallationId(value.availableConnections?.some(c => c.installationId === value.installationId) ? value.installationId! : value.availableConnections?.[0]?.installationId || '');
      setSelected(value.selectedRepositories || value.repositories || []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Error al actualizar GitHub.'); }
    finally { setBusy(false); }
  };
  const connect = async () => {
    setBusy(true); setError(null);
    try { window.location.href = await getGithubInstallUrl(workspaceId); }
    catch (err) { setError(err instanceof Error ? err.message : 'Error al iniciar la conexión.'); setBusy(false); }
  };
  const save = async () => {
    if (!choice) return;
    setBusy(true); setError(null);
    try {
      await saveGithubConnection(workspaceId, choice.installationId, selected);
      setStatus(await getGithubStatus(workspaceId)); setEditing(false);
    } catch (err) { setError(err instanceof Error ? err.message : 'Error al guardar GitHub.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-4 p-5 bg-surface border border-default rounded-xl">
      <div className="flex items-center gap-2">
        <GitBranch className="w-4 h-4 text-secondary" />
        <h3 className="text-base font-semibold text-primary">GitHub</h3>
      </div>
      {error && <p role="alert" className="text-xs text-priority-urgent break-words">{error}</p>}
      {loading ? <Loader2 aria-label="Consultando GitHub" className="w-4 h-4 animate-spin" /> : <>
        {status?.connected && <div className="flex flex-col gap-1">
          <p className="text-sm text-primary">{status.uninstalled ? 'GitHub desinstalado en' : status.suspended ? 'Conexión suspendida en' : 'Conectado a'} <strong>{status.accountLogin}</strong></p>
          <p className="text-xs text-secondary break-words">{status.repositories?.join(', ') || 'Sin repositorios asignados a este workspace.'}</p>
        </div>}
        {status?.canManage && <>
          {!editing && <Button size="sm" variant="secondary" disabled={busy} onClick={() => {
            setSelected(status.selectedRepositories || status.repositories || []); setEditing(true);
          }}>Elegir repositorios</Button>}
          {editing && <div className="flex flex-col gap-3">
            <p className="text-xs text-secondary">Podés reutilizar una cuenta conectada en otro workspace que administrás. Elegí los repositorios para este workspace; los asignados a otro quedan reservados allí.</p>
            {choices.length > 0 && <>
              <label className="text-sm text-primary flex flex-col gap-1">Cuenta de GitHub
                <select aria-label="Cuenta de GitHub" value={installationId} disabled={busy || (status.connected && !status.uninstalled)} onChange={e => {
                  setInstallationId(e.target.value); setSelected([]);
                }} className="bg-surface border border-default rounded-md p-2">
                  {choices.map(c => <option key={c.installationId} value={c.installationId}>{c.accountLogin}</option>)}
                </select>
              </label>
              <fieldset disabled={busy} className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                <legend className="text-xs text-secondary mb-2">Repositorios de este workspace</legend>
                {choice?.repositories.map(repo => <label key={repo} className="flex items-center gap-2 text-xs text-primary break-all">
                  <input type="checkbox" checked={selected.includes(repo)} disabled={choice.assignedElsewhere.includes(repo)} onChange={e => setSelected(prev => e.target.checked ? [...prev, repo] : prev.filter(r => r !== repo))} />
                  {repo}{choice.assignedElsewhere.includes(repo) && <span className="text-tertiary"> — asignado a otro workspace</span>}
                </label>)}
                {!choice?.repositories.length && <p className="text-xs text-secondary">No hay repositorios autorizados. Agregalos desde GitHub y actualizá la lista.</p>}
                {selected.filter(r => !choice?.repositories.includes(r)).map(repo => <label key={repo} className="flex items-center gap-2 text-xs text-secondary">
                  <input type="checkbox" checked onChange={() => setSelected(prev => prev.filter(r => r !== repo))} />
                  {repo} — sin acceso en GitHub
                </label>)}
              </fieldset>
              <Button size="sm" disabled={busy || !choice} onClick={save}>{busy ? 'Guardando…' : 'Guardar conexión'}</Button>
            </>}
          </div>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={busy} onClick={connect}>{choices.length ? 'Gestionar acceso en GitHub' : 'Conectar GitHub'}</Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={refresh}>Actualizar lista</Button>
          </div>
          <p className="text-xs text-tertiary">Si agregás repositorios en GitHub, volvé aquí y actualizá la lista. Antes de quitar un repositorio, desconectá sus agentes y entornos.</p>
        </>}
        {status && !status.canManage && <p className="text-xs text-secondary">Un administrador del workspace puede gestionar esta conexión.</p>}
        {!status && <Button size="sm" variant="secondary" disabled={busy} onClick={refresh}>Reintentar</Button>}
      </>}
    </div>
  );
}
