'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import { Issue } from '@/types';
import { callPlatformAction } from '@/lib/firestore';
import { subscribeControlSignal } from '@/lib/control-signals';
import { visibleSignalRefresh } from '@/lib/visible-signal';
import { developmentPresentation, DevelopmentStatus } from '@/lib/development-status';
import { budgetReason, withBudgetConfirmation } from '@/lib/manual-budget';

/** Server receipts and live jobs survive navigation; claims are never treated as liveness. */
export function DevelopmentSection({ issue }: { issue: Issue }) {
  const [status, setStatus] = useState<DevelopmentStatus | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const refresh = useCallback(async () => {
    const next = await callPlatformAction<DevelopmentStatus>('issues.developmentStatus', { issueId: issue.id });
    if (!next) throw new Error('No se pudo verificar el estado de desarrollo.');
    setStatus(next);
  }, [issue.id]);
  useEffect(() => {
    let disposed = false;
    const load = async () => {
      try {
        const next = await callPlatformAction<DevelopmentStatus>('issues.developmentStatus', { issueId: issue.id });
        if (!disposed && next) setStatus(next);
      } catch (err) {
        if (!disposed) setError(err instanceof Error ? err.message : 'No se pudo verificar el estado.');
      }
    };
    const subscription = visibleSignalRefresh(
      (changed, failed) => subscribeControlSignal('issue', issue.id, changed, failed),
      load,
      () => { if (!disposed) setError('Se perdió la conexión. Volvé a abrir el issue para actualizar su estado.'); },
    );
    return () => { disposed = true; subscription.stop(); };
  }, [issue.id, issue.status, issue.execution?.agentId, issue.review?.state, issue.agent?.state]);

  const submit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      // Keep an unacknowledged request across reloads and uncertain network failures.
      const key = `pulse:development:${issue.id}`;
      const requestId = localStorage.getItem(key) || crypto.randomUUID();
      localStorage.setItem(key, requestId);
      const receipt = await withBudgetConfirmation(exceptions => callPlatformAction<{ jobId: string }>('issues.requestDevelopment', { issueId: issue.id, requestId, budgetExceptions: exceptions, ...(comment.trim() ? { comment: comment.trim() } : {}) }), status?.reason);
      if (receipt === undefined) return;
      if (!receipt?.jobId) throw new Error('No se recibió confirmación del servidor. Reintentá para consultar la misma solicitud.');
      localStorage.removeItem(key);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo solicitar desarrollo.');
      try { await refresh(); } catch { /* Preserve the request error until the next reconciliation. */ }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const view = developmentPresentation(status, busy, issue.review?.state === 'changes_requested');
  const limit = budgetReason(status?.reason);
  return (
    <section aria-label="Desarrollo" className="flex flex-col gap-2 p-3 bg-elevated border border-default rounded-lg">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-secondary uppercase tracking-wider">Desarrollo</span>
        <button type="button" disabled={limit ? busy || !!status?.active : view.disabled} onClick={() => void submit()} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-hover hover:bg-active text-primary border border-default rounded-md disabled:opacity-40">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {limit && !busy ? 'Autorizar una ejecución' : view.label}
        </button>
      </div>
      <p role="status" className="text-xs text-secondary">{view.stateText}</p>
      {issue.manualBudgetHold && <p className="text-xs text-secondary">Una ejecución superó un límite: las siguientes ejecuciones de esta incidencia requieren una solicitud manual.</p>}
      {status?.reason && <p className="text-xs text-secondary">{limit ? `Se alcanzó ${limit.description}.` : status.reason}</p>}
      {error && <p role="alert" className="text-xs text-priority-urgent">{error}</p>}
      {issue.review?.state === 'changes_requested' && !status?.active && <label className="flex flex-col gap-1 text-xs text-secondary">
        Indicaciones adicionales (opcional)
        <textarea value={comment} onChange={event => setComment(event.target.value)} maxLength={4000} rows={2} disabled={busy} className="w-full bg-surface border border-default rounded-md px-2 py-1.5 text-xs text-primary outline-none" />
      </label>}
      {issue.review?.state === 'changes_requested' && <p className="text-xs text-secondary">Durante la corrección se conserva el ejecutor; se continúan los mismos PRs con los findings e historial de QA.</p>}
      <a href="/settings/agentes" className="text-xs text-accent hover:underline">Ver diagnóstico de jobs, Runner y límites</a>
      {status?.jobId && <code className="text-[10px] text-tertiary">{status.jobId}</code>}
    </section>
  );
}
