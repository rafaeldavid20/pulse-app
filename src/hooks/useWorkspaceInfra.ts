'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { getGithubStatus, listAgents, AgentSummary } from '@/lib/firestore';

/**
 * Repos conectados y agentes del workspace activo.
 *
 * Ninguno de los dos se puede leer de Firestore desde el cliente
 * (`github_installations` y `agents` son `allow read: if false`), así que salen
 * de Platform Actions — o sea, de un fetch, no de una suscripción. Se cachea
 * por workspace a nivel de módulo porque el panel del issue se monta y
 * desmonta con cada issue que abrís, y sin esto serían dos llamadas por cada
 * apertura para datos que casi nunca cambian.
 */
interface Infra {
  repos: string[];
  agents: AgentSummary[];
  connected: boolean;
  loading: boolean;
}

const cache = new Map<string, Omit<Infra, 'loading'>>();
const inFlight = new Map<string, Promise<Omit<Infra, 'loading'>>>();

async function load(workspaceId: string): Promise<Omit<Infra, 'loading'>> {
  const cached = cache.get(workspaceId);
  if (cached) return cached;

  const pending = inFlight.get(workspaceId);
  if (pending) return pending;

  const promise = (async () => {
    // Uno de los dos puede fallar sin que eso invalide al otro: un workspace
    // sin GitHub conectado igual tiene agentes que mostrar.
    const [status, agents] = await Promise.allSettled([
      getGithubStatus(workspaceId),
      listAgents(workspaceId),
    ]);

    const result = {
      repos: status.status === 'fulfilled' ? status.value.repositories ?? [] : [],
      connected: status.status === 'fulfilled' ? status.value.connected : false,
      agents: agents.status === 'fulfilled' ? agents.value : [],
    };
    cache.set(workspaceId, result);
    return result;
  })().finally(() => inFlight.delete(workspaceId));

  inFlight.set(workspaceId, promise);
  return promise;
}

/** Invalida el cache — llamalo después de conectar GitHub o crear un agente. */
export function refreshWorkspaceInfra(workspaceId?: string) {
  if (workspaceId) cache.delete(workspaceId);
  else cache.clear();
}

const EMPTY: Omit<Infra, 'loading'> = { repos: [], agents: [], connected: false };

export function useWorkspaceInfra(): Infra {
  const workspaceId = useAppStore((s) => s.activeWorkspace?.id);
  // El resultado se guarda junto al workspace al que pertenece, para poder
  // derivar `loading` en render: setearlo dentro del efecto dispara un render
  // en cascada por cada cambio de workspace, y además dejaría un instante con
  // los datos del workspace anterior marcados como listos.
  const [loaded, setLoaded] = useState<{ ws: string; value: Omit<Infra, 'loading'> } | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    let alive = true;
    load(workspaceId)
      .then((value) => alive && setLoaded({ ws: workspaceId, value }))
      .catch(() => alive && setLoaded({ ws: workspaceId, value: EMPTY }));

    return () => {
      alive = false;
    };
  }, [workspaceId]);

  const fresh = loaded && loaded.ws === workspaceId ? loaded.value : undefined;
  return { ...(fresh ?? EMPTY), loading: !!workspaceId && !fresh };
}
