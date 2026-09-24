'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Cpu, Loader2, RotateCw, ShieldOff, History, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useAppStore } from '@/stores/appStore';
import { cn, formatTimeAgo } from '@/lib/utils';
import { listRunnerJobs, listRunners, registerRunner, revokeRunner, retryRunnerJob, rotateRunnerCredential, RunnerJobSummary, RunnerSummary } from '@/lib/firestore';

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

const jobStatusLabel: Record<RunnerJobSummary['status'], string> = {
  pending: 'En cola', delivered: 'Entregado', completed: 'Completado', failed: 'Falló', canceled: 'Cancelado', expired: 'Expiró',
};

const jobStatusClass: Record<RunnerJobSummary['status'], string> = {
  pending: 'text-amber-700 bg-amber-50 border-amber-200', delivered: 'text-blue-700 bg-blue-50 border-blue-200',
  completed: 'text-emerald-700 bg-emerald-50 border-emerald-200', failed: 'text-red-700 bg-red-50 border-red-200',
  canceled: 'text-slate-600 bg-slate-50 border-slate-200', expired: 'text-orange-700 bg-orange-50 border-orange-200',
};

export function RunnersSection() {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const members = useAppStore((s) => s.members);
  const [runners, setRunners] = useState<RunnerSummary[]>([]);
  const [jobs, setJobs] = useState<RunnerJobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [credential, setCredential] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [runnerName, setRunnerName] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [pairingBusy, setPairingBusy] = useState(false);
  const workspaceId = activeWorkspace?.id;

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const [nextRunners, nextJobs] = await Promise.all([listRunners(workspaceId), listRunnerJobs(workspaceId)]);
      setRunners(nextRunners);
      setJobs(nextJobs);
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
  const handleRetry = async (job: RunnerJobSummary) => {
    if (!window.confirm(`¿Reintentar el job de ${job.repoFullName}? Se emitirá un nuevo job con el mismo issue, agente, Runner y repo.`)) return;
    setWorkingId(job.id); setError(null);
    try { await retryRunnerJob(job.id); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo reintentar el job.'); }
    finally { setWorkingId(null); }
  };
  const handlePair = async (event: React.FormEvent) => {
    event.preventDefault();
    setPairingBusy(true); setError(null);
    try {
      const result = await registerRunner(workspaceId!, { displayName: runnerName, publicKey, connectedRepos: [] });
      setCredential(result.deviceCredential); setPairing(false); setRunnerName(''); setPublicKey(''); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo vincular el Runner.'); }
    finally { setPairingBusy(false); }
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
      <Button size="sm" className="self-start" onClick={() => setPairing(true)}>Vincular Runner</Button>

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

      {!loading && jobs.length > 0 && (
        <div className="border border-default rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-elevated border-b border-default">
            <History className="w-3.5 h-3.5 text-secondary" />
            <h4 className="text-sm font-medium text-primary">Actividad reciente</h4>
            <span className="text-xs text-tertiary">Jobs visibles para tus Runners</span>
          </div>
          <div className="divide-y divide-subtle">
            {jobs.slice(0, 12).map((job) => {
              const retryable = ['failed', 'canceled', 'expired'].includes(job.status) && !job.retriedByJobId;
              const runner = runners.find((item) => item.id === job.runnerId);
              return (
                <div key={job.id} className="flex flex-col gap-2 px-4 py-3 bg-surface sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-primary truncate">{job.repoFullName}</span>
                      <span className={cn('px-1.5 py-0.5 text-[10px] font-medium border rounded-full', jobStatusClass[job.status])}>{jobStatusLabel[job.status]}</span>
                      <span className="text-[11px] text-tertiary">{job.mode} · {formatTimeAgo(job.issuedAt)}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-tertiary truncate" title={job.issueId}>
                      Issue {job.issueId} · {runner?.displayName || job.runnerId}{job.retryOf ? ' · reintento' : ''}{job.retriedByJobId ? ' · reintentado' : ''}
                    </p>
                    {job.result && <p className="mt-1 text-[11px] text-secondary truncate" title={job.result}>{job.result}</p>}
                  </div>
                  {retryable && <Button size="sm" variant="secondary" disabled={workingId === job.id} onClick={() => handleRetry(job)} icon={workingId === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}>Reintentar</Button>}
                </div>
              );
            })}
          </div>
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
      <Modal isOpen={pairing} onClose={() => setPairing(false)} title="Vincular Pulse Runner" maxWidth="lg">
        <form onSubmit={handlePair} className="flex flex-col gap-4">
          <p className="text-sm text-secondary">Pegá la clave pública que muestra el instalador local. Pulse devuelve una credencial de dispositivo una sola vez.</p>
          <Input required placeholder="Nombre, ej. Mac de Ana" value={runnerName} onChange={(event) => setRunnerName(event.target.value)} />
          <textarea required placeholder="Clave pública del Runner" value={publicKey} onChange={(event) => setPublicKey(event.target.value)} className="min-h-28 bg-elevated border border-default rounded-md p-3 text-xs text-primary" />
          <div className="flex justify-end"><Button disabled={pairingBusy}>{pairingBusy ? 'Vinculando…' : 'Vincular'}</Button></div>
        </form>
      </Modal>
    </section>
  );
}
