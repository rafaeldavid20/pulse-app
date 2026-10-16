import type { RunnerSummary } from './firestore';

export function runnerReportIsCurrent(runner: RunnerSummary, now = Date.now()): boolean {
  const heartbeat = Date.parse(runner.lastHeartbeatAt ?? '');
  return !runner.revokedAt && runner.status !== 'offline' && Number.isFinite(heartbeat)
    && heartbeat <= now && now - heartbeat <= 120_000;
}

export function runnerVersionLabel(runner: RunnerSummary): string {
  return ({ current: 'En versión actual', update_available: 'Actualización disponible', unknown: 'Versión desconocida', unavailable: 'No se pudo comprobar' })[runner.updateStatus ?? 'unknown'];
}

/** All local operations explicitly select the same instance, for every shell. */
export function runnerUpdateCommands(service = true): string {
  const instance = '--home "<DIRECTORIO_ACTUAL_DEL_RUNNER>"';
  return [
    ...(service ? [`pulse-runner service stop ${instance}`] : []),
    'npm install -g @pulsehub/runner@latest',
    ...(service ? [`pulse-runner service install ${instance}`, `pulse-runner service start ${instance}`] : []),
    `pulse-runner diagnose ${instance}`,
    ...(!service ? [`pulse-runner start ${instance}`] : []),
  ].join('\n');
}
