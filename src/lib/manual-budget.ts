const labels: Record<string, string> = {
  'issue-run-limit': 'el límite de ejecuciones de esta incidencia',
  'issue-cost-cap': 'el límite de costo de esta incidencia',
  'daily-dispatch-limit': 'el límite diario de ejecuciones del workspace',
  'daily-cost-cap': 'el límite diario de costo del workspace',
};

export function budgetReason(message?: string): { code: string; description: string } | null {
  const match = message?.match(/PULSE_BUDGET:([a-z-]+):([\d.]+)?/);
  if (!match || !labels[match[1]]) return null;
  const value = match[2] ? ` (${match[2]}${match[1].includes('cost') ? ' USD' : ''})` : '';
  return { code: match[1], description: `${labels[match[1]]}${value}` };
}

/** The server rechecks each limit and the caller consents separately to each one. */
export async function withBudgetConfirmation<T>(request: (exceptions: string[]) => Promise<T>, initial?: string): Promise<T | undefined> {
  const exceptions: string[] = [];
  let pending = budgetReason(initial);
  for (;;) {
    if (pending) {
      if (exceptions.includes(pending.code)) throw new Error('El límite cambió durante la solicitud. Volvé a intentarlo.');
      if (!window.confirm(`Se alcanzó ${pending.description}. ¿Autorizar una sola ejecución adicional? Puede consumir más tokens y generar costos adicionales; el monto no se conoce de antemano. Los límites automáticos siguen activos.`)) return undefined;
      exceptions.push(pending.code);
    }
    try { return await request([...exceptions]); } catch (error) {
      pending = budgetReason(error instanceof Error ? error.message : undefined);
      if (!pending) throw error;
    }
  }
}
