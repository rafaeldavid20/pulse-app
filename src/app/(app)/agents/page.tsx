'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bot, ExternalLink, Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { getRunnerUsage, RunnerUsageResponse, RunnerUsageRun } from '@/lib/firestore';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';

const periods = [7, 30, 90] as const;
const number = new Intl.NumberFormat('es-AR');
const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' });

function count(value: number | undefined | null): string {
  return value == null ? 'Sin datos' : number.format(value);
}

function periodBounds(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - days + 1);
  from.setUTCHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

function tokenTotal(run: RunnerUsageRun): number | null {
  return run.usage ? run.usage.inputTokens + run.usage.outputTokens : null;
}

export default function AgentUsagePage() {
  const workspaceId = useAppStore((state) => state.activeWorkspace?.id);
  const setPeekIssueId = useIssueStore((state) => state.setPeekIssueId);
  const [days, setDays] = useState<(typeof periods)[number]>(30);
  const [data, setData] = useState<RunnerUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    let canceled = false;
    const bounds = periodBounds(days);
    getRunnerUsage(workspaceId, bounds.from, bounds.to)
      .then((result) => { if (!canceled) { setData(result); setError(null); setLoading(false); } })
      .catch((reason: unknown) => {
        if (!canceled) {
          setData(null);
          setError(reason instanceof Error ? reason.message : 'No se pudo cargar el consumo.');
          setLoading(false);
        }
      });
    return () => { canceled = true; };
  }, [workspaceId, days]);

  const agents = useMemo(() => data?.agents.filter((agent) => Boolean(agent.runnerId)) ?? [], [data]);
  const runs = useMemo(() => {
    const allowed = new Map(agents.map((agent) => [agent.id, agent.runnerId]));
    return (data?.runs ?? [])
      .filter((run) => allowed.get(run.agentId) === run.runnerId && (run.provider === 'claude' || run.provider === 'codex'))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }, [data, agents]);

  const daily = useMemo(() => {
    const totals = new Map<string, number>();
    for (const run of runs) {
      const value = tokenTotal(run);
      if (value !== null) {
        const date = run.startedAt.slice(0, 10);
        totals.set(date, (totals.get(date) ?? 0) + value);
      }
    }
    const today = new Date();
    return Array.from({ length: days }, (_, index) => {
      const date = new Date(today);
      date.setUTCDate(today.getUTCDate() - days + index + 1);
      const key = date.toISOString().slice(0, 10);
      return { key, value: totals.get(key) ?? 0 };
    });
  }, [runs, days]);
  const maximum = Math.max(1, ...daily.map((day) => day.value));

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <Header title="Agentes" subtitle="Consumo de ejecuciones locales" showViewToggle={false} showSearch={false} showCreateButton={false} />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-secondary">Tokens reportados por agentes con Runner en este workspace.</p>
          <div className="flex gap-1 rounded-lg bg-surface border border-default p-1" aria-label="Período">
            {periods.map((period) => (
              <button key={period} type="button" onClick={() => { setLoading(true); setDays(period); }}
                aria-pressed={days === period}
                className={`px-3 py-1.5 text-xs rounded-md ${days === period ? 'bg-hover text-primary' : 'text-secondary hover:text-primary'}`}>
                {period} días
              </button>
            ))}
          </div>
        </div>

        {loading ? <div className="flex items-center gap-2 text-secondary text-sm py-12" role="status"><Loader2 className="w-4 h-4 animate-spin" /> Cargando consumo…</div>
          : error ? <div role="alert" className="text-sm text-priority-urgent">{error}</div>
          : agents.length === 0 ? <div className="rounded-xl border border-default bg-surface p-8 text-sm text-secondary">No hay agentes con Runner visibles en este workspace.</div>
          : <>
            <section aria-label="Resumen por agente" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {agents.map((agent) => {
                const own = runs.filter((run) => run.agentId === agent.id);
                const measured = own.filter((run) => run.usage !== null);
                const input = measured.reduce((total, run) => total + run.usage!.inputTokens, 0);
                const output = measured.reduce((total, run) => total + run.usage!.outputTokens, 0);
                const cacheRead = measured.reduce((total, run) => total + (run.usage!.cacheReadInputTokens ?? 0), 0);
                const cacheWrite = measured.reduce((total, run) => total + (run.usage!.cacheCreationInputTokens ?? 0), 0);
                const priced = own.filter((run) => run.costUsd != null);
                const provider = agent.kind === 'claude' ? 'Claude' : agent.kind === 'codex' ? 'Codex' : agent.kind;
                return <article key={agent.id} className="rounded-xl border border-default bg-surface p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2"><h2 className="font-semibold text-primary flex items-center gap-2"><Bot className="w-4 h-4 text-accent" />{agent.displayName}</h2><span className="text-xs text-tertiary">{provider}</span></div>
                  <div className="text-2xl font-semibold tabular-nums text-primary">{measured.length ? count(input + output) : 'Sin datos'} <span className="text-xs font-normal text-secondary">tokens</span></div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-secondary">
                    <span>Entrada: {measured.length ? count(input) : 'Sin datos'}</span><span>Salida: {measured.length ? count(output) : 'Sin datos'}</span>
                    <span>Caché leída: {measured.some((run) => run.usage?.cacheReadInputTokens != null) ? count(cacheRead) : 'Sin datos'}</span>
                    <span>Caché creada: {measured.some((run) => run.usage?.cacheCreationInputTokens != null) ? count(cacheWrite) : 'Sin datos'}</span>
                  </div>
                  <p className="text-xs text-tertiary">{count(own.length)} runs · Costo reportado: {priced.length ? money.format(priced.reduce((total, run) => total + run.costUsd!, 0)) : 'Sin datos'}</p>
                </article>;
              })}
            </section>

            <section className="rounded-xl border border-default bg-surface p-4" aria-label="Tendencia diaria de tokens">
              <div className="flex items-baseline justify-between gap-2 mb-3"><h2 className="text-sm font-semibold text-primary">Tendencia diaria</h2><span className="text-xs text-tertiary">Entrada + salida · UTC</span></div>
              {runs.some((run) => run.usage) ? <div className="flex items-end gap-0.5 h-28" role="img" aria-label={`Tokens diarios durante ${days} días`}>
                {daily.map((day) => <div key={day.key} title={`${day.key}: ${count(day.value)} tokens`} className="flex-1 min-w-0 bg-accent/75 rounded-t-sm" style={{ height: `${Math.max(2, day.value / maximum * 100)}%` }} />)}
              </div> : <p className="text-sm text-secondary">Sin datos de tokens para este período.</p>}
              <div className="flex justify-between text-xs text-tertiary mt-2"><span>{daily[0]?.key}</span><span>{daily[daily.length - 1]?.key}</span></div>
            </section>

            <section className="rounded-xl border border-default bg-surface overflow-hidden" aria-label="Detalle de ejecuciones">
              <h2 className="text-sm font-semibold text-primary p-4 border-b border-subtle">Detalle por ejecución</h2>
              {runs.length === 0 ? <p className="p-4 text-sm text-secondary">No hubo ejecuciones con Runner en este período.</p> :
                <div className="divide-y divide-subtle">{runs.map((run) => {
                  const agent = agents.find((item) => item.id === run.agentId);
                  return <div key={run.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="space-y-1"><p className="font-medium text-primary">{agent?.displayName} · {run.provider === 'claude' ? 'Claude' : 'Codex'} · {run.mode}</p>
                      <p className="text-tertiary">{new Date(run.startedAt).toLocaleString('es-AR')} · {run.outcome ?? 'En curso'}</p>
                      <p className="text-secondary">Entrada {count(run.usage?.inputTokens)} · Salida {count(run.usage?.outputTokens)} · Caché leída {count(run.usage?.cacheReadInputTokens)} · Caché creada {count(run.usage?.cacheCreationInputTokens)} · Costo {run.costUsd == null ? 'Sin datos' : money.format(run.costUsd)}</p>
                    </div>
                    <div className="flex items-center gap-3"><span className="text-primary tabular-nums">{count(tokenTotal(run))} tokens</span>
                      <button type="button" onClick={() => setPeekIssueId(run.issueId)} className="text-accent hover:underline">Issue</button>
                      {run.runUrl && <a href={run.runUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex items-center gap-1">Run <ExternalLink className="w-3 h-3" /></a>}
                    </div>
                  </div>;
                })}</div>}
            </section>
          </>}
      </div>
    </div>
  );
}
