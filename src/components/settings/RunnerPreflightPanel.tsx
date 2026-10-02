'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { AgentSummary, preflightRunnerAgent, RunnerPreflightResult } from '@/lib/firestore';

export function RunnerPreflightPanel({ agent }: { agent: AgentSummary }) {
  const [result, setResult] = useState<RunnerPreflightResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    if (!result?.ready || !result.checkedAt) return;
    const delay = Math.max(0, Date.parse(result.checkedAt) + 120_000 - Date.now());
    const timer = setTimeout(() => { setResult(null); setError('La verificación venció. Volvé a verificar la preparación.'); }, delay);
    return () => clearTimeout(timer);
  }, [result]);
  async function check() {
    setChecking(true); setError(null); setResult(null);
    try {
      const repos = agent.role === 'qa' ? [agent.reviewRepo].filter((repo): repo is string => !!repo)
        : agent.allowedRepos?.length ? agent.allowedRepos : (agent.connectedRepos || []).map((connection) => connection.repoFullName);
      setResult(await preflightRunnerAgent(agent.id, repos));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo verificar el agente.'); }
    finally { setChecking(false); }
  }
  return <div className="flex flex-col gap-2 p-3 border border-default rounded-lg text-xs">
    <div className="flex items-center justify-between gap-3">
      <span className="text-secondary">Preparación del Runner · {agent.kind} · {agent.role === 'qa' ? 'QA' : 'Dev'}</span>
      <Button size="sm" variant="secondary" disabled={checking} onClick={check}>{checking ? 'Verificando…' : result ? 'Reintentar verificación' : 'Verificar preparación'}</Button>
    </div>
    <p className="text-tertiary">La sesión del proveedor se prepara en la máquina y usuario del Runner. Después de corregir un problema, ejecutá pulse-runner diagnose allí y reintentá.</p>
    <p className="text-secondary">Identidad local esperada: <code>pulse-runner identity add --agent {agent.id} --agent-kind {agent.kind} --agent-role {agent.role || 'dev'}</code></p>
    <div aria-live="polite">
      {error && <p role="alert" className="text-priority-urgent">{error}</p>}
      {result && <>
        <p className={result.ready ? 'text-primary' : 'text-priority-urgent'}>{result.ready ? 'Listo para recibir jobs en los repos verificados.' : 'Preparación incompleta; el despacho quedará bloqueado.'}</p>
        {result.identity && <p className="text-secondary">Identidad efectiva: {result.identity.agentId} · {result.identity.kind} · {result.identity.role} · {result.runnerId}</p>}
        {result.checkedAt && <p className="text-tertiary">Verificación local: {new Date(result.checkedAt).toLocaleString()}</p>}
        {result.problems.length > 0 && <ul className="mt-2 space-y-2">{result.problems.map((problem, index) => <li key={`${problem.code}-${index}`}><p className="text-priority-urgent">{problem.message}</p><p className="text-secondary">{problem.action}</p></li>)}</ul>}
      </>}
    </div>
  </div>;
}
