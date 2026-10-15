export interface DevelopmentStatus {
  state: 'idle' | 'queued' | 'running' | 'failed' | 'completed';
  active: boolean;
  available: boolean;
  mode: 'task' | 'rework';
  jobId?: string;
  reason?: string;
}

export function developmentPresentation(status: DevelopmentStatus | null, submitting: boolean, rework: boolean) {
  const label = submitting ? 'Solicitando…' : rework ? 'Corregir findings' : status?.state === 'failed' ? 'Reintentar desarrollo' : 'Ejecutar desarrollo';
  const stateText = submitting ? 'Solicitud en curso; esperando confirmación del servidor.' : !status ? 'Verificando disponibilidad…' : {
    idle: 'Sin ejecución registrada.', queued: 'En cola en el Runner.', running: 'En ejecución.',
    failed: 'La ejecución anterior falló, expiró o fue cancelada.', completed: 'La ejecución anterior terminó.',
  }[status.state];
  return { label, stateText, disabled: submitting || !status?.available || status.active };
}
