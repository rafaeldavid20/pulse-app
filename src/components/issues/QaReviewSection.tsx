'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  RotateCcw,
  CornerUpLeft,
  XCircle,
  Check,
  X,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { Issue, IssueReviewAttempt, ReviewFinding } from '@/types';
import { cn, formatTimeAgo } from '@/lib/utils';
import { ReviewBadge } from './ReviewBadge';
import { useWorkspaceInfra } from '@/hooks/useWorkspaceInfra';
import {
  allAttempts,
  countFindingStatuses,
  findingFileUrl,
  groupFindingsByRepo,
  groupFindingsBySeverity,
  SEVERITY_LABELS,
} from '@/lib/review';
import { overrideReview, dismissFinding, rerunReview, returnReviewToAgent } from '@/lib/firestore';

const FINDING_STATUS_LABELS: Record<ReviewFinding['status'], string> = {
  open: 'Abierto',
  fixed: 'Resuelto',
  disputed: 'En disputa',
  dismissed: 'Descartado',
};

const FINDING_STATUS_STYLES: Record<ReviewFinding['status'], string> = {
  open: 'text-priority-high bg-priority-high/10',
  fixed: 'text-status-done bg-status-done/10',
  disputed: 'text-priority-urgent bg-priority-urgent/10',
  dismissed: 'text-tertiary bg-hover',
};

const CRITERION_RESULT_STYLES: Record<'pass' | 'fail' | 'unverifiable', string> = {
  pass: 'text-status-done bg-status-done/10',
  fail: 'text-priority-urgent bg-priority-urgent/10',
  unverifiable: 'text-tertiary bg-hover',
};

const CRITERION_RESULT_LABELS: Record<'pass' | 'fail' | 'unverifiable', string> = {
  pass: 'Pasa',
  fail: 'Falla',
  unverifiable: 'No verificable',
};

