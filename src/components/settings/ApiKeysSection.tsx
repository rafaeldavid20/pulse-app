'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Key, Plus, Copy, Check, Trash2, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAppStore } from '@/stores/appStore';
import {
  AgentSummary,
  ApiKeySummary,
  CreatedApiKey,
  createApiKey,
  listAgents,
  listApiKeys,
  revokeApiKey,
} from '@/lib/firestore';

const MCP_URL = 'https://us-east4-pulse-app-93.cloudfunctions.net/pulseMcp';

function formatDate(iso: string | null): string {
  if (!iso) return 'Nunca';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 p-1.5 rounded-md text-secondary hover:text-primary hover:bg-hover transition-colors"
      title="Copiar"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function CreateKeyModal({
  isOpen,
  onClose,
  workspaceId,
  agents,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  agents: AgentSummary[];
  onCreated: (key: ApiKeySummary) => void;
}) {
  const [name, setName] = useState('');
  const [agentId, setAgentId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);

  const reset = useCallback(() => {
    setName('');
    setAgentId('');
    setSubmitting(false);
    setError(null);
    setCreated(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const key = await createApiKey(workspaceId, name.trim(), agentId || null);
      setCreated(key);
      onCreated({
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        scopes: key.scopes,
        agentId: agentId || null,
        createdAt: key.createdAt,
        lastUsedAt: null,
        revokedAt: null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la clave.');
    } finally {
      setSubmitting(false);
    }
  };

  const mcpAddCommand = created
    ? `claude mcp add --transport http pulse ${MCP_URL} --header "Authorization: Bearer ${created.fullKey}"`
    : '';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={created ? 'Clave creada' : 'Nueva clave de API'} maxWidth="lg">
      {!created ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-secondary">Nombre</label>
            <Input
              autoFocus
              placeholder="Ej: Claude Code (laptop)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-secondary">Vincular a un agente (opcional)</label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="bg-surface border border-default rounded-md px-3 py-2 text-sm text-primary"
            >
              <option value="">Ninguno — clave personal</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.displayName}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-tertiary pt-1">
              Una clave vinculada a un agente actúa como ese agente (asigna, comenta y reclama issues
              en su nombre) en vez de como tu usuario — necesario para el disparo autónomo.
            </p>
          </div>
          {error && <p className="text-xs text-priority-urgent">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={!name.trim() || submitting}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Crear clave'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-secondary">
            Copiá esta clave ahora — no vas a poder volver a verla. Si la perdés, tenés que crear una nueva.
          </p>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-secondary">Clave completa</label>
            <div className="flex items-center gap-2 bg-surface border border-default rounded-md px-3 py-2">
              <code className="flex-1 text-xs text-primary break-all font-mono">{created.fullKey}</code>
              <CopyButton text={created.fullKey} />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-secondary">Conectar con Claude Code</label>
            <div className="flex items-center gap-2 bg-surface border border-default rounded-md px-3 py-2">
              <code className="flex-1 text-xs text-secondary break-all font-mono">{mcpAddCommand}</code>
              <CopyButton text={mcpAddCommand} />
            </div>
            <p className="text-[11px] text-tertiary pt-1">
              Si tu versión de la CLI no soporta ese flag, usá un{' '}
              <code className="text-secondary">.mcp.json</code> con:{' '}
              <code className="text-secondary break-all">
                {`{"mcpServers":{"pulse":{"type":"http","url":"${MCP_URL}","headers":{"Authorization":"Bearer ${created.fullKey}"}}}}`}
              </code>
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={handleClose}>
              Listo
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function ApiKeysSection() {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const workspaceId = activeWorkspace?.id;

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [result, agentResult] = await Promise.all([listApiKeys(workspaceId), listAgents(workspaceId)]);
      setKeys(result);
      setAgents(agentResult);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Error al cargar las claves.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, not a render loop
    refresh();
  }, [refresh]);

  const handleRevoke = async (key: ApiKeySummary) => {
    if (!window.confirm(`¿Revocar la clave "${key.name}"? Esta acción no se puede deshacer.`)) return;
    setRevokingId(key.id);
    try {
      await revokeApiKey(key.id);
      setKeys((prev) => prev.map((k) => (k.id === key.id ? { ...k, revokedAt: new Date().toISOString() } : k)));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al revocar la clave.');
    } finally {
      setRevokingId(null);
    }
  };

  if (!workspaceId) return null;

  return (
    <div className="flex flex-col gap-4 p-5 bg-surface border border-default rounded-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-secondary" />
          <h3 className="text-base font-semibold text-primary">Claves de API (MCP)</h3>
        </div>
        <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setModalOpen(true)}>
          Crear clave
        </Button>
      </div>

      <p className="text-xs text-secondary">
        Usá una clave para conectar Claude Code (u otro cliente MCP) a este workspace y darle acceso a
        tus issues y proyectos.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-secondary">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : loadError ? (
        <p className="text-xs text-priority-urgent">{loadError}</p>
      ) : keys.length === 0 ? (
        <p className="text-xs text-tertiary py-2">Todavía no creaste ninguna clave.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {keys.map((key) => {
            const revoked = !!key.revokedAt;
            const linkedAgent = key.agentId ? agents.find((a) => a.id === key.agentId) : null;
            return (
              <div
                key={key.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-hover transition-colors"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-primary truncate">{key.name}</span>
                    {key.agentId && (
                      <span
                        className="text-[10px] uppercase tracking-wide font-semibold text-secondary bg-hover px-1.5 py-0.5 rounded"
                        title={`Actúa como el agente '${key.agentId}'`}
                      >
                        {linkedAgent?.displayName ?? key.agentId}
                      </span>
                    )}
                    {revoked && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-priority-urgent bg-priority-urgent/10 px-1.5 py-0.5 rounded">
                        Revocada
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-tertiary font-mono truncate">
                    {key.prefix}··· · último uso: {formatDate(key.lastUsedAt)} · creada: {formatDate(key.createdAt)}
                  </span>
                </div>
                {!revoked && (
                  <button
                    onClick={() => handleRevoke(key)}
                    disabled={revokingId === key.id}
                    className="shrink-0 p-1.5 rounded-md text-secondary hover:text-priority-urgent hover:bg-priority-urgent/10 transition-colors disabled:opacity-50"
                    title="Revocar"
                  >
                    {revokingId === key.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CreateKeyModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        workspaceId={workspaceId}
        agents={agents}
        onCreated={(key) => setKeys((prev) => [key, ...prev])}
      />
    </div>
  );
}
