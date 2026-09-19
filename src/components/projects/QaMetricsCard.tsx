import React from 'react';
import { Issue } from '@/types';
import { computeQaMetrics, SEVERITY_LABELS, SEVERITY_ORDER } from '@/lib/review';
import { ShieldCheck } from 'lucide-react';

/**
 * Métricas de QA del proyecto (D7): el dato que dice si el agente dev está
 * mejorando. No se renderiza nada si el proyecto todavía no tuvo ningún
 * issue revisado — mostrar 0%/0 intentos sin contexto confunde más de lo que
 * informa.
 */
export function QaMetricsCard({ issues }: { issues: Issue[] }) {
  const metrics = computeQaMetrics(issues);

  if (metrics.reviewedCount === 0) return null;

  const totalFindings = SEVERITY_ORDER.reduce((sum, s) => sum + metrics.findingsBySeverity[s], 0);

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-5 bg-surface border border-default rounded-2xl">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-semibold text-primary">Calidad del QA</h3>
        <span className="text-[11px] text-tertiary">
          {metrics.reviewedCount} issue{metrics.reviewedCount === 1 ? '' : 's'} revisado{metrics.reviewedCount === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="flex flex-col gap-1 p-3 bg-elevated border border-default rounded-lg">
          <span className="text-tertiary">Aprobado al 1er intento</span>
          <span className="text-lg font-bold text-primary tabular-nums">
            {metrics.firstAttemptApprovalRate !== null ? `${Math.round(metrics.firstAttemptApprovalRate)}%` : '—'}
          </span>
        </div>

        <div className="flex flex-col gap-1 p-3 bg-elevated border border-default rounded-lg">
          <span className="text-tertiary">Intentos promedio</span>
          <span className="text-lg font-bold text-primary tabular-nums">
            {metrics.averageAttempts !== null ? metrics.averageAttempts.toFixed(1) : '—'}
          </span>
        </div>

        <div className="col-span-2 flex flex-col gap-1.5 p-3 bg-elevated border border-default rounded-lg">
          <span className="text-tertiary">Findings por severidad ({totalFindings})</span>
          <div className="flex items-center gap-3 flex-wrap">
            {SEVERITY_ORDER.map((s) => (
              <span key={s} className="text-primary font-medium">
                {SEVERITY_LABELS[s]}: <span className="tabular-nums">{metrics.findingsBySeverity[s]}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
