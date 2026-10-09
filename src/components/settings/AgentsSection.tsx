'use client';

import { RunnerPreflightPanel } from './RunnerPreflightPanel';
import React, { useCallback, useEffect, useState } from 'react';
import { Bot, Loader2, Plus, GitBranch, Scale, Archive, RotateCcw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { SelectPopover } from '@/components/ui/SelectPopover';
import { useAppStore } from '@/stores/appStore';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
  AgentSummary,
  QaCalibrationSummary,
  createAgent,
  archiveAgent,
  disconnectAgentRepo,
  getQaCalibration,
  listAgents,
  restoreAgent,
  listRunners,
  RunnerSummary,
  updateAgent,
} from '@/lib/firestore';
import { AgentKind, AgentPrPublicationMode, AgentQaMode, AgentRole, AgentVisibility } from '@/types';

/** Requirements for automatic project QA through a local Runner. */
function qaDispatchBlockers(agent: AgentSummary): string[] {
  const blockers: string[] = [];
  if (!agent.runnerId) blockers.push('no tiene un Runner local vinculado');
  if (!agent.enabled) blockers.push('está deshabilitado');
  if (!agent.autonomousMode) blockers.push('no está en modo autónomo');
  return blockers;
}

function canDeleteAgent(agent: AgentSummary, userId: string | undefined, isWorkspaceAdmin: boolean): boolean {
  if (agent.ownerMemberId && agent.ownerMemberId === userId) return true;
  // Old agents may not have a recorded creator; keep them manageable by admins.
  return !agent.ownerMemberId && isWorkspaceAdmin;
}

function effectiveAgentRepos(agent: AgentSummary): string[] {
  if (agent.allowedRepos?.length) return agent.allowedRepos;
  return agent.connectedRepos?.map((connection) => connection.repoFullName).filter(Boolean) ?? [];
}

