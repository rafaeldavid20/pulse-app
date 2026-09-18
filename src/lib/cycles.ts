import { Cycle, Issue, isCompletedStatus } from '@/types';

/**
 * Ciclo activo de un equipo — el equivalente a `cycle = currentCycle()` que
 * la descripción de TES-155 pide en PQL. Solo puede haber uno por equipo
 * (`cycles.close` no deja avanzar `upcoming -> active` a un segundo ciclo
 * sin cerrar el anterior), así que alcanza con filtrar por status.
 */
export function currentCycle(cycles: Cycle[], teamId: string): Cycle | undefined {
  return cycles.find((c) => c.teamId === teamId && c.status === 'active');
}

export function upcomingCycles(cycles: Cycle[], teamId: string): Cycle[] {
  return cycles
    .filter((c) => c.teamId === teamId && c.status === 'upcoming')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function pastCycles(cycles: Cycle[], teamId: string): Cycle[] {
  return cycles
    .filter((c) => c.teamId === teamId && c.status === 'completed')
    .sort((a, b) => b.endsAt.localeCompare(a.endsAt));
}

/** Días restantes hasta `endsAt`, redondeados hacia arriba. Nunca negativo. */
export function daysRemaining(cycle: Pick<Cycle, 'endsAt'>, now: Date = new Date()): number {
  const ms = new Date(cycle.endsAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function totalDays(cycle: Pick<Cycle, 'startsAt' | 'endsAt'>): number {
  const ms = new Date(cycle.endsAt).getTime() - new Date(cycle.startsAt).getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export interface CyclePoints {
  scope: number;
  completed: number;
}

/**
 * Puntos de un ciclo *en vivo* (todavía no pasó por `cycles.close`). Misma
 * cuenta que usa el backend al cerrar (`typeof estimate === 'number' ? estimate
 * : 0`), para que el número no salte cuando el ciclo se cierre y el snapshot
 * lo reemplace.
 */
export function livePointsOf(issues: Issue[], cycleId: string): CyclePoints {
  return issues
    .filter((i) => i.cycleId === cycleId)
    .reduce<CyclePoints>(
      (acc, issue) => {
        const points = typeof issue.estimate === 'number' ? issue.estimate : 0;
        acc.scope += points;
        if (isCompletedStatus(issue.status)) acc.completed += points;
        return acc;
      },
      { scope: 0, completed: 0 }
    );
}

/** Promedio de `velocity` de los últimos `n` ciclos cerrados (más recientes primero). */
export function averageVelocity(closedCycles: Cycle[], n = 3): number {
  const withSnapshot = closedCycles.filter((c) => c.snapshot).slice(0, n);
  if (withSnapshot.length === 0) return 0;
  const sum = withSnapshot.reduce((acc, c) => acc + (c.snapshot?.velocity ?? 0), 0);
  return Math.round(sum / withSnapshot.length);
}

/**
 * Puntos del scope inicial del ciclo (snapshot tomado al activarse, E5).
 * `undefined` si el ciclo nunca pasó por ese snapshot — ciclos `upcoming`
 * todavía, o activados antes de que el backend empezara a escribirlo — para
 * que quien lo consuma pueda decidir su propio fallback en vez de confundir
 * "sin snapshot" con "snapshot en cero".
 */
export function initialScopePoints(cycle: Pick<Cycle, 'initialScope'>): number | undefined {
  if (!cycle.initialScope) return undefined;
  return Object.values(cycle.initialScope.estimates).reduce((sum, points) => sum + points, 0);
}
