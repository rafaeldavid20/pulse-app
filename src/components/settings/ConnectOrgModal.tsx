'use client';

import React, { useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { beginConnectEnvironment, CreateEnvironmentInput, EnvironmentSummary } from '@/lib/firestore';
import type { SalesforceLoginHost, SalesforceTestLevel } from '@/types';

/**
 * Presets de la cadena de promoción típica de un proyecto Salesforce. No son
 * una restricción: la clave y la rama se pueden editar. Existen porque
 * "dev → demo → uat → prod" es lo que hay en casi todos los proyectos, y
 * tipearlo cuatro veces invita a errores de dedo en la clave, que después va
 * en el nombre de un secret.
 */
const ENV_PRESETS = [
  { key: 'dev', displayName: 'Desarrollo', position: 0, trackingBranch: 'develop', isProduction: false },
  { key: 'demo', displayName: 'Demo', position: 1, trackingBranch: 'demo', isProduction: false },
  { key: 'uat', displayName: 'UAT', position: 2, trackingBranch: 'uat', isProduction: false },
  { key: 'prod', displayName: 'Producción', position: 3, trackingBranch: 'main', isProduction: true },
] as const;

const TEST_LEVELS: { value: SalesforceTestLevel; label: string }[] = [
  { value: 'NoTestRun', label: 'Sin tests' },
  { value: 'RunLocalTests', label: 'Tests locales' },
  { value: 'RunAllTestsInOrg', label: 'Todos los tests de la org' },
  { value: 'RunSpecifiedTests', label: 'Tests especificados' },
];

const selectClass =
  'w-full bg-elevated border border-default focus:border-accent rounded-md px-3 py-2 text-sm text-primary outline-none transition-colors';

const labelClass = 'text-xs font-semibold text-secondary';

interface ConnectOrgModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  repos: string[];
  /** Entornos ya conectados, para no dejar repetir una clave. */
  existing: EnvironmentSummary[];
  /** Presente cuando se está reconectando una org que ya existe. */
  reconnecting?: EnvironmentSummary | null;
}