function runnerIneligibility(agent: AgentSummary, runner: RunnerSummary): string | null {
  if (runner.revokedAt) return 'está revocado';
  // Los agentes legacy no tenían visibility; el backend los trata como
  // públicos para conservarlos administrables. La UI debe aplicar la misma
  // regla para no ocultar Runners válidos detrás de un falso error de dueño.
  if ((agent.visibility ?? 'public') !== 'public' && runner.ownerMemberId !== agent.ownerMemberId) return 'pertenece a otro usuario';
  return null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function CreateAgentModal({
  isOpen,
  onClose,
  workspaceId,
  existingIds,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  existingIds: string[];
  onCreated: (agent: AgentSummary) => void;
}) {
  const teams = useAppStore((s) => s.teams);
  const members = useAppStore((s) => s.members);
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [agentId, setAgentId] = useState('');
  const [agentIdEdited, setAgentIdEdited] = useState(false);
  const [kind, setKind] = useState<AgentKind>('claude');
  const [visibility, setVisibility] = useState<AgentVisibility>('personal');
  const [role, setRole] = useState<AgentRole>('dev');
  const [defaultRepo, setDefaultRepo] = useState('');
  const [defaultTeamId, setDefaultTeamId] = useState('');
  const [maxConcurrentIssues, setMaxConcurrentIssues] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentMember = members.find((member) => member.userId === user?.uid);
  const canCreatePublicAgent = currentMember?.role === 'owner' || currentMember?.role === 'admin';

  const reset = useCallback(() => {
    setDisplayName('');
    setAgentId('');
    setAgentIdEdited(false);
    setKind('claude');
    setVisibility('personal');
    setRole('dev');
    setDefaultRepo('');
    setDefaultTeamId('');
    setMaxConcurrentIssues(1);
    setSubmitting(false);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    if (!agentIdEdited) setAgentId(slugify(value));
  };

  const idTaken = agentId.length > 0 && existingIds.includes(agentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !agentId.trim() || idTaken) return;
    setSubmitting(true);
    setError(null);
    try {
      const agent = await createAgent(workspaceId, {
        agentId: agentId.trim(),
        kind,
        displayName: displayName.trim(),
        defaultRepo: role === 'qa' ? undefined : defaultRepo.trim() || undefined,
        defaultTeamId: defaultTeamId || undefined,
        maxConcurrentIssues,
        role,
        visibility,
      });
      onCreated(agent);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el agente.');
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Nuevo agente" maxWidth="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-secondary">Nombre</label>
          <Input
            autoFocus
            placeholder="Ej: Claude"
            value={displayName}
            onChange={(e) => handleDisplayNameChange(e.target.value)}
          />
        </div>
        {canCreatePublicAgent && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-secondary">Visibilidad</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as AgentVisibility)}
              className="bg-surface border border-default rounded-md px-3 py-2 text-sm text-primary"
            >
              <option value="personal">Personal — solo lo usa su dueño</option>
              <option value="public">Público — los admins pueden asignarlo</option>
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-secondary">ID del agente</label>
          <Input
            placeholder="Ej: agent-claude"
            value={agentId}
            onChange={(e) => {
              setAgentId(slugify(e.target.value));
              setAgentIdEdited(true);
            }}
          />
          {idTaken && <p className="text-[11px] text-priority-urgent">Ya existe un agente con ese ID.</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-secondary">Tipo</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as AgentKind)}
            className="bg-surface border border-default rounded-md px-3 py-2 text-sm text-primary"
          >
            <option value="claude">Claude</option>
            <option value="codex">Codex</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-secondary">Rol</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AgentRole)}
            className="bg-surface border border-default rounded-md px-3 py-2 text-sm text-primary"
          >
            <option value="dev">Dev — implementa issues y abre PRs</option>
            <option value="qa">QA — revisa los PRs de otros agentes</option>
          </select>
          <p className="text-[11px] text-tertiary">
            Dev implementa los issues y QA revisa sus cambios. Ambos requieren un Runner local vinculado.
          </p>
        </div>
        {role === 'dev' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-secondary">Repo por defecto (opcional)</label>
            <Input placeholder="Ej: owner/repo" value={defaultRepo} onChange={(e) => setDefaultRepo(e.target.value)} />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-secondary">Team por defecto (opcional)</label>
          <select
            value={defaultTeamId}
            onChange={(e) => setDefaultTeamId(e.target.value)}
            className="bg-surface border border-default rounded-md px-3 py-2 text-sm text-primary"
          >
            <option value="">Sin team por defecto</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-secondary">Máx. issues concurrentes</label>
          <Input
            type="number"
            min={1}
            value={maxConcurrentIssues}
            onChange={(e) => setMaxConcurrentIssues(Math.max(1, parseInt(e.target.value, 10) || 1))}
          />
        </div>
        {error && <p className="text-xs text-priority-urgent">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={!displayName.trim() || !agentId.trim() || idTaken || submitting}>
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Crear agente'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Repos conectados de un agente, y el flujo para conectar uno nuevo.
 *
 * Conectar deja el repo listo salvo por un paso: el `CLAUDE_CODE_OAUTH_TOKEN`,
 * que es del usuario y Pulse no gestiona. En vez de dejarlo como una nota suelta
 * en la documentación, se muestra el comando exacto acá y el estado pasa a verde
 * cuando Pulse detecta el secret — GitHub devuelve nombres de secrets, nunca
 * valores, así que se puede verificar sin verlo.
 */
function RetiredAgentConnections({ agent, canManage, onChanged }: {
  agent: AgentSummary; canManage: boolean; onChanged: () => void;
}) {
  const workspaceId = useAppStore((s) => s.activeWorkspace?.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!agent.connectedRepos?.length) return null;
  const retireConnection = async (repo: string) => {
    if (!workspaceId) return;
    setBusy(true); setError('');
    try {
      const result = await disconnectAgentRepo(workspaceId, agent.id, repo);
      if (result.warnings?.length) setError(`La clave fue retirada. Limpieza pendiente: ${result.warnings.join(' ')}`);
      else onChanged();
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo retirar la conexión.'); }
    finally { setBusy(false); }
  };
  return <div className="flex flex-col gap-2 text-xs">
    <span className="font-semibold text-secondary">Conexiones antiguas de Actions · retiradas</span>
    <p className="text-tertiary">Estas conexiones ya no ejecutan agentes. Podés retirar su clave de Pulse y su secret del repositorio.</p>
    {agent.connectedRepos.map((connection) => <div key={connection.repoFullName} className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-secondary font-mono truncate"><GitBranch className="w-3 h-3 shrink-0" />{connection.repoFullName}</span>
      {canManage && <button disabled={busy} onClick={() => retireConnection(connection.repoFullName)} className="text-tertiary hover:text-priority-urgent disabled:opacity-50">Retirar conexión</button>}
    </div>)}
    {error && <p role="alert" className="text-priority-urgent">{error}</p>}
  </div>;
}

/**
 * Tasa de acuerdo humano/QA de un agente QA (D17): mientras está en `shadow`,
 * es la única señal de si el veredicto del agente coincide con lo que decide
 * el humano al mergear o cerrar el PR — sin esto, pasar a `enforce` sería a
 * ciegas.
 */
function QaCalibrationPanel({ agentId }: { agentId: string }) {
  const [summary, setSummary] = useState<QaCalibrationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getQaCalibration(agentId)
      .then((res) => {
        if (!cancelled) setSummary(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar la tasa de acuerdo.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  if (loading) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-tertiary">
        <Loader2 className="w-3 h-3 animate-spin" /> Cargando tasa de acuerdo…
      </p>
    );
  }

  if (error) return <p className="text-[11px] text-priority-urgent">{error}</p>;
  if (!summary) return null;

  return (
    <div className="flex items-center gap-3 text-[11px] text-secondary">
      <span className="flex items-center gap-1 font-medium text-primary">
        <Scale className="w-3 h-3 text-accent" />
        Tasa de acuerdo humano/QA
      </span>
      {summary.sampleSize === 0 ? (
        <span className="text-tertiary">Todavía no hay cierres humanos para comparar.</span>
      ) : (
        <span className="tabular-nums">
          {Math.round((summary.agreementRate ?? 0) * 100)}% ({summary.agreed}/{summary.sampleSize} últimas revisiones)
        </span>
      )}
    </div>
  );
}

export function AgentsSection() {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const members = useAppStore((s) => s.members);
  const { user } = useAuth();
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [archivedAgents, setArchivedAgents] = useState<AgentSummary[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<{ agentId: string; message: string } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [runners, setRunners] = useState<RunnerSummary[]>([]);

  const workspaceId = activeWorkspace?.id;
  const currentMember = members.find((member) => member.workspaceId === workspaceId && member.userId === user?.uid);
  const isWorkspaceAdmin = currentMember?.role === 'owner' || currentMember?.role === 'admin';

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [result, archivedResult, runnerResult] = await Promise.all([
        listAgents(workspaceId), listAgents(workspaceId, true), listRunners(workspaceId),
      ]);
      setAgents(result);
      setArchivedAgents(archivedResult);
      setRunners(runnerResult);

    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Error al cargar los agentes.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, not a render loop
    refresh();
  }, [refresh]);

  const handleToggleAutonomous = async (agent: AgentSummary) => {
    const nextValue = !agent.autonomousMode;
    setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, autonomousMode: nextValue } : a)));
    setSavingId(agent.id);
    try {
      await updateAgent(agent.id, { autonomousMode: nextValue });
    } catch (err) {
      setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, autonomousMode: agent.autonomousMode } : a)));
      alert(err instanceof Error ? err.message : 'Error al actualizar el agente.');
    } finally {
      setSavingId(null);
    }
  };

  const handlePrPublicationModeChange = async (agent: AgentSummary, value: AgentPrPublicationMode) => {
    const previous = agent.prPublicationMode;
    setAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, prPublicationMode: value } : a));
    setSavingId(agent.id);
    try {
      await updateAgent(agent.id, { prPublicationMode: value });
    } catch {
      setAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, prPublicationMode: previous } : a));
      alert('No se pudo guardar el modo de publicación de PR.');
    } finally {
      setSavingId(null);
    }
  };

  const handleQaModeChange = async (agent: AgentSummary, value: AgentQaMode) => {
    const prevValue = agent.qaMode;
    setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, qaMode: value } : a)));
    setSavingId(agent.id);
    try {
      await updateAgent(agent.id, { qaMode: value });
    } catch (err) {
      setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, qaMode: prevValue } : a)));
      alert(err instanceof Error ? err.message : 'Error al actualizar el agente.');
    } finally {
      setSavingId(null);
    }
  };

  const handleMaxConcurrentChange = async (agent: AgentSummary, value: number) => {
    if (!Number.isFinite(value) || value < 1) return;
    const prevValue = agent.maxConcurrentIssues;
    setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, maxConcurrentIssues: value } : a)));
    setSavingId(agent.id);
    try {
      await updateAgent(agent.id, { maxConcurrentIssues: value });
    } catch (err) {
      setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, maxConcurrentIssues: prevValue } : a)));
      alert(err instanceof Error ? err.message : 'Error al actualizar el agente.');
    } finally {
      setSavingId(null);
    }
  };

  const handleRunnerChange = async (agent: AgentSummary, runnerId: string) => {
    const previous = agent.runnerId;
    setAgents((prev) => prev.map((item) => item.id === agent.id ? { ...item, runnerId: runnerId || undefined } : item));
    setSavingId(agent.id);
    try {
      await updateAgent(agent.id, { runnerId: runnerId || null });
    } catch (err) {
      setAgents((prev) => prev.map((item) => item.id === agent.id ? { ...item, runnerId: previous } : item));
      alert(err instanceof Error ? err.message : 'No se pudo vincular el Runner.');
    } finally {
      setSavingId(null);
    }
  };

  const handleArchive = async (agent: AgentSummary) => {
    if (!window.confirm(`¿Archivar «${agent.displayName}»? Dejará de estar disponible para nuevas asignaciones. Se conservarán su historial, referencias y configuración, y podrás restaurarlo después.`)) return;
    setDeletingId(agent.id);
    setDeleteError(null);
    try {
      const archived = await archiveAgent(agent.id);
      setAgents((prev) => prev.filter((item) => item.id !== agent.id));
      setArchivedAgents((prev) => [archived, ...prev.filter((item) => item.id !== agent.id)]);
    } catch (err) {
      setDeleteError({
        agentId: agent.id,
        message: err instanceof Error ? err.message : 'No se pudo eliminar el agente.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleRestore = async (agent: AgentSummary) => {
    setDeletingId(agent.id);
    setDeleteError(null);
    try {
      const restored = await restoreAgent(agent.id);
      setArchivedAgents((prev) => prev.filter((item) => item.id !== agent.id));
      setAgents((prev) => [restored, ...prev.filter((item) => item.id !== agent.id)]);
    } catch (err) {
      setDeleteError({ agentId: agent.id, message: err instanceof Error ? err.message : 'No se pudo restaurar el agente.' });
    } finally {
      setDeletingId(null);
    }
  };

  if (!workspaceId) return null;

  return (
    <div className="flex flex-col gap-4 p-5 bg-surface border border-default rounded-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-secondary" />
          <h3 className="text-base font-semibold text-primary">Agentes</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setShowArchived((value) => !value)}>
            {showArchived ? 'Ver activos' : `Ver archivados${archivedAgents.length ? ` (${archivedAgents.length})` : ''}`}
          </Button>
          {!showArchived && <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setModalOpen(true)}>Crear agente</Button>}
        </div>
      </div>

      <p className="text-xs text-secondary">
        Los agentes de desarrollo y QA ejecutan su trabajo mediante Pulse Runner local. Vinculá un Runner y prepará su sesión para comenzar.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-secondary">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : loadError ? (
        <p className="text-xs text-priority-urgent">{loadError}</p>
      ) : (showArchived ? archivedAgents : agents).length === 0 ? (
        <p className="text-xs text-tertiary py-2">{showArchived ? 'No hay agentes archivados.' : 'Todavía no hay agentes en este workspace.'}</p>
      ) : (
        <div className="flex flex-col">
          {(showArchived ? archivedAgents : agents).map((agent, index) => showArchived ? (
            <div key={agent.id} className={cn('flex flex-col gap-2 py-4', index > 0 && 'border-t border-subtle')}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-sm font-medium text-primary truncate">{agent.displayName}</span>
                  <span className="text-xs text-tertiary">{agent.kind} · {agent.role === 'qa' ? 'QA' : 'Dev'} · Archivado {agent.archivedAt ? new Date(agent.archivedAt).toLocaleDateString() : ''}</span>
                </div>
                {canDeleteAgent(agent, user?.uid, isWorkspaceAdmin) && <Button variant="secondary" size="sm" disabled={deletingId !== null} icon={deletingId === agent.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} onClick={() => handleRestore(agent)}>Restaurar</Button>}
              </div>
              {deleteError?.agentId === agent.id && <p role="alert" className="text-xs text-priority-urgent">{deleteError.message}</p>}
            </div>
          ) : (
            <div
              key={agent.id}
              className={cn('flex flex-col gap-3 py-4', index > 0 && 'border-t border-subtle')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-primary truncate" title={agent.displayName}>
                      {agent.displayName}
                    </span>
                    <Badge variant="outline">{agent.role === 'qa' ? 'QA' : 'Dev'}</Badge>
                    <Badge variant="outline">{(agent.visibility ?? 'public') === 'public' ? 'Público' : 'Personal'}</Badge>
                  </div>
                  <span
                    className="text-xs text-tertiary font-mono truncate"
                    title={`${agent.kind} · ${agent.defaultRepo || 'sin repo por defecto'}`}
                  >
                    {agent.kind} · {agent.defaultRepo || 'sin repo por defecto'}
                  </span>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-secondary shrink-0 cursor-pointer">
                  Autónomo
                  <input
                    type="checkbox"
                    checked={agent.autonomousMode}
                    disabled={savingId === agent.id}
                    onChange={() => handleToggleAutonomous(agent)}
                    className="w-3.5 h-3.5 accent-accent"
                  />
                </label>
              </div>

              <div
                className={cn(
                  'grid gap-x-4 gap-y-2 p-3 bg-elevated border border-default rounded-lg text-xs',
                  agent.role === 'qa' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
                )}
              >
                {agent.role !== 'qa' && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="text-secondary shrink-0">Publicación de PR</span>
                      <SelectPopover
                        value={agent.prPublicationMode ?? 'draft'}
                        onChange={(value) => handlePrPublicationModeChange(agent, value as AgentPrPublicationMode)}
                        disabled={savingId === agent.id || !(isWorkspaceAdmin || agent.ownerMemberId === user?.uid)}
                        ariaLabel="Publicación de PR"
                        options={[
                          { value: 'draft', label: 'Borrador' },
                          { value: 'ready', label: 'Listo para revisión' },
                        ]}
                      />
                    </div>
                    <p className="text-tertiary text-[11px]">
                      Se aplica a nuevos trabajos. Borrador mantiene el issue en progreso; listo para revisión habilita QA cuando todos sus PR están listos.
                    </p>
                  </div>
                )}
                {agent.role === 'qa' && (
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-secondary shrink-0">Alcance QA</span>
                    <span className="text-primary">Todos los repos del proyecto</span>
                  </div>
                )}
                {agent.role === 'qa' && (
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-secondary shrink-0">Modo QA</span>
                    <SelectPopover
                      value={agent.qaMode ?? 'shadow'}
                      onChange={(v) => handleQaModeChange(agent, v as AgentQaMode)}
                      disabled={savingId === agent.id}
                      ariaLabel="Modo QA"
                      options={[
                        { value: 'shadow', label: 'Sombra' },
                        { value: 'enforce', label: 'Activo' },
                      ]}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-secondary shrink-0">Máx. concurrentes</span>
                  <input
                    type="number"
                    min={1}
                    value={agent.maxConcurrentIssues}
                    disabled={savingId === agent.id}
                    onChange={(e) => handleMaxConcurrentChange(agent, parseInt(e.target.value, 10))}
                    className="w-16 bg-surface border border-default rounded-md px-2 py-1 text-right text-primary text-xs"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-secondary shrink-0">Pulse Runner</span>
                  {(() => {
                    const eligibleRunners = runners.filter((runner) => !runnerIneligibility(agent, runner));
                    const currentRunner = runners.find((runner) => runner.id === agent.runnerId);
                    const currentReason = currentRunner ? runnerIneligibility(agent, currentRunner) : null;
                    return <div className="flex flex-col items-end gap-1">
                      <SelectPopover
                        value={currentReason ? '' : agent.runnerId ?? ''}
                        onChange={(value) => handleRunnerChange(agent, value)}
                        disabled={savingId === agent.id}
                        ariaLabel="Pulse Runner"
                        placeholder="Seleccionar Runner"
                        options={[
                          { value: '', label: 'Sin Runner · configuración pendiente' },
                          ...eligibleRunners.map((runner) => ({
                            value: runner.id,
                            label: `${runner.displayName} · ${runner.status === 'online' ? 'En línea' : 'No disponible'}`,
                          })),
                        ]}
                      />
                      {currentReason ? <span className="max-w-56 text-right text-[10px] text-priority-urgent">Runner actual no disponible: {currentReason}.</span>
                        : eligibleRunners.length === 0 && <span className="max-w-56 text-right text-[10px] text-tertiary">No hay Runner disponible para este dueño.</span>}
                    </div>;
                  })()}
                </div>
              </div>

              {agent.runnerId && (isWorkspaceAdmin || ((agent.visibility ?? 'public') === 'personal' && agent.ownerMemberId === user?.uid)) && <RunnerPreflightPanel key={`${agent.id}-${agent.runnerId}-${agent.role}-${agent.enabled}-${agent.prPublicationMode ?? 'draft'}-${effectiveAgentRepos(agent).join(',')}-${agent.reviewRepo}`} agent={agent} />}

              {!agent.runnerId && <p role="status" className="text-xs text-priority-high">Configuración pendiente: vinculá un Runner local para ejecutar este agente. Los agentes de GitHub Actions fueron retirados.</p>}
              <RetiredAgentConnections agent={agent} canManage={isWorkspaceAdmin || agent.ownerMemberId === user?.uid} onChanged={refresh} />

              {agent.role === 'qa' && qaDispatchBlockers(agent).length > 0 && (
                <p className="text-[11px] text-priority-urgent">
                  Revisiones pendientes: {qaDispatchBlockers(agent).join('; ')}.
                </p>
              )}
              {agent.role === 'qa' && agent.runnerId && (
                <p className="text-[11px] text-secondary">
                  QA por Pulse Runner: recibe snapshots de todos los repos habilitados del proyecto; no requiere secrets ni GitHub Actions por repo.
                </p>
              )}

              {agent.role === 'qa' && (
                <div className="pt-1 border-t border-subtle">
                  <QaCalibrationPanel agentId={agent.id} />
                </div>
              )}

              {canDeleteAgent(agent, user?.uid, isWorkspaceAdmin) && (
                <div className="flex flex-col items-start gap-2 pt-1 border-t border-subtle">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={deletingId === agent.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                    disabled={deletingId !== null || savingId === agent.id}
                    onClick={() => handleArchive(agent)}
                    aria-label={`Archivar agente ${agent.displayName}`}
                  >
                    Archivar agente
                  </Button>
                  {deleteError?.agentId === agent.id && (
                    <p role="alert" className="text-xs text-priority-urgent">{deleteError.message}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {workspaceId && (
        <CreateAgentModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          workspaceId={workspaceId}
          existingIds={[...agents, ...archivedAgents].map((a) => a.id)}
          onCreated={(agent) => setAgents((prev) => [agent, ...prev])}
        />
      )}
    </div>
  );
}
