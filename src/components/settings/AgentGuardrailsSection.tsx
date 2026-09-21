'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, Loader2, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/stores/appStore';
import {
  AgentBudgetSummary,
  getWorkspaceAgentBudget,
  updateWorkspaceGuardrails,
  WorkspaceGuardrails,
} from '@/lib/firestore';

const ROLE_LABELS: Record<string, string> = {
  dev: 'Dev',
  qa: 'QA',
};

function formatUsd(amount: number): string {
  return amount.toFixed(2);
}

/**
 * D8/TES-153: kill switch global de agentes, techos de costo/dispatches por
 * workspace, y el resumen de gasto de hoy. `CommandPalette` expone el mismo
 * toggle de `agentsPaused` como el comando "Pausar agentes" — ambos pegan a
 * `workspaces.update`, así que quedan siempre consistentes.
 */
export function AgentGuardrailsSection() {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const workspaceId = activeWorkspace?.id;

  const [budget, setBudget] = useState<AgentBudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [dailyDispatchLimit, setDailyDispatchLimit] = useState('');
  const [dailyCostCapUsd, setDailyCostCapUsd] = useState('');
  const [issueCostCapUsd, setIssueCostCapUsd] = useState('');
  const [maxRunsPerIssue, setMaxRunsPerIssue] = useState('');

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getWorkspaceAgentBudget(workspaceId);
      setBudget(result);
      setDailyDispatchLimit(String(result.dailyDispatchLimit));
      setDailyCostCapUsd(result.dailyCostCapUsd != null ? String(result.dailyCostCapUsd) : '');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Error al cargar el presupuesto de agentes.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, not a render loop
    refresh();
  }, [refresh]);

  const applyGuardrails = async (data: Partial<WorkspaceGuardrails>) => {
    if (!workspaceId) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateWorkspaceGuardrails(workspaceId, data);
      await refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo actualizar el workspace.');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePaused = () => {
    if (!budget) return;
    applyGuardrails({ agentsPaused: !budget.agentsPaused });
  };

  const handleNumberFieldSave = (field: keyof WorkspaceGuardrails, raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '') return;
    const value = Number(trimmed);
    if (!Number.isFinite(value)) return;
    applyGuardrails({ [field]: value } as Partial<WorkspaceGuardrails>);
  };

  if (!workspaceId) return null;

  return (
    <div className="flex flex-col gap-4 p-5 bg-surface border border-default rounded-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="w-4 h-4 text-secondary shrink-0" />
          <h3 className="text-base font-semibold text-primary truncate">Guardarraíles de agentes</h3>
        </div>
        <Button
          size="sm"
          variant={budget?.agentsPaused ? 'primary' : 'danger'}
          icon={budget?.agentsPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          onClick={handleTogglePaused}
          disabled={loading || saving || !budget}
          className="shrink-0"
        >
          {budget?.agentsPaused ? 'Reanudar agentes' : 'Pausar agentes'}
        </Button>
      </div>

      <p className="text-xs text-secondary">
        Techos de costo y dispatches por workspace, y el kill switch global. Con &quot;Pausar
        agentes&quot; activo, ningún camino de dispatch (tarea, traspaso, re-trabajo o revisión)
        arranca un agente nuevo.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-secondary">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : loadError ? (
        <p className="text-xs text-priority-urgent break-words">{loadError}</p>
      ) : budget ? (
        <>
          <div className="flex flex-col gap-1 p-3 bg-elevated border border-default rounded-md min-w-0">
            <p className="text-sm text-primary break-words">
              hoy: {budget.dispatchesToday}/{budget.dailyDispatchLimit} dispatches · USD{' '}
              {formatUsd(budget.costUsdToday)}
              {budget.dailyCostCapUsd != null ? ` / ${formatUsd(budget.dailyCostCapUsd)}` : ''}
              {budget.agentsPaused && (
                <span className="ml-2 text-priority-urgent font-medium">· agentes pausados</span>
              )}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {Object.entries(budget.byRole).map(([role, summary]) => (
                <span key={role} className="text-xs text-tertiary truncate">
                  {ROLE_LABELS[role] ?? role}: {summary.dispatches} dispatches · USD{' '}
                  {formatUsd(summary.costUsd)}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-secondary">Tope diario de dispatches</label>
              <input
                type="number"
                min={1}
                value={dailyDispatchLimit}
                disabled={saving}
                onChange={(e) => setDailyDispatchLimit(e.target.value)}
                onBlur={(e) => handleNumberFieldSave('dailyDispatchLimit', e.target.value)}
                className="bg-elevated border border-default rounded-md px-2 py-1.5 text-primary text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-secondary">Tope de runs por issue</label>
              <input
                type="number"
                min={1}
                placeholder="Dejar vacío para no cambiar"
                value={maxRunsPerIssue}
                disabled={saving}
                onChange={(e) => setMaxRunsPerIssue(e.target.value)}
                onBlur={(e) => handleNumberFieldSave('maxRunsPerIssue', e.target.value)}
                className="bg-elevated border border-default rounded-md px-2 py-1.5 text-primary text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-secondary">Techo diario en USD</label>
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Sin tope"
                value={dailyCostCapUsd}
                disabled={saving}
                onChange={(e) => setDailyCostCapUsd(e.target.value)}
                onBlur={(e) => handleNumberFieldSave('dailyCostCapUsd', e.target.value)}
                className="bg-elevated border border-default rounded-md px-2 py-1.5 text-primary text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-secondary">Techo por issue en USD</label>
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Dejar vacío para no cambiar"
                value={issueCostCapUsd}
                disabled={saving}
                onChange={(e) => setIssueCostCapUsd(e.target.value)}
                onBlur={(e) => handleNumberFieldSave('issueCostCapUsd', e.target.value)}
                className="bg-elevated border border-default rounded-md px-2 py-1.5 text-primary text-xs"
              />
            </div>
          </div>

          {saveError && <p className="text-xs text-priority-urgent break-words">{saveError}</p>}
        </>
      ) : null}
    </div>
  );
}
