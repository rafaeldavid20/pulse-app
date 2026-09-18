'use client';

import React, { useState } from 'react';
import { Cycle, Issue, IssuePriority } from '@/types';
import { useIssueStore } from '@/stores/issueStore';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import { IssueTypeBadge } from '@/components/issues/IssueTypeBadge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { ArrowLeftRight, ArrowRight, Inbox } from 'lucide-react';

interface CyclePlanningPanelProps {
  cycle: Cycle;
  cycleIssues: Issue[];
  backlogIssues: Issue[];
  /** Ciclos completados quedan de solo lectura, igual que `CycleListItem`. */
  editable: boolean;
}

interface PlanningRowProps {
  issue: Issue;
  checked: boolean;
  draggable: boolean;
  onToggle: () => void;
  /** Solo la columna "en el ciclo" reordena prioridad soltando sobre una fila. */
  onDropOnRow?: (draggedId: string) => void;
}

const PlanningRow: React.FC<PlanningRowProps> = ({ issue, checked, draggable, onToggle, onDropOnRow }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', issue.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        if (!onDropOnRow) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        if (!onDropOnRow) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId && draggedId !== issue.id) onDropOnRow(draggedId);
      }}
      className={cn(
        'group flex items-center gap-2 px-2.5 py-1.5 border-b border-subtle last:border-b-0 transition-colors select-none',
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
        isDragOver ? 'bg-accent/10' : 'hover:bg-elevated'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        disabled={!draggable}
        className="w-3.5 h-3.5 rounded border-default bg-elevated text-accent focus:ring-0 accent-accent cursor-pointer disabled:cursor-not-allowed"
      />
      <span className="font-mono text-[11px] text-tertiary font-medium shrink-0">{issue.identifier}</span>
      <IssueTypeBadge type={issue.type} />
      <PriorityBadge priority={issue.priority} />
      <span className="text-xs text-primary truncate flex-1">{issue.title}</span>
      {typeof issue.estimate === 'number' && (
        <span className="text-[11px] text-tertiary tabular-nums shrink-0">{issue.estimate} pts</span>
      )}
    </div>
  );
};

/**
 * Panel de dos columnas para armar el scope de un ciclo antes (o durante) de
 * arrancarlo: arrastrar/quitar en bulk, y reordenar prioridad soltando un
 * issue del ciclo sobre otro (adopta la prioridad del destino — no hay un
 * campo de posición persistido, así que la prioridad es el único orden real
 * que se puede guardar).
 */
export const CyclePlanningPanel: React.FC<CyclePlanningPanelProps> = ({
  cycle,
  cycleIssues,
  backlogIssues,
  editable,
}) => {
  const updateIssue = useIssueStore((s) => s.updateIssue);
  const [inCycleSelected, setInCycleSelected] = useState<string[]>([]);
  const [backlogSelected, setBacklogSelected] = useState<string[]>([]);
  const [dragOverColumn, setDragOverColumn] = useState<'cycle' | 'backlog' | null>(null);

  const toggleIn = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const addToCycle = (id: string) => updateIssue(id, { cycleId: cycle.id });
  const removeFromCycle = (id: string) => updateIssue(id, { cycleId: undefined });
  const setPriority = (id: string, priority: IssuePriority) => updateIssue(id, { priority });

  const handleBulkAdd = () => {
    backlogSelected.forEach(addToCycle);
    setBacklogSelected([]);
  };

  const handleBulkRemove = () => {
    inCycleSelected.forEach(removeFromCycle);
    setInCycleSelected([]);
  };

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-primary">Planeación del ciclo</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Columna izquierda: issues del ciclo */}
        <div
          onDragOver={(e) => {
            if (!editable) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDragOverColumn('cycle');
          }}
          onDragLeave={() => setDragOverColumn((c) => (c === 'cycle' ? null : c))}
          onDrop={(e) => {
            if (!editable) return;
            e.preventDefault();
            setDragOverColumn(null);
            const id = e.dataTransfer.getData('text/plain');
            if (id) addToCycle(id);
          }}
          className={cn(
            'flex flex-col bg-surface border rounded-xl overflow-hidden transition-colors',
            dragOverColumn === 'cycle' ? 'border-accent bg-accent/5' : 'border-default'
          )}
        >
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-subtle bg-elevated">
            <span className="text-xs font-semibold text-primary">
              En este ciclo ({cycleIssues.length})
            </span>
            {editable && inCycleSelected.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                icon={<ArrowRight className="w-3.5 h-3.5" />}
                onClick={handleBulkRemove}
              >
                Quitar ({inCycleSelected.length})
              </Button>
            )}
          </div>
          <div className="flex flex-col min-h-[120px] max-h-96 overflow-y-auto">
            {cycleIssues.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1.5 p-6 text-center text-xs text-tertiary">
                <ArrowLeftRight className="w-4 h-4" />
                Arrastrá issues del backlog para sumarlos al ciclo
              </div>
            ) : (
              cycleIssues.map((issue) => (
                <PlanningRow
                  key={issue.id}
                  issue={issue}
                  draggable={editable}
                  checked={inCycleSelected.includes(issue.id)}
                  onToggle={() => setInCycleSelected((prev) => toggleIn(prev, issue.id))}
                  onDropOnRow={
                    editable
                      ? (draggedId) => {
                          setPriority(draggedId, issue.priority);
                          addToCycle(draggedId);
                        }
                      : undefined
                  }
                />
              ))
            )}
          </div>
        </div>

        {/* Columna derecha: backlog del equipo, sin ciclo */}
        <div
          onDragOver={(e) => {
            if (!editable) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDragOverColumn('backlog');
          }}
          onDragLeave={() => setDragOverColumn((c) => (c === 'backlog' ? null : c))}
          onDrop={(e) => {
            if (!editable) return;
            e.preventDefault();
            setDragOverColumn(null);
            const id = e.dataTransfer.getData('text/plain');
            if (id) removeFromCycle(id);
          }}
          className={cn(
            'flex flex-col bg-surface border rounded-xl overflow-hidden transition-colors',
            dragOverColumn === 'backlog' ? 'border-accent bg-accent/5' : 'border-default'
          )}
        >
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-subtle bg-elevated">
            <span className="text-xs font-semibold text-primary">
              Backlog del equipo ({backlogIssues.length})
            </span>
            {editable && backlogSelected.length > 0 && (
              <Button size="sm" variant="secondary" onClick={handleBulkAdd}>
                Agregar ({backlogSelected.length})
              </Button>
            )}
          </div>
          <div className="flex flex-col min-h-[120px] max-h-96 overflow-y-auto">
            {backlogIssues.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1.5 p-6 text-center text-xs text-tertiary">
                <Inbox className="w-4 h-4" />
                No hay issues sin ciclo en este equipo
              </div>
            ) : (
              backlogIssues.map((issue) => (
                <PlanningRow
                  key={issue.id}
                  issue={issue}
                  draggable={editable}
                  checked={backlogSelected.includes(issue.id)}
                  onToggle={() => setBacklogSelected((prev) => toggleIn(prev, issue.id))}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
