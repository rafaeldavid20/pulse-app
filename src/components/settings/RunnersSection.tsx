'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Cpu, Loader2, RotateCw, ShieldOff } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAppStore } from '@/stores/appStore';
import { cn, formatTimeAgo } from '@/lib/utils';
import { listRunners, revokeRunner, rotateRunnerCredential, RunnerSummary } from '@/lib/firestore';

const statusLabel: Record<RunnerSummary['status'], string> = {
  online: 'En línea',
  busy: 'Ocupado',
  paused: 'Pausado',
  offline: 'Sin conexión',
};

const statusClass: Record<RunnerSummary['status'], string> = {
  online: 'bg-emerald-500',
  busy: 'bg-amber-500',
  paused: 'bg-slate-400',
  offline: 'bg-zinc-400',
};

export function RunnersSection() {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const members = useAppStore((s) => s.members);
  const [runners, setRunners] = useState<RunnerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [credential, setCredential] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const workspaceId = activeWorkspace?.id;

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      setRunners(await listRunners(workspaceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los Runners.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, not a render loop
    refresh();
  }, [refresh]);

  const ownerName = (ownerMemberId: string) => members.find((member) => member.userId === ownerMemberId)?.displayName || ownerMemberId;

  const handleRevoke = async (runner: RunnerSummary) => {
    if (!window.confirm(`¿Revocar ${runner.displayName}? El Runner dejará de recibir jobs inmediatamente.`)) return;
    setWorkingId(runner.id);
    setError(null);
    try {
      await revokeRunner(runner.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo revocar el Runner.');
    } finally {
      setWorkingId(null);
    }
  };

  const handleRotate = async (runner: RunnerSummary) => {
    if (!window.confirm(`¿Rotar la credencial de ${runner.displayName}? El proceso local tendrá que vincularse de nuevo.`)) return;
    setWorkingId(runner.id);
    setError(null);
    try {
      const result = await rotateRunnerCredential(runner.id);
      setCredential(result.deviceCredential);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo rotar la credencial.');
    } finally {
      setWorkingId(null);
    }
  };

  const copyCredential = async () => {
    if (!credential) return;
    await navigator.clipboard.writeText(credential);
    setCopied(true);
  };

  if (!workspaceId) return null;

  return (
    <section className="flex flex-col gap-4 p-5 bg-surface border border-default rounded-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-secondary" />
          <h3 className="text-base font-semibold text-primary">Pulse Runners</h3>
        </div>
        <Button size="sm" variant="secondary" onClick={refresh} disabled={loading} icon={<RotateCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />}>
          Actualizar
        </Button>
      </div>
      <p className="text-xs text-secondary">
        Un Runner es la máquina que mantiene tus sesiones de Claude o Codex de forma local. Pulse nunca guarda esas credenciales.
      </p>

      {loading ? (
        <div className="flex flex-col gap-2">
          <div className="h-16 rounded-lg bg-elevated animate-pulse" />
          <div className="h-16 rounded-lg bg-elevated animate-pulse" />
        </div>
      ) : error ? (
        <p className="text-xs text-priority-urgent">{error}</p>
      ) : runners.length === 0 ? (
        <div className="py-5 text-center border border-dashed border-default rounded-lg">
          <p className="text-sm font-medium text-primary">Todavía no hay Runners vinculados</p>
          <p className="mt-1 text-xs text-tertiary">El instalador local va a generar el pairing desde esta sección.</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-subtle border border-default rounded-lg overflow-hidden">
          {runners.map((runner) => (
            <div key={runner.id} className="flex flex-col gap-3 p-4 bg-elevated sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-primary">{runner.displayName}</span>
                  <Badge variant="outline"><span className={cn('w-1.5 h-1.5 rounded-full', statusClass[runner.status])} />{statusLabel[runner.status]}</Badge>
                  {runner.revokedAt && <Badge variant="outline">Revocado</Badge>}
                </div>
                <p className="mt-1 text-xs text-secondary">
                  Dueño: {ownerName(runner.ownerMemberId)} · Capacidad: {runner.maxConcurrentJobs} job{runner.maxConcurrentJobs === 1 ? '' : 's'}
                </p>
                <p className="mt-1 text-[11px] text-tertiary truncate" title={runner.connectedRepos.join(', ')}>
                  {runner.lastHeartbeatAt ? `Último heartbeat ${formatTimeAgo(runner.lastHeartbeatAt)}` : 'Sin heartbeat todavía'} · {runner.connectedRepos.length ? runner.connectedRepos.join(', ') : 'Sin repos configurados'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="secondary" disabled={workingId === runner.id} onClick={() => handleRotate(runner)} icon={workingId === runner.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}>
                  Rotar
                </Button>
                <Button size="sm" variant="danger" disabled={workingId === runner.id || !!runner.revokedAt} onClick={() => handleRevoke(runner)} icon={<ShieldOff className="w-3.5 h-3.5" />}>
                  Revocar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={!!credential} onClose={() => { setCredential(null); setCopied(false); }} title="Nueva credencial de Runner" maxWidth="lg">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-secondary">Copiala ahora. No volverá a mostrarse y reemplaza la credencial anterior.</p>
          <code className="block break-all p-3 bg-elevated border border-default rounded-lg text-xs text-primary">{credential}</code>
          <div className="flex justify-end">
            <Button onClick={copyCredential} icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}>{copied ? 'Copiada' : 'Copiar credencial'}</Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
