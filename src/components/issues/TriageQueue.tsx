'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Copy, XCircle, FolderInput, Loader2, FolderKanban, UserX } from 'lucide-react';
import { useIssueStore } from '@/stores/issueStore';
import { useProjectStore } from '@/stores/projectStore';
import { useTriageIssues } from '@/hooks/useTriageIssues';
import { duplicateIssue } from '@/lib/firestore';
import { validParentsFor } from '@/lib/hierarchy';
import { IssueTypeBadge } from './IssueTypeBadge';
import { PriorityBadge } from './PriorityBadge';
import { SelectPopover } from '@/components/ui/SelectPopover';
import { Skeleton } from '@/components/ui/Skeleton';
import { Issue, IssuePriority, ISSUE_PRIORITIES } from '@/types';
import { formatTimeAgo, cn } from '@/lib/utils';

type PanelKind = 'accept' | 'move';
interface OpenPanel {
  issueId: string;
  kind: PanelKind;
}

/** Panel inline para "Aceptar": elige proyecto y prioridad antes de confirmar. */
function AcceptPanel({
  issue,
  onConfirm,
  onCancel,
}: {
  issue: Issue;
  onConfirm: (updates: { projectId?: string; priority: IssuePriority }) => void;
  onCancel: () => void;
}) {
  const projects = useProjectStore((s) => s.projects);
  const [projectId, setProjectId] = useState(issue.projectId || '');
  const [priority, setPriority] = useState<IssuePriority>(issue.priority);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="flex flex-col gap-2.5 p-3 bg-elevated border border-accent/30 rounded-lg"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-secondary shrink-0">Proyecto</span>
        <SelectPopover
          value={projectId}
          onChange={setProjectId}
          ariaLabel="Proyecto"
          placeholder="Sin proyecto"
          className="max-w-[70%]"
          options={projects.map((p) => ({ value: p.id, label: p.name }))}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-secondary shrink-0">Prioridad</span>
        <SelectPopover
          value={String(priority)}
          onChange={(v) => setPriority(parseInt(v, 10) as IssuePriority)}
          ariaLabel="Prioridad"
          className="max-w-[70%]"
          options={ISSUE_PRIORITIES.map((p) => ({ value: String(p.value), label: `${p.value} - ${p.label}` }))}
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-2.5 py-1 text-xs text-secondary hover:text-primary rounded-md hover:bg-hover transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={() => onConfirm({ projectId: projectId || undefined, priority })}
          className="px-2.5 py-1 text-xs font-medium bg-accent hover:bg-accent-hover text-white rounded-md transition-colors"
        >
          Confirmar
        </button>
      </div>
    </div>
  );
}

/** Panel inline para "Mover": convierte el issue en sub-issue de otro. */
function MovePanel({
  issue,
  allIssues,
  onConfirm,
  onCancel,
}: {
  issue: Issue;
  allIssues: Issue[];
  onConfirm: (parentId: string) => void;
  onCancel: () => void;
}) {
  const parentOptions = useMemo(
    () => validParentsFor(allIssues, issue.type ?? 'task', issue.id),
    [allIssues, issue]
  );
  const [parentId, setParentId] = useState(issue.parentId || '');

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="flex flex-col gap-2.5 p-3 bg-elevated border border-accent/30 rounded-lg"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-secondary shrink-0">Convertir en sub-issue de</span>
        <SelectPopover
          value={parentId}
          onChange={setParentId}
          disabled={parentOptions.length === 0}
          ariaLabel="Padre"
          placeholder={parentOptions.length === 0 ? 'No hay destinos disponibles' : 'Elegir issue'}
          className="max-w-[70%]"
          options={parentOptions.map((p) => ({ value: p.id, label: `${p.identifier} · ${p.title}` }))}
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-2.5 py-1 text-xs text-secondary hover:text-primary rounded-md hover:bg-hover transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={() => parentId && onConfirm(parentId)}
          disabled={!parentId}
          className="px-2.5 py-1 text-xs font-medium bg-accent hover:bg-accent-hover text-white rounded-md disabled:opacity-50 disabled:pointer-events-none transition-colors"
        >
          Mover
        </button>
      </div>
    </div>
  );
}

interface TriageRowProps {
  issue: Issue;
  isFocused: boolean;
  busy: boolean;
  openPanel: PanelKind | null;
  allIssues: Issue[];
  onFocus: () => void;
  onOpenPanel: (kind: PanelKind) => void;
  onClosePanel: () => void;
  onAccept: (updates: { projectId?: string; priority: IssuePriority }) => void;
  onDiscard: () => void;
  onDuplicate: () => void;
  onMove: (parentId: string) => void;
}

