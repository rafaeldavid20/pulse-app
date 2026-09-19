import {
  FindingSeverity,
  Issue,
  IssueReview,
  IssueReviewAttempt,
  ReviewFinding,
  ReviewPrRef,
} from '@/types';

/** Orden de severidad para agrupar findings: lo más grave primero. */
export const SEVERITY_ORDER: FindingSeverity[] = ['blocker', 'major', 'minor', 'nit'];

export const SEVERITY_LABELS: Record<FindingSeverity, string> = {
  blocker: 'Bloqueante',
  major: 'Mayor',
  minor: 'Menor',
  nit: 'Nit',
};

export function groupFindingsBySeverity(findings: ReviewFinding[]): { severity: FindingSeverity; findings: ReviewFinding[] }[] {
  return SEVERITY_ORDER
    .map((severity) => ({ severity, findings: findings.filter((f) => f.severity === severity) }))
    .filter((g) => g.findings.length > 0);
}

/**
 * Agrupa findings por repo (K9/TES-202: un issue puede tener PRs en más de un
 * repo). `undefined` significa "el único repo del issue" — no separa un grupo
 * aparte para no romper el caso mono-repo de siempre.
 */
export function groupFindingsByRepo(findings: ReviewFinding[]): { repoFullName?: string; findings: ReviewFinding[] }[] {
  const repos = Array.from(new Set(findings.map((f) => f.repoFullName)));
  // Sin repo primero (caso mono-repo / findings sin marcar), después alfabético.
  repos.sort((a, b) => {
    if (a === b) return 0;
    if (!a) return -1;
    if (!b) return 1;
    return a.localeCompare(b);
  });
  return repos.map((repoFullName) => ({
    repoFullName,
    findings: findings.filter((f) => f.repoFullName === repoFullName),
  }));
}

/**
 * Link a `file:line` en GitHub sobre el SHA exacto que vio el QA
 * (`ReviewPrRef.headSha`), no sobre la rama — así el link no se corre si el
 * dev pushea de nuevo después de este intento. Sin `file`, o sin un PR
 * registrado para el repo del finding, no hay nada que enlazar.
 */
export function findingFileUrl(finding: ReviewFinding, prs: ReviewPrRef[] | undefined): string | undefined {
  if (!finding.file) return undefined;
  const pr = prs?.find((p) => (finding.repoFullName ? p.repoFullName === finding.repoFullName : true));
  if (!pr) return undefined;
  const anchor = finding.line ? `#L${finding.line}` : '';
  return `https://github.com/${pr.repoFullName}/blob/${pr.headSha}/${finding.file}${anchor}`;
}

/** Todos los intentos de un issue, más viejo primero: el historial cerrado seguido del intento en curso (si hay uno). */
export function allAttempts(review: IssueReview): IssueReviewAttempt[] {
  return [...(review.history ?? []), review];
}

export interface FindingStatusCounts {
  open: number;
  fixed: number;
  disputed: number;
  dismissed: number;
}

export function countFindingStatuses(findings: ReviewFinding[] | undefined): FindingStatusCounts {
  const counts: FindingStatusCounts = { open: 0, fixed: 0, disputed: 0, dismissed: 0 };
  (findings ?? []).forEach((f) => {
    counts[f.status] += 1;
  });
  return counts;
}

export interface QaMetrics {
  /** Issues que pasaron por al menos un intento cerrado de revisión. */
  reviewedCount: number;
  /** % de esos issues que se aprobaron ya en el intento 1 (sin `history` previo). */
  firstAttemptApprovalRate: number | null;
  /** Promedio de intentos hasta el cierre (aprobado, cambios pedidos o necesita humano). */
  averageAttempts: number | null;
  findingsBySeverity: Record<FindingSeverity, number>;
}

/**
 * Métricas de QA de un proyecto (D7): de dónde sale si el agente dev está
 * mejorando. Se computan client-side a partir de `review`/`review.history`
 * embebidos en cada issue — no hay agregación server-side todavía, y el
 * volumen (findings acotados por `maxReviewAttempts`) no la necesita.
 */
export function computeQaMetrics(issues: Issue[]): QaMetrics {
  const findingsBySeverity: Record<FindingSeverity, number> = { blocker: 0, major: 0, minor: 0, nit: 0 };
  let reviewedCount = 0;
  let firstAttemptApprovals = 0;
  let totalAttempts = 0;

  issues.forEach((issue) => {
    const review = issue.review;
    if (!review) return;

    allAttempts(review).forEach((attempt) => {
      (attempt.findings ?? []).forEach((f) => {
        findingsBySeverity[f.severity] += 1;
      });
    });

    // Un intento "cerrado" es uno con veredicto final — pending/running todavía
    // no dicen nada sobre si el dev acertó a la primera.
    const closedStates = ['approved', 'changes_requested', 'needs_human', 'stale'];
    const isClosed = closedStates.includes(review.state);
    if (!isClosed) return;

    reviewedCount += 1;
    const attemptsUsed = (review.history?.length ?? 0) + 1;
    totalAttempts += attemptsUsed;
    if (review.state === 'approved' && attemptsUsed === 1) {
      firstAttemptApprovals += 1;
    }
  });

  return {
    reviewedCount,
    firstAttemptApprovalRate: reviewedCount > 0 ? (firstAttemptApprovals / reviewedCount) * 100 : null,
    averageAttempts: reviewedCount > 0 ? totalAttempts / reviewedCount : null,
    findingsBySeverity,
  };
}
