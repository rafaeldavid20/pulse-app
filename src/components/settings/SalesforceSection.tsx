'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Cloud, Loader2, Plus, RefreshCw, Unplug, AlertTriangle, CheckCircle2, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/stores/appStore';
import {
  listEnvironments,
  verifyEnvironment,
  disconnectEnvironment,
  connectEnvironmentRepo,
  describeSalesforceConnectError,
  getGithubStatus,
  EnvironmentSummary,
} from '@/lib/firestore';
import { refreshWorkspaceInfra } from '@/hooks/useWorkspaceInfra';
import { ConnectOrgModal } from './ConnectOrgModal';

const STATE_LABEL: Record<EnvironmentSummary['connectionState'], string> = {
  connected: 'Conectada',
  expired: 'Caducada',
  revoked: 'Revocada',
  error: 'Con error',
};

function StateDot({ state }: { state: EnvironmentSummary['connectionState'] }) {
  const tone =
    state === 'connected' ? 'bg-status-done' : state === 'error' ? 'bg-priority-urgent' : 'bg-priority-high';
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tone}`} title={STATE_LABEL[state]} />;
}

function OrgRow({
  env,
  onChanged,
  onReconnect,
}: {
  env: EnvironmentSummary;
  onChanged: () => void;
  onReconnect: (env: EnvironmentSummary) => void;
}) {
  const [busy, setBusy] = useState<'verify' | 'disconnect' | 'repo' | null>(null);
  const repoConnected = (env.connectedRepos || []).some((c) => c.repoFullName === env.repoFullName);

  const handleConnectRepo = async () => {
    setBusy('repo');
    try {
      const res = await connectEnvironmentRepo(env.id);
      toast.success(
        `${env.displayName}: atado a ${res.repoFullName}. Un push a ${res.trackingBranches.join(', ')} despliega.`
      );
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo atar el entorno al repo.');
    } finally {
      setBusy(null);
    }
  };

  const handleVerify = async () => {
    setBusy('verify');
    try {
      const res = await verifyEnvironment(env.id);
      if (res.ok) {
        const remaining = res.dailyApiRequests
          ? ` · ${res.dailyApiRequests.remaining}/${res.dailyApiRequests.max} llamadas de API disponibles hoy`
          : '';
        toast.success(`${env.displayName}: conexión verificada${remaining}`);
      } else {
        toast.error(res.reason ?? 'No se pudo verificar la conexión.');
      }
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo verificar la conexión.');
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm(`¿Desconectar ${env.displayName}? Se revoca el acceso de Pulse a esa org.`)) return;
    setBusy('disconnect');
    try {
      const res = await disconnectEnvironment(env.id);
      if (res.warnings.length > 0) {
        // No es un fallo: la desconexión se completó. Pero lo que no se pudo
        // limpiar queda en manos de una persona, así que tiene que verse.
        res.warnings.forEach((w) => toast.warning(w, { duration: 10000 }));
      } else {
        toast.success(`${env.displayName} desconectada.`);
      }
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo desconectar el entorno.');
      setBusy(null);
    }
  };

  const needsReconnect = env.connectionState === 'expired' || env.connectionState === 'revoked';

  return (
    <div className="flex flex-col gap-2 px-3 py-2.5 bg-elevated border border-default rounded-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <StateDot state={env.connectionState} />
            <span className="text-sm text-primary truncate" title={env.displayName}>
              {env.displayName}
            </span>
            <span className="text-xs text-tertiary shrink-0">{env.key}</span>
            {env.isProduction && (
              <span className="text-[10px] uppercase tracking-wide text-priority-urgent shrink-0">prod</span>
            )}
          </div>
          <span
            className="text-xs text-tertiary truncate"
            title={env.salesforce ? `${env.salesforce.username} · ${env.salesforce.instanceUrl}` : undefined}
          >
            {env.salesforce
              ? `${env.salesforce.username} · ${env.salesforce.instanceUrl}`
              : 'Sin datos de la org'}
          </span>
          <span className="text-xs text-tertiary truncate" title={`${env.repoFullName} · ${env.trackingBranch}`}>
            {env.repoFullName} · rama {env.trackingBranch}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleVerify}
            disabled={busy !== null}
            icon={
              busy === 'verify' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )
            }
          >
            Verificar
          </Button>
          {!needsReconnect && (!repoConnected || env.repoSecretsStale) && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleConnectRepo}
              disabled={busy !== null}
              icon={
                busy === 'repo' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitBranch className="w-3.5 h-3.5" />
              }
            >
              {repoConnected ? 'Volver a atar' : 'Atar al repo'}
            </Button>
          )}
          {needsReconnect && (
            <Button size="sm" variant="secondary" onClick={() => onReconnect(env)} disabled={busy !== null}>
              Reconectar
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDisconnect}
            disabled={busy !== null}
            icon={
              busy === 'disconnect' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Unplug className="w-3.5 h-3.5" />
              )
            }
          >
            Desconectar
          </Button>
        </div>
      </div>

      {needsReconnect && (
        <p className="flex items-start gap-1.5 text-xs text-priority-high">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span className="min-w-0">
            La credencial ya no sirve. Volvé a autorizar para que Pulse pueda seguir leyendo y desplegando.
          </span>
        </p>
      )}

      {env.repoSecretsStale && (
        <p className="flex items-start gap-1.5 text-xs text-priority-high">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span className="min-w-0">
            Se reconectó la org: los repos que ya tenían la credencial vieja no van a poder desplegar hasta
            volver a atarlos.
          </span>
        </p>
      )}
    </div>
  );
}

export function SalesforceSection() {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const workspaceId = activeWorkspace?.id;
  const searchParams = useSearchParams();

  const [environments, setEnvironments] = useState<EnvironmentSummary[]>([]);
  const [repos, setRepos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [reconnecting, setReconnecting] = useState<EnvironmentSummary | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setLoadError(null);
    try {
      setEnvironments(await listEnvironments(workspaceId));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar los entornos.');
    } finally {
      setLoading(false);
    }
    // Que GitHub falle no impide mostrar las orgs; sólo deja sin repos el
    // selector del modal, que ya avisa cuando está vacío.
    try {
      const status = await getGithubStatus(workspaceId);
      setRepos(status.repositories ?? []);
    } catch {
      setRepos([]);
    }
    refreshWorkspaceInfra(workspaceId);
  }, [workspaceId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, not a render loop
    refresh();
  }, [refresh]);

  // Resultado del redirect de salesforceCallback.
  const sf = searchParams.get('sf');
  const reason = searchParams.get('reason');
  const connectedEnv = searchParams.get('env');
  useEffect(() => {
    if (sf === 'connected') {
      toast.success(connectedEnv ? `Org '${connectedEnv}' conectada.` : 'Org conectada.');
    } else if (sf === 'error') {
      toast.error(describeSalesforceConnectError(reason ?? 'unknown'), { duration: 12000 });
    }
    if (sf) window.history.replaceState({}, '', '/settings/salesforce');
  }, [sf, reason, connectedEnv]);

  if (!workspaceId) return null;

  const openConnect = (env: EnvironmentSummary | null) => {
    setReconnecting(env);
    setModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-4 p-5 bg-surface border border-default rounded-xl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Cloud className="w-4 h-4 text-secondary shrink-0" />
          <h3 className="text-base font-semibold text-primary">Orgs de Salesforce</h3>
        </div>
        <Button
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => openConnect(null)}
          disabled={loading}
          className="shrink-0"
        >
          Conectar org
        </Button>
      </div>

      <p className="text-xs text-secondary">
        Cada entorno es una org más la rama de git cuyo HEAD representa lo que está desplegado ahí. Te
        autenticás con tu usuario de Salesforce, como en el plugin del IDE.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-secondary">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : loadError ? (
        <p className="text-xs text-priority-urgent break-words">{loadError}</p>
      ) : environments.length === 0 ? (
        <p className="text-xs text-tertiary py-2">
          Todavía no conectaste ninguna org. Empezá por la de desarrollo.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {environments.map((env) => (
            <OrgRow key={env.id} env={env} onChanged={refresh} onReconnect={openConnect} />
          ))}
        </div>
      )}

      {!loading && !loadError && repos.length === 0 && (
        <p className="flex items-start gap-1.5 text-xs text-tertiary">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span className="min-w-0">
            No hay repos autorizados en este workspace. Conectá GitHub desde Integraciones antes de conectar
            una org: un entorno necesita saber qué rama lo despliega.
          </span>
        </p>
      )}

      {!loading && environments.length > 0 && environments.every((e) => e.connectionState === 'connected') && (
        <p className="flex items-center gap-1.5 text-xs text-tertiary">
          <CheckCircle2 className="w-3.5 h-3.5 text-status-done shrink-0" />
          Todas las orgs responden.
        </p>
      )}

      {modalOpen && (
        <ConnectOrgModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          workspaceId={workspaceId}
          repos={repos}
          existing={environments}
          reconnecting={reconnecting}
        />
      )}
    </div>
  );
}
