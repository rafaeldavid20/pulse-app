'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Key, Plus, Copy, Check, Trash2, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAppStore } from '@/stores/appStore';
import {
  ApiKeySummary,
  CreatedApiKey,
  createApiKey,
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
      className="shrink-0 p-1.5 rounded-md text-[#8A8F98] hover:text-[#F7F8F8] hover:bg-[#1E2024] transition-colors"
      title="Copiar"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[#4CB782]" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function CreateKeyModal({
  isOpen,
  onClose,
  workspaceId,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  onCreated: (key: ApiKeySummary) => void;
}) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);

  const reset = useCallback(() => {
    setName('');
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
      const key = await createApiKey(workspaceId, name.trim());
      setCreated(key);
      onCreated({
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        scopes: key.scopes,
        agentId: null,
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
            <label className="text-xs font-semibold text-[#8A8F98]">Nombre</label>
            <Input
              autoFocus
              placeholder="Ej: Claude Code (laptop)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {error && <p className="text-xs text-[#F75555]">{error}</p>}
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
          <p className="text-xs text-[#8A8F98]">
            Copiá esta clave ahora — no vas a poder volver a verla. Si la perdés, tenés que crear una nueva.
          </p>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#8A8F98]">Clave completa</label>
            <div className="flex items-center gap-2 bg-[#0F1012] border border-[#26292F] rounded-md px-3 py-2">
              <code className="flex-1 text-xs text-[#F7F8F8] break-all font-mono">{created.fullKey}</code>
              <CopyButton text={created.fullKey} />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#8A8F98]">Conectar con Claude Code</label>
            <div className="flex items-center gap-2 bg-[#0F1012] border border-[#26292F] rounded-md px-3 py-2">
              <code className="flex-1 text-xs text-[#8A8F98] break-all font-mono">{mcpAddCommand}</code>
              <CopyButton text={mcpAddCommand} />
            </div>
            <p className="text-[11px] text-[#5B616E] pt-1">
              Si tu versión de la CLI no soporta ese flag, usá un{' '}
              <code className="text-[#8A8F98]">.mcp.json</code> con:{' '}
              <code className="text-[#8A8F98] break-all">
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
      const result = await listApiKeys(workspaceId);
      setKeys(result);
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
    <div className="flex flex-col gap-4 p-5 bg-[#0F1012] border border-[#26292F] rounded-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-[#8A8F98]" />
          <h3 className="text-base font-semibold text-[#F7F8F8]">Claves de API (MCP)</h3>
        </div>
        <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setModalOpen(true)}>
          Crear clave
        </Button>
      </div>

      <p className="text-xs text-[#8A8F98]">
        Usá una clave para conectar Claude Code (u otro cliente MCP) a este workspace y darle acceso a
        tus issues y proyectos.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-[#8A8F98]">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : loadError ? (
        <p className="text-xs text-[#F75555]">{loadError}</p>
      ) : keys.length === 0 ? (
        <p className="text-xs text-[#5B616E] py-2">Todavía no creaste ninguna clave.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {keys.map((key) => {
            const revoked = !!key.revokedAt;
            return (
              <div
                key={key.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-[#1E2024] transition-colors"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#F7F8F8] truncate">{key.name}</span>
                    {revoked && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-[#F75555] bg-[#F75555]/10 px-1.5 py-0.5 rounded">
                        Revocada
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[#5B616E] font-mono truncate">
                    {key.prefix}··· · último uso: {formatDate(key.lastUsedAt)} · creada: {formatDate(key.createdAt)}
                  </span>
                </div>
                {!revoked && (
                  <button
                    onClick={() => handleRevoke(key)}
                    disabled={revokingId === key.id}
                    className="shrink-0 p-1.5 rounded-md text-[#8A8F98] hover:text-[#F75555] hover:bg-[#F75555]/10 transition-colors disabled:opacity-50"
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
        onCreated={(key) => setKeys((prev) => [key, ...prev])}
      />
    </div>
  );
}
