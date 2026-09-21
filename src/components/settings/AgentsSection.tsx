'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Bot, Loader2, Plus, GitBranch, Scale } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAppStore } from '@/stores/appStore';
import {
  AgentSummary,
  ConnectRepoResult,
  LATEST_AGENT_WORKFLOW_VERSION,
  QaCalibrationSummary,
  connectAgentRepo,
  createAgent,
  disconnectAgentRepo,
  getGithubStatus,
  getQaCalibration,
  listAgents,
  updateAgent,
} from '@/lib/firestore';
import { AgentQaMode, AgentRole } from '@/types';

/**
 * Las condiciones que `qaDispatchTrigger` exige para elegir un agente QA
 * (`role: 'qa'`, `enabled`, `autonomousMode` y `reviewRepo` igual al repo del
 * issue). Cuando alguna falta, el trigger loguea un skip y sigue: no hay error
 * en ningún lado, el QA simplemente nunca corre. Esto lo hace visible en
 * Settings en vez de en los logs de Cloud Functions.
 */
function qaDispatchBlockers(agent: AgentSummary): string[] {
  const blockers: string[] = [];
  if (!agent.reviewRepo) blockers.push('no tiene repo a revisar');
  if (!agent.enabled) blockers.push('está deshabilitado');
  if (!agent.autonomousMode) blockers.push('no está en modo autónomo');
  return blockers;
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
  repos,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  existingIds: string[];
  repos: string[];
  onCreated: (agent: AgentSummary) => void;
}) {
  const teams = useAppStore((s) => s.teams);
  const [displayName, setDisplayName] = useState('');
  const [agentId, setAgentId] = useState('');
  const [agentIdEdited, setAgentIdEdited] = useState(false);
  const [kind, setKind] = useState('claude');
  const [role, setRole] = useState<AgentRole>('dev');
  const [reviewRepo, setReviewRepo] = useState('');
  const [defaultRepo, setDefaultRepo] = useState('');
  const [defaultTeamId, setDefaultTeamId] = useState('');
  const [maxConcurrentIssues, setMaxConcurrentIssues] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setDisplayName('');
    setAgentId('');
    setAgentIdEdited(false);
    setKind('claude');
    setRole('dev');
    setReviewRepo('');
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
        reviewRepo: role === 'qa' ? reviewRepo || undefined : undefined,
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
            onChange={(e) => setKind(e.target.value)}
            className="bg-surface border border-default rounded-md px-3 py-2 text-sm text-primary"
          >
            <option value="claude">Claude</option>
            <option value="chatgpt">ChatGPT</option>
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
            El rol decide qué workflow y qué secret escribe &quot;Conectar repo&quot;, y con qué permisos
            nace su key. Se puede cambiar después, pero hay que reconectar los repos.
          </p>
        </div>
        {role === 'qa' ? (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-secondary">Repo a revisar</label>
            <select
              value={reviewRepo}
              onChange={(e) => setReviewRepo(e.target.value)}
              className="bg-surface border border-default rounded-md px-3 py-2 text-sm text-primary"
            >
              <option value="">Elegir repo…</option>
              {repos.map((repo) => (
                <option key={repo} value={repo}>
                  {repo}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-tertiary">
              Un agente QA revisa un repo. Para revisar varios hacen falta varios agentes, uno por repo.
              Sin esto no recibe revisiones: el dispatch lo elige comparando este campo contra el repo del
              issue.
            </p>
          </div>
        ) : (
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
function AgentRepoConnections({
  agent,
  repos,
  canConnect,
  missingPermissions,
  onChanged,
}: {
  agent: AgentSummary;
  repos: string[];
  canConnect: boolean;
  missingPermissions: string[];
  onChanged: () => void;
}) {
  const workspaceId = useAppStore((s) => s.activeWorkspace?.id);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [updatingRepo, setUpdatingRepo] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<ConnectRepoResult | null>(null);

  const connected = agent.connectedRepos ?? [];
  const available = repos.filter((r) => !connected.some((c) => c.repoFullName === r));
  const latestVersion = LATEST_AGENT_WORKFLOW_VERSION[agent.role === 'qa' ? 'qa' : 'dev'];

  const handleConnect = async () => {
    if (!workspaceId || !selected) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await connectAgentRepo(workspaceId, agent.id, selected));
      setSelected('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo conectar el repo.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateWorkflow = async (repoFullName: string) => {
    if (!workspaceId) return;
    setUpdatingRepo(repoFullName);
    setError('');
    setResult(null);
    try {
      // Reconectar reescribe el workflow con la plantilla más reciente y
      // reemplaza la entrada de `connectedRepos` para este repo — no crea
      // una key ni un secret nuevos por las dudas, hace exactamente lo mismo
      // que "Conectar".
      setResult(await connectAgentRepo(workspaceId, agent.id, repoFullName));
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el workflow.');
    } finally {
      setUpdatingRepo('');
    }
  };

  const handleDisconnect = async (repoFullName: string) => {
    if (!workspaceId) return;
    setBusy(true);
    setError('');
    try {
      await disconnectAgentRepo(workspaceId, agent.id, repoFullName);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desconectar el repo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 pl-3 mt-1 border-l border-default">
      {connected.length > 0 && (
        <div className="flex flex-col gap-1">
          {connected.map((c) => {
            const outdated = typeof c.workflowVersion === 'number' && c.workflowVersion < latestVersion;
            return (
              <div key={c.repoFullName} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-secondary font-mono truncate">
                  <GitBranch className="w-3 h-3 shrink-0 text-status-done" />
                  {c.repoFullName}
                  {typeof c.workflowVersion === 'number' && (
                    <span className="text-[10px] text-tertiary shrink-0">
                      · workflow v{c.workflowVersion}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  {outdated && (
                    <button
                      onClick={() => handleUpdateWorkflow(c.repoFullName)}
                      disabled={busy || updatingRepo === c.repoFullName}
                      className="text-[11px] text-priority-high hover:text-accent disabled:opacity-50"
                    >
                      {updatingRepo === c.repoFullName ? 'Actualizando…' : `Actualizar a v${latestVersion}`}
                    </button>
                  )}
                  <button
                    onClick={() => handleDisconnect(c.repoFullName)}
                    disabled={busy || updatingRepo === c.repoFullName}
                    className="text-[11px] text-tertiary hover:text-priority-urgent disabled:opacity-50"
                  >
                    Desconectar
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!canConnect ? (
        <p className="text-[11px] text-priority-high">
          A la GitHub App le faltan permisos ({missingPermissions.join(', ')}). Agregalos en la
          configuración de la App y aprobá el upgrade en la instalación para poder conectar repos
          desde acá.
        </p>
      ) : available.length === 0 ? (
        <p className="text-[11px] text-tertiary">
          {repos.length === 0
            ? 'No hay repos disponibles en la instalación de GitHub.'
            : 'Este agente ya está conectado a todos los repos disponibles.'}
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={busy}
            className="flex-1 min-w-0 bg-elevated border border-default text-primary text-xs rounded-md px-2 py-1.5 outline-none cursor-pointer truncate disabled:opacity-50"
          >
            <option value="">Conectar a un repo…</option>
            {available.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            onClick={handleConnect}
            disabled={busy || !selected}
            className="px-2.5 py-1.5 text-[11px] rounded-md bg-accent hover:bg-accent-hover text-white disabled:opacity-40 disabled:pointer-events-none transition-colors shrink-0"
          >
            {busy ? 'Conectando…' : 'Conectar'}
          </button>
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-1.5 p-2.5 bg-elevated border border-default rounded-md">
          <p className="text-[11px] text-status-done">
            ✓ {result.repoFullName} conectado
            {result.workflowCreated ? ' · workflow creado' : ' · workflow actualizado'} (v
            {result.workflowVersion}) · key de MCP provisionada
          </p>

          {result.anthropicSecretPresent ? (
            <p className="text-[11px] text-status-done">
              ✓ {result.anthropicSecretName} ya está en el repo. No queda nada por hacer.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              <p className="text-[11px] text-priority-high">
                Falta {result.anthropicSecretName}. Es tuyo y está atado a tu suscripción de Claude,
                así que Pulse no lo guarda ni lo transporta. Corré esto una vez:
              </p>
              <code className="block px-2 py-1.5 bg-surface border border-default rounded text-[11px] text-primary font-mono break-all">
                {result.manualStep}
              </code>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-[11px] text-priority-urgent">{error}</p>}
    </div>
  );
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
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [repos, setRepos] = useState<string[]>([]);
  const [canConnect, setCanConnect] = useState(false);
  const [missingPermissions, setMissingPermissions] = useState<string[]>([]);

  const workspaceId = activeWorkspace?.id;

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await listAgents(workspaceId);
      setAgents(result);

      // El estado de GitHub no es esencial para listar agentes: si falla, la
      // sección sigue sirviendo y solo se deshabilita el conectar.
      try {
        const gh = await getGithubStatus(workspaceId);
        setRepos(gh.repositories ?? []);
        setCanConnect(gh.connected && gh.canConnectRepos !== false);
        setMissingPermissions(gh.missingPermissions ?? []);
      } catch {
        setRepos([]);
        setCanConnect(false);
      }
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

  /**
   * Un agente QA sin `reviewRepo` —o con uno que no es el repo del issue— nunca
   * recibe un dispatch, y no falla nada: `qaDispatchTrigger` simplemente no lo
   * encuentra y loguea un skip que nadie mira. Por eso se edita acá y se avisa
   * abajo cuando falta.
   */
  const handleReviewRepoChange = async (agent: AgentSummary, value: string) => {
    const prevValue = agent.reviewRepo;
    setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, reviewRepo: value || undefined } : a)));
    setSavingId(agent.id);
    try {
      await updateAgent(agent.id, { reviewRepo: value });
    } catch {
      setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, reviewRepo: prevValue } : a)));
    } finally {
      setSavingId('');
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

  if (!workspaceId) return null;

  return (
    <div className="flex flex-col gap-4 p-5 bg-surface border border-default rounded-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-secondary" />
          <h3 className="text-base font-semibold text-primary">Agentes</h3>
        </div>
        <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setModalOpen(true)}>
          Crear agente
        </Button>
      </div>

      <p className="text-xs text-secondary">
        Con &quot;Autónomo&quot; activado, un agente arranca solo apenas se le asigna un issue y pasa a
        &quot;Por hacer&quot; — dispara un workflow de GitHub Actions sin que nadie tenga que abrir Claude
        Code. Un circuit breaker diario por workspace y el límite de issues concurrentes evitan que un
        loop se descontrole.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-secondary">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : loadError ? (
        <p className="text-xs text-priority-urgent">{loadError}</p>
      ) : agents.length === 0 ? (
        <p className="text-xs text-tertiary py-2">Todavía no hay agentes en este workspace.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {agents.map((agent) => (
            <div key={agent.id} className="flex flex-col px-3 py-2.5 rounded-md hover:bg-hover transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm text-primary truncate">{agent.displayName}</span>
                <span className="text-xs text-tertiary font-mono truncate">
                  {agent.kind} · {agent.defaultRepo || 'sin repo por defecto'}
                </span>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                {agent.role === 'qa' && (
                  <label className="flex items-center gap-1.5 text-xs text-secondary">
                    Repo a revisar
                    <select
                      value={agent.reviewRepo ?? ''}
                      disabled={savingId === agent.id}
                      onChange={(e) => handleReviewRepoChange(agent, e.target.value)}
                      className="bg-surface border border-default rounded-md px-2 py-1 text-primary text-xs"
                    >
                      <option value="">Sin repo</option>
                      {repos.map((repo) => (
                        <option key={repo} value={repo}>
                          {repo}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {agent.role === 'qa' && (
                  <label className="flex items-center gap-1.5 text-xs text-secondary">
                    Modo QA
                    <select
                      value={agent.qaMode ?? 'shadow'}
                      disabled={savingId === agent.id}
                      onChange={(e) => handleQaModeChange(agent, e.target.value as AgentQaMode)}
                      className="bg-surface border border-default rounded-md px-2 py-1 text-primary text-xs"
                    >
                      <option value="shadow">Sombra</option>
                      <option value="enforce">Activo</option>
                    </select>
                  </label>
                )}
                <label className="flex items-center gap-1.5 text-xs text-secondary">
                  Máx. concurrentes
                  <input
                    type="number"
                    min={1}
                    value={agent.maxConcurrentIssues}
                    disabled={savingId === agent.id}
                    onChange={(e) => handleMaxConcurrentChange(agent, parseInt(e.target.value, 10))}
                    className="w-14 bg-surface border border-default rounded-md px-2 py-1 text-primary text-xs"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-xs text-secondary cursor-pointer">
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
            </div>

            <AgentRepoConnections
              agent={agent}
              repos={repos}
              canConnect={canConnect}
              missingPermissions={missingPermissions}
              onChanged={refresh}
            />

            {agent.role === 'qa' && qaDispatchBlockers(agent).length > 0 && (
              <p className="pl-3 mt-1.5 text-[11px] text-priority-urgent">
                Este agente no va a recibir revisiones: {qaDispatchBlockers(agent).join('; ')}. El dispatch
                no falla — descarta al agente en silencio.
              </p>
            )}

            {agent.role === 'qa' && (
              <div className="pl-3 mt-1.5 border-l border-default">
                <QaCalibrationPanel agentId={agent.id} />
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
          existingIds={agents.map((a) => a.id)}
          repos={repos}
          onCreated={(agent) => setAgents((prev) => [agent, ...prev])}
        />
      )}
    </div>
  );
}
