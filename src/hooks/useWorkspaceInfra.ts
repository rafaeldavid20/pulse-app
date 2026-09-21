'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { getGithubStatus, listAgents, listEnvironments, AgentSummary, EnvironmentSummary } from '@/lib/firestore';

/**
 * Repos conectados, agentes y entornos del workspace activo.
 *
 * Ninguno de los tres se puede leer de Firestore desde el cliente
 * (`github_installations`, `agents` y `environments` son `allow read: if
 * false`), así que salen de Platform Actions — o sea, de un fetch, no de una
 * suscripción. Se cachea por workspace a nivel de módulo porque el panel del
 * issue se monta y desmonta con cada issue que abrís, y sin esto serían tres
 * llamadas por cada apertura para datos que casi nunca cambian.
 */
interface Infra {
  repos: string[];
  agents: AgentSummary[];
  environments: EnvironmentSummary[];
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
    // Cualquiera puede fallar sin invalidar a los otros: un workspace sin
    // GitHub conectado igual tiene agentes que mostrar, y uno sin orgs de
    // Salesforce es el caso normal.
    const [status, agents, environments] = await Promise.allSettled([
      getGithubStatus(workspaceId),
      listAgents(workspaceId),
      listEnvironments(workspaceId),
    ]);

    const result = {
      repos: status.status === 'fulfilled' ? status.value.repositories ?? [] : [],
      connected: status.status === 'fulfilled' ? status.value.connected : false,
      agents: agents.status === 'fulfilled' ? agents.value : [],
      environments: environments.status === 'fulfilled' ? environments.value : [],
    };
    cache.set(workspaceId, result);
    return result;
  })().finally(() => inFlight.delete(workspaceId));

  inFlight.set(workspaceId, promise);
  return promise;
}

/** Invalida el cache — llamalo después de conectar GitHub, crear un agente o conectar una org. */
export function refreshWorkspaceInfra(workspaceId?: string) {
  if (workspaceId) cache.delete(workspaceId);
  else cache.clear();
}

const EMPTY: Omit<Infra, 'loading'> = { repos: [], agents: [], environments: [], connected: false };

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
