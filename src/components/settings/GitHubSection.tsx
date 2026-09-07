'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { GitBranch, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/stores/appStore';
import { getGithubStatus, getGithubInstallUrl, GithubStatus } from '@/lib/firestore';

export function GitHubSection() {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const workspaceId = activeWorkspace?.id;

  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      setStatus(await getGithubStatus(workspaceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar GitHub.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, not a render loop
    refresh();
  }, [refresh]);

  const handleConnect = async () => {
    if (!workspaceId) return;
    setConnecting(true);
    setError(null);
    try {
      const url = await getGithubInstallUrl(workspaceId);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar la conexión con GitHub.');
      setConnecting(false);
    }
  };

  if (!workspaceId) return null;

  return (
    <div className="flex flex-col gap-4 p-5 bg-[#0F1012] border border-[#26292F] rounded-xl">
      <div className="flex items-center gap-2">
        <GitBranch className="w-4 h-4 text-[#8A8F98]" />
        <h3 className="text-base font-semibold text-[#F7F8F8]">GitHub</h3>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-[#8A8F98]">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : error ? (
        <p className="text-xs text-[#F75555]">{error}</p>
      ) : status?.connected ? (
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-[#F7F8F8]">
              Conectado a <span className="font-semibold">{status.accountLogin}</span>
            </span>
            <span className="text-xs text-[#5B616E]">
              {status.repositories && status.repositories.length > 0
                ? status.repositories.join(', ')
                : 'Sin repos autorizados'}
            </span>
          </div>
          <Button size="sm" variant="secondary" onClick={handleConnect} disabled={connecting}>
            {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Gestionar'}
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#8A8F98] max-w-xs">
            Conectá un repositorio para que los issues puedan generar ramas de GitHub directamente desde Pulse.
          </p>
          <Button size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />} onClick={handleConnect} disabled={connecting}>
            {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Conectar GitHub'}
          </Button>
        </div>
      )}
    </div>
  );
}