function FindingRow({
  finding,
  fileUrl,
  onDismiss,
  dismissing,
}: {
  finding: ReviewFinding;
  fileUrl?: string;
  onDismiss: (note: string) => void;
  dismissing: boolean;
}) {
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [note, setNote] = useState('');

  return (
    <div className="flex flex-col gap-1.5 p-2.5 bg-elevated border border-default rounded-lg text-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="text-primary flex-1 min-w-0">{finding.message}</p>
        <span
          className={cn(
            'shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide',
            FINDING_STATUS_STYLES[finding.status]
          )}
        >
          {FINDING_STATUS_LABELS[finding.status]}
        </span>
      </div>

      {finding.file && (
        fileUrl ? (
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-tertiary hover:text-accent font-mono text-[11px] w-fit"
          >
            {finding.file}
            {finding.line ? `:${finding.line}` : ''}
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        ) : (
          <span className="font-mono text-[11px] text-tertiary">
            {finding.file}
            {finding.line ? `:${finding.line}` : ''}
          </span>
        )
      )}

      {finding.resolutionNote && (
        <p className="text-[11px] text-secondary italic">“{finding.resolutionNote}”</p>
      )}

      {finding.status === 'open' && (
        <div className="pt-1">
          {showNoteForm ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Motivo del descarte (opcional)…"
                className="flex-1 min-w-0 bg-surface border border-default rounded-md px-2 py-1 text-[11px] text-primary placeholder-tertiary outline-none"
              />
              <button
                type="button"
                disabled={dismissing}
                onClick={() => onDismiss(note)}
                className="p-1 rounded bg-accent hover:bg-accent-hover text-white disabled:opacity-50 transition-colors"
                aria-label="Confirmar descarte"
              >
                {dismissing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={() => setShowNoteForm(false)}
                className="p-1 rounded text-tertiary hover:text-primary hover:bg-hover transition-colors"
                aria-label="Cancelar"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowNoteForm(true)}
              className="inline-flex items-center gap-1 text-[11px] text-tertiary hover:text-priority-urgent font-medium transition-colors"
            >
              <XCircle className="w-3 h-3" />
              Descartar finding
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AttemptTimelineRow({ attempt, isLast }: { attempt: IssueReviewAttempt; isLast: boolean }) {
  const counts = countFindingStatuses(attempt.findings);
  const total = attempt.findings?.length ?? 0;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center shrink-0">
        <span className="w-2 h-2 rounded-full bg-accent mt-1" />
        {!isLast && <span className="flex-1 w-px bg-default" />}
      </div>
      <div className="flex flex-col gap-1 pb-3 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-primary">Intento {attempt.attempt}</span>
          <ReviewBadge state={attempt.state} />
          {attempt.completedAt && (
            <span className="text-[10px] text-tertiary">{formatTimeAgo(attempt.completedAt)}</span>
          )}
        </div>
        {attempt.verdict && <p className="text-[11px] text-secondary">{attempt.verdict}</p>}
        {total > 0 && (
          <p className="text-[11px] text-tertiary">
            {counts.fixed > 0 && `${counts.fixed} resuelto${counts.fixed === 1 ? '' : 's'} · `}
            {counts.disputed > 0 && `${counts.disputed} en disputa · `}
            {counts.dismissed > 0 && `${counts.dismissed} descartado${counts.dismissed === 1 ? '' : 's'} · `}
            {counts.open > 0 && `${counts.open} abierto${counts.open === 1 ? '' : 's'}`}
          </p>
        )}
        {attempt.overriddenBy && (
          <p className="text-[11px] text-priority-low">
            Override humano{attempt.overrideReason ? `: ${attempt.overrideReason}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * "Revisión de QA" (D7): veredicto, findings, checklist de criterios e
 * historial de intentos del `review` en curso, más las acciones humanas sobre
 * ese intento. Solo se monta si `issue.review` existe — antes de que el issue
 * entre al loop de revisión (D3) no hay nada que mostrar acá.
 */
export function QaReviewSection({ issue }: { issue: Issue }) {
  const review = issue.review!;
  const { agents } = useWorkspaceInfra();
  const reviewerAgent = agents.find((a) => a.id === review.reviewerId || a.id === review.dispatchedTo);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnComment, setReturnComment] = useState('');

  const criteria = issue.acceptanceCriteria ?? [];
  const criterionText = (id: string) => criteria.find((c) => c.id === id)?.text ?? `Criterio ${id}`;

  const findings = review.findings ?? [];
  const byRepo = groupFindingsByRepo(findings);
  const multiRepo = byRepo.length > 1;
  const attempts = allAttempts(review);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La acción no se pudo completar.');
    } finally {
      setBusy(null);
    }
  };

  const handleOverride = () =>
    run('override', async () => {
      await overrideReview(issue.id, 'approved', overrideReason.trim() || undefined);
      setShowOverrideForm(false);
      setOverrideReason('');
    });

  const handleRerun = () => run('rerun', () => rerunReview(issue.id));

  const handleReturn = () =>
    run('return', async () => {
      if (!returnComment.trim()) return;
      await returnReviewToAgent(issue.id, returnComment.trim());
      setShowReturnForm(false);
      setReturnComment('');
    });

  const handleDismiss = (findingId: string, note: string) =>
    run(`dismiss:${findingId}`, () => dismissFinding(issue.id, findingId, note.trim() || undefined));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-secondary uppercase tracking-wider">
          Revisión de QA
        </label>
        <ReviewBadge state={review.state} />
      </div>

      <div className="flex flex-col gap-2 p-3 bg-elevated border border-default rounded-lg text-xs">
        <div className="flex items-center justify-between flex-wrap gap-1.5">
          <span className="text-secondary">
            Intento <span className="text-primary font-semibold">{review.attempt}</span>
            {reviewerAgent?.maxReviewAttempts ? ` de ${reviewerAgent.maxReviewAttempts}` : ''}
          </span>
          <span className="text-[11px] text-tertiary">
            {review.startedAt && `Empezó ${formatTimeAgo(review.startedAt)}`}
            {review.completedAt && ` · Cerró ${formatTimeAgo(review.completedAt)}`}
          </span>
        </div>

        {review.verdict && <p className="text-secondary">{review.verdict}</p>}

        {review.overriddenBy && (
          <p className="text-priority-low text-[11px]">
            Override humano: {review.state === 'approved' ? 'aprobado' : 'cambios pedidos'} manualmente
            {review.overrideReason ? ` — ${review.overrideReason}` : ''}
          </p>
        )}
      </div>

      {/* Resultado por criterio: más legible que la lista de findings sola. */}
      {review.criteriaResults && review.criteriaResults.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-secondary uppercase tracking-wide">
            Resultado por criterio
          </span>
          {review.criteriaResults.map((cr) => (
            <div
              key={cr.criterionId}
              className="flex items-start justify-between gap-2 p-2 bg-elevated border border-default rounded-lg text-xs"
            >
              <span className="text-primary flex-1 min-w-0">{criterionText(cr.criterionId)}</span>
              <span
                className={cn(
                  'shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide',
                  CRITERION_RESULT_STYLES[cr.result]
                )}
              >
                {CRITERION_RESULT_LABELS[cr.result]}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Findings, agrupados por repo (multi-repo) y por severidad. */}
      {findings.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <span className="text-[11px] font-semibold text-secondary uppercase tracking-wide">
            Findings ({findings.length})
          </span>
          {byRepo.map((repoGroup) => (
            <div key={repoGroup.repoFullName ?? '__single__'} className="flex flex-col gap-2">
              {multiRepo && (
                <span className="font-mono text-[10px] text-tertiary">
                  {repoGroup.repoFullName ?? issue.git?.repoFullName ?? 'repo sin identificar'}
                </span>
              )}
              {groupFindingsBySeverity(repoGroup.findings).map((sevGroup) => (
                <div key={sevGroup.severity} className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-tertiary uppercase tracking-wide">
                    {SEVERITY_LABELS[sevGroup.severity]} ({sevGroup.findings.length})
                  </span>
                  {sevGroup.findings.map((f) => (
                    <FindingRow
                      key={f.id}
                      finding={f}
                      fileUrl={findingFileUrl(f, review.prs)}
                      dismissing={busy === `dismiss:${f.id}`}
                      onDismiss={(note) => handleDismiss(f.id, note)}
                    />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Acciones humanas sobre el intento en curso. */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => setShowOverrideForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-hover hover:bg-active text-primary border border-default rounded-md disabled:opacity-40 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Aprobar igual
          </button>

          <button
            type="button"
            disabled={busy !== null}
            onClick={handleRerun}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-hover hover:bg-active text-primary border border-default rounded-md disabled:opacity-40 transition-colors"
          >
            {busy === 'rerun' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
            Re-ejecutar QA
          </button>

          {review.state === 'needs_human' && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setShowReturnForm((v) => !v)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-hover hover:bg-active text-primary border border-default rounded-md disabled:opacity-40 transition-colors"
            >
              <CornerUpLeft className="w-3.5 h-3.5" />
              Devolver al agente
            </button>
          )}
        </div>

        {showOverrideForm && (
          <div className="flex items-center gap-2 p-2.5 bg-elevated border border-default rounded-lg">
            <input
              type="text"
              autoFocus
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Motivo del override (opcional)…"
              className="flex-1 min-w-0 bg-surface border border-default rounded-md px-2 py-1.5 text-xs text-primary placeholder-tertiary outline-none"
            />
            <button
              type="button"
              disabled={busy !== null}
              onClick={handleOverride}
              className="px-2.5 py-1.5 text-[11px] font-semibold rounded-md bg-status-done/15 text-status-done hover:bg-status-done/25 disabled:opacity-50 transition-colors shrink-0"
            >
              Confirmar aprobación
            </button>
          </div>
        )}

        {showReturnForm && (
          <div className="flex items-center gap-2 p-2.5 bg-elevated border border-default rounded-lg">
            <input
              type="text"
              autoFocus
              value={returnComment}
              onChange={(e) => setReturnComment(e.target.value)}
              placeholder="Comentario para el agente (obligatorio)…"
              className="flex-1 min-w-0 bg-surface border border-default rounded-md px-2 py-1.5 text-xs text-primary placeholder-tertiary outline-none"
            />
            <button
              type="button"
              disabled={busy !== null || !returnComment.trim()}
              onClick={handleReturn}
              className="px-2.5 py-1.5 text-[11px] font-semibold rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors shrink-0"
            >
              Devolver
            </button>
          </div>
        )}

        {error && <p className="text-xs text-priority-urgent">{error}</p>}
      </div>

      {/* Historial de intentos: 1 → rechazo → re-trabajo → 2, con el resultado de cada finding. */}
      {attempts.length > 1 && (
        <div className="flex flex-col gap-1 pt-1">
          <span className="text-[11px] font-semibold text-secondary uppercase tracking-wide mb-1">
            Historial de intentos
          </span>
          {attempts.map((a, i) => (
            <AttemptTimelineRow key={`${a.attempt}-${i}`} attempt={a} isLast={i === attempts.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}