export function ConnectOrgModal({
  isOpen,
  onClose,
  workspaceId,
  repos,
  existing,
  reconnecting,
}: ConnectOrgModalProps) {
  const [key, setKey] = useState(reconnecting?.key ?? 'dev');
  const [displayName, setDisplayName] = useState(reconnecting?.displayName ?? 'Desarrollo');
  const [position, setPosition] = useState(reconnecting?.position ?? 0);
  const [trackingBranch, setTrackingBranch] = useState(reconnecting?.trackingBranch ?? 'develop');
  const [repoFullName, setRepoFullName] = useState(reconnecting?.repoFullName ?? repos[0] ?? '');
  const [isProduction, setIsProduction] = useState(reconnecting?.isProduction ?? false);
  const [requiresApproval, setRequiresApproval] = useState(reconnecting?.requiresApproval ?? false);
  const [defaultTestLevel, setDefaultTestLevel] = useState<SalesforceTestLevel>(
    reconnecting?.defaultTestLevel ?? 'RunLocalTests'
  );
  const [allowDirectWrites, setAllowDirectWrites] = useState(reconnecting?.allowDirectWrites ?? false);
  const [loginHost, setLoginHost] = useState<SalesforceLoginHost>(reconnecting?.salesforce?.loginHost ?? 'test');
  const [customDomain, setCustomDomain] = useState('');
  // El secret nunca vuelve del backend, así que al reconectar hay que
  // pegarlo de nuevo. Es a propósito: una credencial que se puede leer de
  // vuelta es una credencial que se puede filtrar.
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = (presetKey: string) => {
    const preset = ENV_PRESETS.find((p) => p.key === presetKey);
    if (!preset) return;
    setKey(preset.key);
    setDisplayName(preset.displayName);
    setPosition(preset.position);
    setTrackingBranch(preset.trackingBranch);
    setIsProduction(preset.isProduction);
    setRequiresApproval(preset.isProduction);
    setLoginHost(preset.isProduction ? 'login' : 'test');
    if (preset.isProduction) setAllowDirectWrites(false);
  };

  const keyTaken = existing.some((e) => e.key === key && e.id !== reconnecting?.id);
  const canSubmit = !!key && !!repoFullName && !!trackingBranch && !keyTaken &&
    !!clientId.trim() && !!clientSecret.trim() &&
    (loginHost !== 'custom' || !!customDomain.trim());

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const input: CreateEnvironmentInput = {
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        key,
        displayName,
        position,
        trackingBranch,
        repoFullName,
        isProduction,
        requiresApproval,
        defaultTestLevel,
        allowDirectWrites: isProduction ? false : allowDirectWrites,
        loginHost,
        customDomain: loginHost === 'custom' ? customDomain.trim() : undefined,
        environmentId: reconnecting?.id,
      };
      const url = await beginConnectEnvironment(workspaceId, input);
      // Salida del flujo: el resto pasa en Salesforce y vuelve por
      // salesforceCallback. No se limpia `submitting` a propósito — la página
      // se está yendo.
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar la conexión.');
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={reconnecting ? `Reconectar ${reconnecting.displayName}` : 'Conectar una org de Salesforce'}
      maxWidth="lg"
    >
      <div className="flex flex-col gap-4">
        {!reconnecting && (
          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Entorno</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {ENV_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => applyPreset(preset.key)}
                  className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                    key === preset.key
                      ? 'border-accent text-accent bg-accent/10'
                      : 'border-default text-secondary hover:text-primary hover:bg-hover'
                  }`}
                >
                  {preset.displayName}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5 min-w-0">
            <label className={labelClass} htmlFor="env-key">
              Clave
            </label>
            <Input
              id="env-key"
              value={key}
              onChange={(e) => setKey(e.target.value.toLowerCase())}
              placeholder="dev"
              disabled={!!reconnecting}
              error={keyTaken ? 'Ya hay un entorno con esta clave.' : undefined}
            />
            <span className="text-xs text-tertiary">
              Va en el nombre del secret del repo: PULSE_SF_AUTH_{key.toUpperCase() || '…'}
            </span>
          </div>

          <div className="flex flex-col gap-1.5 min-w-0">
            <label className={labelClass} htmlFor="env-name">
              Nombre
            </label>
            <Input
              id="env-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Desarrollo"
            />
          </div>

          <div className="flex flex-col gap-1.5 min-w-0">
            <label className={labelClass} htmlFor="env-repo">
              Repositorio
            </label>
            <select
              id="env-repo"
              className={selectClass}
              value={repoFullName}
              onChange={(e) => setRepoFullName(e.target.value)}
            >
              {repos.length === 0 && <option value="">Sin repos autorizados</option>}
              {repos.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 min-w-0">
            <label className={labelClass} htmlFor="env-branch">
              Rama que despliega acá
            </label>
            <Input
              id="env-branch"
              value={trackingBranch}
              onChange={(e) => setTrackingBranch(e.target.value)}
              placeholder="develop"
            />
          </div>

          <div className="flex flex-col gap-1.5 min-w-0">
            <label className={labelClass} htmlFor="env-host">
              Login de Salesforce
            </label>
            <select
              id="env-host"
              className={selectClass}
              value={loginHost}
              onChange={(e) => setLoginHost(e.target.value as SalesforceLoginHost)}
            >
              <option value="test">Sandbox (test.salesforce.com)</option>
              <option value="login">Producción o Developer (login.salesforce.com)</option>
              <option value="custom">My Domain propio</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5 min-w-0">
            <label className={labelClass} htmlFor="env-tests">
              Tests por defecto al desplegar
            </label>
            <select
              id="env-tests"
              className={selectClass}
              value={defaultTestLevel}
              onChange={(e) => setDefaultTestLevel(e.target.value as SalesforceTestLevel)}
            >
              {TEST_LEVELS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loginHost === 'custom' && (
          <div className="flex flex-col gap-1.5 min-w-0">
            <label className={labelClass} htmlFor="env-domain">
              My Domain
            </label>
            <Input
              id="env-domain"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="acme--uat.sandbox.my.salesforce.com"
            />
          </div>
        )}

        <div className="flex flex-col gap-3 pt-3 border-t border-subtle">
          <div className="flex flex-col gap-1">
            <span className={labelClass}>External Client App de esta org</span>
            <p className="text-xs text-tertiary">
              En la org: Setup → External Client App Manager → New. Callback URL{' '}
              <code className="text-secondary break-all">
                https://us-east4-pulse-app-93.cloudfunctions.net/salesforceCallback
              </code>
              , scopes <code className="text-secondary">api</code>,{' '}
              <code className="text-secondary">id</code> y{' '}
              <code className="text-secondary">refresh_token</code>, y el flujo &ldquo;Code and
              Credential&rdquo;. Después copiá el Consumer Key y el Secret desde su pestaña de OAuth
              Settings.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 min-w-0">
              <label className={labelClass} htmlFor="env-client-id">
                Consumer Key
              </label>
              <Input
                id="env-client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="3MVG9..."
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5 min-w-0">
              <label className={labelClass} htmlFor="env-client-secret">
                Consumer Secret
              </label>
              <Input
                id="env-client-secret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="••••••••"
                autoComplete="off"
              />
              {reconnecting && (
                <span className="text-xs text-tertiary">
                  Hay que pegarlo de nuevo: el secret guardado no se puede leer de vuelta.
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-3 border-t border-subtle">
          <label className="flex items-center gap-2 text-xs text-secondary cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={isProduction}
              onChange={(e) => {
                setIsProduction(e.target.checked);
                if (e.target.checked) {
                  setRequiresApproval(true);
                  setAllowDirectWrites(false);
                }
              }}
            />
            Es producción
          </label>

          <label className="flex items-center gap-2 text-xs text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
            />
            Requiere aprobación humana antes de desplegar
          </label>

          <label
            className={`flex items-center gap-2 text-xs cursor-pointer ${
              isProduction ? 'text-muted cursor-not-allowed' : 'text-secondary'
            }`}
          >
            <input
              type="checkbox"
              checked={allowDirectWrites}
              disabled={isProduction}
              onChange={(e) => setAllowDirectWrites(e.target.checked)}
            />
            Permitir cambios directos en la org, sin pasar por git
            {isProduction && ' (nunca en producción)'}
          </label>
        </div>

        <p className="text-xs text-tertiary">
          Te vamos a mandar a Salesforce para que autorices con tu usuario. Todo lo que Pulse haga después
          queda auditado en la org como ese usuario.
        </p>

        {error && <p className="text-xs text-priority-urgent break-words">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            size="sm"
            icon={submitting ? undefined : <ExternalLink className="w-3.5 h-3.5" />}
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Autorizar en Salesforce'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
