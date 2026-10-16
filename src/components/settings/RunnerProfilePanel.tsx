'use client';

import { useEffect, useRef, useState } from 'react';
import { AgentSummary, runnerProfile } from '@/lib/firestore';
import { canEditProfile, profileState, ProfileView, reconcileProfileView } from '@/lib/runner-profile-state';
import { Button } from '@/components/ui/Button';

const labels: Record<string, string> = {
  no_data: 'Sin perfil confirmado reciente. Esperando al Runner.', verified: 'Perfil local confirmado', applied: 'Cambio confirmado por el Runner',
  applying: 'Aplicando · esperando confirmación del Runner. El resultado se consulta por ID al reconectar.',
  offline: 'Runner desconectado · el último perfil es histórico.', incompatible: 'Actualización requerida: este Runner no anuncia configuración remota v1.',
  validation_failed: 'Validación fallida. El perfil anterior se conserva. Revisá el CLI y los checkouts en la máquina.',
  conflict: 'Conflicto con un cambio local. Recargá el perfil antes de editar.', expired: 'La solicitud venció sin aplicarse. Recargá y reintentá.',
  forbidden: 'El vínculo o los permisos cambiaron. Recargá el agente.',
};

export function RunnerProfilePanel({ agent }: { agent: AgentSummary }) {
  const [view, setView] = useState<ProfileView | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [pendingInput, setPendingInput] = useState<Parameters<typeof runnerProfile>[0] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState('');
  const [directories, setDirectories] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);
  const [clock, setClock] = useState(0);
  const key = `pulse-runner-profile:${agent.id}:${agent.runnerId}`;
  const pendingRef = useRef<string | null>(null);
  const inputRef = useRef<Parameters<typeof runnerProfile>[0] | null>(null);
  const mounted = useRef(true);
  const previousRevision = useRef<string | null>(null);
  const confirmedView = useRef<ProfileView | null>(null);

  useEffect(() => {
    mounted.current = true;
    let stopped = false;
    let stored: string | null = null;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.agentId === agent.id && saved.runnerId === agent.runnerId && typeof saved.requestId === 'string') {
          stored = saved.requestId;
          inputRef.current = saved.op === 'request' && saved.patch && saved.expectedRevision ? saved : null;
        }
      }
    } catch { /* Storage may be disabled. */ }
    pendingRef.current = stored;
    async function refresh() {
      try {
        const response = await runnerProfile({ agentId: agent.id, runnerId: agent.runnerId!, op: 'read', ...(pendingRef.current ? { requestId: pendingRef.current } : {}) });
        if (stopped) return;
        if (response.request?.status === 'applying' && response.request.id !== pendingRef.current) {
          pendingRef.current = response.request.id;
          inputRef.current = null;
          // Discovery supplies an ID, never another client's patch to resubmit.
          try { localStorage.setItem(key, JSON.stringify({ agentId: agent.id, runnerId: agent.runnerId, requestId: response.request.id })); } catch { /* Optional storage. */ }
        }
        const next = reconcileProfileView(confirmedView.current, response, pendingRef.current);
        confirmedView.current = next;
        setView(next); setPending(pendingRef.current); setPendingInput(inputRef.current); setError(null); setClock(Date.now());
        if (next.snapshot && previousRevision.current !== `${next.binding}:${next.snapshot.revision}`) {
          previousRevision.current = `${next.binding}:${next.snapshot.revision}`;
          setModel(next.snapshot.model || '');
          setDirectories(Object.fromEntries(next.snapshot.directories.map(d => [d.repo, d.selected || ''])));
        }
        if (next.request?.id === pendingRef.current && next.request?.status !== 'applying') {
          pendingRef.current = null; setPending(null);
          inputRef.current = null; setPendingInput(null);
          try { localStorage.removeItem(key); } catch { /* Optional storage. */ }
        }
      } catch { if (!stopped) { setError('No se pudo consultar el Runner. Se conserva el último perfil como histórico.'); setView(v => v ? { ...v, online: false } : null); } }
    }
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 5000);
    return () => { stopped = true; mounted.current = false; clearInterval(timer); };
  }, [agent.id, agent.runnerId, key]);

  async function save() {
    if (!view?.snapshot || !canEditProfile(view, pending, clock) || saving) return;
    const requestId = crypto.randomUUID();
    const input: Parameters<typeof runnerProfile>[0] = { agentId: agent.id, runnerId: agent.runnerId!, op: 'request', requestId, expectedRevision: view.snapshot.revision,
      patch: { model: model || null, directories: Object.entries(directories).map(([repo, candidateId]) => ({ repo, candidateId: candidateId || null })) } };
    pendingRef.current = requestId; setPending(requestId); inputRef.current = input; setPendingInput(input);
    try { localStorage.setItem(key, JSON.stringify(input)); } catch { /* Optional storage. */ }
    await submit(input);
  }
  async function submit(input: Parameters<typeof runnerProfile>[0]) {
    setSaving(true); setError(null); setRejection(null);
    try {
      await runnerProfile(input);
      // A successful enqueue is deliberately not a successful application.
    } catch (cause) {
      if (mounted.current) {
        if (cause instanceof Error && 'definitive' in cause) {
          pendingRef.current = null; setPending(null);
          inputRef.current = null; setPendingInput(null);
          try { localStorage.removeItem(key); } catch { /* Optional storage. */ }
          setRejection(cause.message.includes('Conflicto') ? 'conflict' : 'validation_failed'); setError(cause.message);
        } else setError('Solicitud sin confirmación. Consultá su resultado por ID; no se considera aplicada.');
      }
    }
    finally { if (mounted.current) setSaving(false); }
  }
  const connectionState = profileState(view, pending, clock);
  const state = ['offline', 'incompatible'].includes(connectionState) ? connectionState : rejection || connectionState;
  const editable = canEditProfile(view, pending, clock) && state !== 'conflict' && !saving;
  return <div className="flex flex-col gap-3 p-3 border border-default rounded-lg text-xs">
    <p className="text-secondary">Configuración efectiva · {agent.kind} · Runner {agent.runnerId}</p>
    {view && <p className="text-tertiary">{view.online ? 'Conectado' : 'Desconectado'} · {view.capable ? 'Configuración remota v1' : 'Sin capacidad de configuración remota v1'}</p>}
    <p role="status" aria-live="polite">{labels[state]}</p>
    {error && <p role="alert" className="text-priority-urgent">{error}</p>}
    {pending && <p className="text-tertiary">Solicitud: {pending}</p>}
    {pending && pendingInput && view?.online && view.capable && !view.request && <Button size="sm" variant="secondary" disabled={saving} onClick={() => submit(pendingInput)}>Consultar o reintentar la misma solicitud</Button>}
    {view?.snapshot && <>
      <p className="text-tertiary">Última observación: {view.observedAt ? new Date(view.observedAt).toLocaleString() : 'sin fecha'} · revisión {view.snapshot.revision.slice(0, 12)}</p>
      <p>Modelo confirmado: {view.snapshot.model || 'Predeterminado del proveedor · resolución dinámica'}{!view.snapshot.modelValid ? ' · validación fallida' : ''}</p>
      <label className="flex flex-col gap-1">Modelo para próximas ejecuciones
        <select className="bg-surface border border-default rounded p-2" disabled={!editable} value={model} onChange={e => setModel(e.target.value)}>
          <option value="">Predeterminado del proveedor</option>
          {view.snapshot.model && !view.snapshot.models.includes(view.snapshot.model) && <option value={view.snapshot.model}>{view.snapshot.model} · no disponible</option>}
          {view.snapshot.models.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
      {!view.snapshot.models.length && <p className="text-tertiary">El CLI instalado no ofrece un catálogo validado de modelos. Usá el valor predeterminado o actualizá el CLI en la máquina.</p>}
      {view.repos.map(repo => {
        const entry = view.snapshot!.directories.find(d => d.repo === repo);
        return <label key={repo} className="flex flex-col gap-1">{repo} · confirmado: {entry?.selected ? entry.candidates.find(c => c.id === entry.selected)?.alias || 'checkout inaccesible' : 'predeterminado'}{entry && !entry.valid ? ' · validación fallida' : ''}
          <select className="bg-surface border border-default rounded p-2" value={directories[repo] || ''} disabled={!editable || !entry} onChange={e => setDirectories(d => ({ ...d, [repo]: e.target.value }))}>
            <option value="">Predeterminado · quitar override</option>
            {entry?.selected && !entry.candidates.some(c => c.id === entry.selected) && <option value={entry.selected}>Checkout inaccesible</option>}
            {entry?.candidates.map(c => <option key={c.id} value={c.id}>{c.alias}</option>)}
          </select>
          {!entry?.candidates.length && <span className="text-tertiary">Registrá un checkout en la máquina con pulse-runner profile register --agent {agent.id} --repo {repo} --directory &lt;raíz Git&gt;.</span>}
        </label>;
      })}
      <Button size="sm" variant="secondary" disabled={!editable} onClick={save}>Guardar en Runner</Button>
    </>}
    <Button size="sm" variant="secondary" disabled={saving || state === 'applying'} onClick={() => { previousRevision.current = null; confirmedView.current = null; setView(null); setError(null); setRejection(null); }}>Recargar perfil</Button>
    <p className="text-tertiary">Los cambios confirmados rigen para próximas ejecuciones. Los jobs activos conservan su configuración.</p>
  </div>;
}