const TriageRow: React.FC<TriageRowProps> = ({
  issue,
  isFocused,
  busy,
  openPanel,
  allIssues,
  onFocus,
  onOpenPanel,
  onClosePanel,
  onAccept,
  onDiscard,
  onDuplicate,
  onMove,
}) => {
  return (
    <div
      onClick={onFocus}
      tabIndex={0}
      className={cn(
        'flex flex-col gap-2.5 p-3.5 rounded-xl border transition-colors cursor-pointer select-none',
        isFocused ? 'bg-elevated border-accent/40 shadow-sm' : 'bg-surface border-subtle hover:border-default'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <IssueTypeBadge type={issue.type} />
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[11px] text-tertiary shrink-0">{issue.identifier}</span>
              <span className="text-sm text-primary font-medium truncate">{issue.title}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {!issue.projectId && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-hover text-tertiary">
                  <FolderKanban className="w-3 h-3" /> Sin proyecto
                </span>
              )}
              {!issue.assigneeId && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-hover text-tertiary">
                  <UserX className="w-3 h-3" /> Sin asignar
                </span>
              )}
              <span className="text-[10px] text-tertiary font-mono">{formatTimeAgo(issue.createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <PriorityBadge priority={issue.priority} />
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 text-tertiary animate-spin mx-1" />
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPanel('accept');
                }}
                title="Aceptar (A)"
                className="p-1.5 text-tertiary hover:text-status-done hover:bg-status-done/10 rounded-md transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPanel('move');
                }}
                title="Mover (M)"
                className="p-1.5 text-tertiary hover:text-primary hover:bg-hover rounded-md transition-colors"
              >
                <FolderInput className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate();
                }}
                title="Duplicar"
                className="p-1.5 text-tertiary hover:text-primary hover:bg-hover rounded-md transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDiscard();
                }}
                title="Descartar (X)"
                className="p-1.5 text-tertiary hover:text-priority-urgent hover:bg-priority-urgent/10 rounded-md transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {openPanel === 'accept' && <AcceptPanel issue={issue} onConfirm={onAccept} onCancel={onClosePanel} />}
      {openPanel === 'move' && (
        <MovePanel issue={issue} allIssues={allIssues} onConfirm={onMove} onCancel={onClosePanel} />
      )}
    </div>
  );
};

export const TriageQueue: React.FC = () => {
  const { issues, loaded, error } = useTriageIssues();
  const allIssues = useIssueStore((s) => s.issues);
  const updateIssue = useIssueStore((s) => s.updateIssue);
  const moveIssue = useIssueStore((s) => s.moveIssue);

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<OpenPanel | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Foco derivado, no corregido con un setState en un efecto: si el issue
  // enfocado ya no está en la cola (se aceptó, se descartó), el foco efectivo
  // pasa al primero sin un render extra.
  const focused = focusedId && issues.some((i) => i.id === focusedId) ? focusedId : (issues[0]?.id ?? null);

  const handleAccept = async (id: string, updates: { projectId?: string; priority: IssuePriority }) => {
    setOpenPanel(null);
    setBusyId(id);
    try {
      await updateIssue(id, updates);
    } catch {
      // updateIssue ya muestra el toast de error
    } finally {
      setBusyId(null);
    }
  };

  const handleDiscard = async (id: string) => {
    setBusyId(id);
    try {
      await updateIssue(id, { status: 'canceled' });
    } catch {
      // updateIssue ya muestra el toast de error
    } finally {
      setBusyId(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    setBusyId(id);
    try {
      await duplicateIssue(id);
      toast.success('Issue duplicado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo duplicar el issue.');
    } finally {
      setBusyId(null);
    }
  };

  const handleMove = async (id: string, parentId: string) => {
    setOpenPanel(null);
    setBusyId(id);
    try {
      await moveIssue(id, parentId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo mover el issue.');
    } finally {
      setBusyId(null);
    }
  };

  // Atajos tipo Linear (A aceptar, X descartar, M mover) sobre la fila con foco.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (!focused) return;

      const idx = issues.findIndex((i) => i.id === focused);
      const key = e.key.toLowerCase();

      if (key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (idx < issues.length - 1) setFocusedId(issues[idx + 1].id);
      } else if (key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (idx > 0) setFocusedId(issues[idx - 1].id);
      } else if (key === 'a') {
        e.preventDefault();
        setOpenPanel({ issueId: focused, kind: 'accept' });
      } else if (key === 'x') {
        e.preventDefault();
        handleDiscard(focused);
      } else if (key === 'm') {
        e.preventDefault();
        setOpenPanel({ issueId: focused, kind: 'move' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, issues]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-priority-urgent/40 bg-priority-urgent/5 rounded-lg">
        <p className="text-priority-urgent text-sm">{error}</p>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-default rounded-lg">
        <p className="text-secondary text-sm">No hay issues pendientes de triage.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {issues.map((issue) => (
        <TriageRow
          key={issue.id}
          issue={issue}
          isFocused={focused === issue.id}
          busy={busyId === issue.id}
          openPanel={openPanel?.issueId === issue.id ? openPanel.kind : null}
          allIssues={allIssues}
          onFocus={() => setFocusedId(issue.id)}
          onOpenPanel={(kind) => setOpenPanel({ issueId: issue.id, kind })}
          onClosePanel={() => setOpenPanel(null)}
          onAccept={(updates) => handleAccept(issue.id, updates)}
          onDiscard={() => handleDiscard(issue.id)}
          onDuplicate={() => handleDuplicate(issue.id)}
          onMove={(parentId) => handleMove(issue.id, parentId)}
        />
      ))}
    </div>
  );
};
