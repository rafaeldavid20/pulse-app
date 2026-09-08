'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Bot, Loader2, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAppStore } from '@/stores/appStore';
import { AgentSummary, createAgent, listAgents, updateAgent } from '@/lib/firestore';

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
  const [displayName, setDisplayName] = useState('');
  const [agentId, setAgentId] = useState('');
  const [agentIdEdited, setAgentIdEdited] = useState(false);
  const [kind, setKind] = useState('claude');
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
        defaultRepo: defaultRepo.trim() || undefined,
        defaultTeamId: defaultTeamId || undefined,
        maxConcurrentIssues,
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
          <label className="text-xs font-semibold text-[#8A8F98]">Nombre</label>
          <Input
            autoFocus
            placeholder="Ej: Claude"
            value={displayName}
            onChange={(e) => handleDisplayNameChange(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[#8A8F98]">ID del agente</label>
          <Input
            placeholder="Ej: agent-claude"
            value={agentId}
            onChange={(e) => {
              setAgentId(slugify(e.target.value));
              setAgentIdEdited(true);
            }}
          />
          {idTaken && <p className="text-[11px] text-[#F75555]">Ya existe un agente con ese ID.</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[#8A8F98]">Tipo</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="bg-[#0F1012] border border-[#26292F] rounded-md px-3 py-2 text-sm text-[#F7F8F8]"
          >
            <option value="claude">Claude</option>
            <option value="chatgpt">ChatGPT</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[#8A8F98]">Repo por defecto (opcional)</label>
          <Input placeholder="Ej: owner/repo" value={defaultRepo} onChange={(e) => setDefaultRepo(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[#8A8F98]">Team por defecto (opcional)</label>
          <select
            value={defaultTeamId}
            onChange={(e) => setDefaultTeamId(e.target.value)}
            className="bg-[#0F1012] border border-[#26292F] rounded-md px-3 py-2 text-sm text-[#F7F8F8]"
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
          <label className="text-xs font-semibold text-[#8A8F98]">Máx. issues concurrentes</label>
          <Input
            type="number"
            min={1}
            value={maxConcurrentIssues}
            onChange={(e) => setMaxConcurrentIssues(Math.max(1, parseInt(e.target.value, 10) || 1))}
          />
        </div>
        {error && <p className="text-xs text-[#F75555]">{error}</p>}
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

export function AgentsSection() {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const workspaceId = activeWorkspace?.id;

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await listAgents(workspaceId);
      setAgents(result);
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
    <div className="flex flex-col gap-4 p-5 bg-[#0F1012] border border-[#26292F] rounded-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-[#8A8F98]" />
          <h3 className="text-base font-semibold text-[#F7F8F8]">Agentes</h3>
        </div>
        <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setModalOpen(true)}>
          Crear agente
        </Button>
      </div>

      <p className="text-xs text-[#8A8F98]">
        Con &quot;Autónomo&quot; activado, un agente arranca solo apenas se le asigna un issue y pasa a
        &quot;Por hacer&quot; — dispara un workflow de GitHub Actions sin que nadie tenga que abrir Claude
        Code. Un circuit breaker diario por workspace y el límite de issues concurrentes evitan que un
        loop se descontrole.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-[#8A8F98]">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : loadError ? (
        <p className="text-xs text-[#F75555]">{loadError}</p>
      ) : agents.length === 0 ? (
        <p className="text-xs text-[#5B616E] py-2">Todavía no hay agentes en este workspace.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-[#1E2024] transition-colors"
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm text-[#F7F8F8] truncate">{agent.displayName}</span>
                <span className="text-xs text-[#5B616E] font-mono truncate">
                  {agent.kind} · {agent.defaultRepo || 'sin repo por defecto'}
                </span>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <label className="flex items-center gap-1.5 text-xs text-[#8A8F98]">
                  Máx. concurrentes
                  <input
                    type="number"
                    min={1}
                    value={agent.maxConcurrentIssues}
                    disabled={savingId === agent.id}
                    onChange={(e) => handleMaxConcurrentChange(agent, parseInt(e.target.value, 10))}
                    className="w-14 bg-[#0F1012] border border-[#26292F] rounded-md px-2 py-1 text-[#F7F8F8] text-xs"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-xs text-[#8A8F98] cursor-pointer">
                  Autónomo
                  <input
                    type="checkbox"
                    checked={agent.autonomousMode}
                    disabled={savingId === agent.id}
                    onChange={() => handleToggleAutonomous(agent)}
                    className="w-3.5 h-3.5 accent-[#4C6EF5]"
                  />
                </label>
              </div>
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
          onCreated={(agent) => setAgents((prev) => [agent, ...prev])}
        />
      )}
    </div>
  );
}
