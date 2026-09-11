'use client';

import React, { useState } from 'react';
import { Issue, IssueStatus } from '@/types';
import { useIssues } from '@/hooks/useIssues';
import { useIssueStore } from '@/stores/issueStore';
import { useAppStore } from '@/stores/appStore';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { IssueTypeBadge } from './IssueTypeBadge';
import { EpicProgress } from './EpicProgress';
import { progressOf } from '@/lib/hierarchy';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { getStatusLabel, cn } from '@/lib/utils';
import { Plus, GripVertical, Trash2, ChevronDown } from 'lucide-react';

const COLUMNS: IssueStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'canceled'];

export const IssueBoard: React.FC = () => {
  const { issuesByStatus, issuesByEpic, epics } = useIssues();
  const boardGroupBy = useAppStore((s) => s.boardGroupBy);
  const setPeekIssueId = useIssueStore((s) => s.setPeekIssueId);
  const setSelectedIssueId = useIssueStore((s) => s.setSelectedIssueId);
  const updateIssue = useIssueStore((s) => s.updateIssue);
  const deleteIssue = useIssueStore((s) => s.deleteIssue);
  const setCreateIssueOpen = useAppStore((s) => s.setCreateIssueOpen);
  const members = useAppStore((s) => s.members);
  // Sin filtrar, igual que en IssueList: el progreso describe el árbol real,
  // no el subconjunto que el filtro activo deja ver.
  const allIssues = useIssueStore((s) => s.issues);
  const issuesLoaded = useIssueStore((s) => s.issuesLoaded);
  const issuesError = useIssueStore((s) => s.issuesError);

  const [draggedIssueId, setDraggedIssueId] = useState<string | null>(null);
  const [collapsedLanes, setCollapsedLanes] = useState<string[]>([]);
  // La clave incluye la lane además del estado: con swimlanes por épica hay
  // una columna "Por hacer" por cada épica, y una clave que fuera solo el
  // estado las resaltaría todas a la vez al arrastrar sobre una.
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  if (issuesError) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-priority-urgent/40 bg-priority-urgent/5 rounded-lg my-6">
        <p className="text-priority-urgent text-sm">{issuesError}</p>
      </div>
    );
  }

  if (!issuesLoaded) {
    return (
      <div className="flex gap-4 overflow-x-auto flex-nowrap pb-6 pt-2 px-1">
        {COLUMNS.map((status) => (
          <div
            key={status}
            className="w-[85vw] sm:w-72 shrink-0 flex flex-col bg-surface border border-subtle rounded-xl overflow-hidden"
          >
            <div className="px-3.5 py-3 border-b border-subtle bg-elevated">
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="p-2.5 flex flex-col gap-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const toggleLane = (laneId: string) =>
    setCollapsedLanes((prev) =>
      prev.includes(laneId) ? prev.filter((id) => id !== laneId) : [...prev, laneId]
    );

  const handleDragStart = (e: React.DragEvent, issueId: string) => {
    e.dataTransfer.setData('text/plain', issueId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedIssueId(issueId);
  };

  const handleDragEnd = () => {
    setDraggedIssueId(null);
    setDragOverKey(null);
  };

  const handleDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverKey !== key) {
      setDragOverKey(key);
    }
  };

  const handleDragLeave = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    if (dragOverKey === key) {
      setDragOverKey(null);
    }
  };

  /**
   * Soltar una card solo cambia el estado, también en la vista por épicas.
   * Que además reasignara la épica sería el gesto "natural", pero no siempre es
   * legal (una sub-tarea cuelga de una historia, no de una épica) y ejecutar la
   * mitad del gesto en silencio confunde más de lo que ayuda: mover de épica se
   * hace desde el panel del issue, que valida y avisa.
   */
  const handleDrop = (e: React.DragEvent, targetStatus: IssueStatus) => {
    e.preventDefault();
    const issueId = e.dataTransfer.getData('text/plain') || draggedIssueId;
    if (issueId) {
      updateIssue(issueId, { status: targetStatus });
    }
    setDraggedIssueId(null);
    setDragOverKey(null);
  };

  const renderLane = (laneId: string, byStatus: Record<string, Issue[]>, minHeight: string) => (
    <div
      className={cn(
        'flex gap-4 overflow-x-auto snap-x snap-mandatory flex-nowrap pb-6 pt-2 scrollbar-none px-1',
        minHeight
      )}
    >
      {COLUMNS.map((status) => {
        const columnIssues = byStatus[status] || [];
        const dragKey = `${laneId}::${status}`;
        const isDragTarget = dragOverKey === dragKey;

        return (
          <div
            key={status}
            onDragOver={(e) => handleDragOver(e, dragKey)}
            onDragLeave={(e) => handleDragLeave(e, dragKey)}
            onDrop={(e) => handleDrop(e, status)}
            className={cn(
              'w-[85vw] sm:w-72 shrink-0 snap-center flex flex-col bg-surface border rounded-xl overflow-hidden max-h-[calc(100vh-160px)] transition-all duration-150',
              isDragTarget
                ? 'border-accent bg-accent/5 shadow-lg shadow-accent/10 scale-[1.01]'
                : 'border-subtle'
            )}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between px-3.5 py-3 border-b border-subtle bg-elevated">
              <div className="flex items-center gap-2">
                <StatusBadge status={status} />
                <span className="font-semibold text-xs text-primary">
                  {getStatusLabel(status)}
                </span>
                <span className="text-xs text-tertiary font-mono">
                  {columnIssues.length}
                </span>
              </div>

              <button
                onClick={() => setCreateIssueOpen(true)}
                className="text-secondary hover:text-primary p-1 rounded hover:bg-hover transition-colors"
                title="Añadir issue"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Column Drop Zone */}
            <div className="p-2.5 flex flex-col gap-2 overflow-y-auto flex-1 min-h-[150px]">
              {columnIssues.length === 0 ? (
                <div
                  className={cn(
                    'p-6 text-center text-xs border border-dashed rounded-lg transition-colors flex flex-col items-center justify-center gap-1 select-none',
                    isDragTarget
                      ? 'border-accent text-accent bg-accent/10 font-medium'
                      : 'border-subtle text-tertiary'
                  )}
                >
                  {isDragTarget ? 'Soltar aquí' : 'Arrastra un issue aquí'}
                </div>
              ) : (
                columnIssues.map((issue) => {
                  const assignee = members.find((m) => m.userId === issue.assigneeId);
                  const isBeingDragged = draggedIssueId === issue.id;

                  return (
                    <div
                      key={issue.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, issue.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => {
                        setSelectedIssueId(issue.id);
                        setPeekIssueId(issue.id);
                      }}
                      className={cn(
                        'group flex flex-col gap-2 p-3.5 sm:p-3 bg-elevated hover:bg-hover border border-default hover:border-strong rounded-lg cursor-grab active:cursor-grabbing transition-all shadow-sm select-none',
                        isBeingDragged && 'opacity-30 border-dashed border-accent'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <GripVertical className="w-3 h-3 text-tertiary opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
                          <span className="font-mono text-[11px] text-tertiary font-medium truncate">
                            {issue.identifier}
                          </span>
                          <IssueTypeBadge type={issue.type} />
                        </div>

                        <div className="flex items-center gap-1.5">
                          {progressOf(allIssues, issue).total > 0 && (
                            <EpicProgress
                              progress={progressOf(allIssues, issue)}
                              variant="inline"
                            />
                          )}
                          <PriorityBadge priority={issue.priority} />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteIssue(issue.id);
                            }}
                            className="p-1 text-tertiary hover:text-priority-urgent opacity-100 sm:opacity-0 group-hover:opacity-100 hover:bg-priority-urgent/10 rounded transition-all"
                            title="Eliminar issue"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-primary font-medium line-clamp-2 leading-relaxed">
                        {issue.title}
                      </p>

                      <div className="flex items-center justify-between pt-1 border-t border-subtle mt-1">
                        <div className="flex items-center gap-1">
                          {issue.labelIds && issue.labelIds[0] && (
                            <span className="text-[10px] text-secondary bg-hover px-1.5 py-0.5 rounded border border-default">
                              {issue.labelIds[0]}
                            </span>
                          )}
                        </div>

                        <Avatar
                          name={assignee?.displayName}
                          src={assignee?.photoURL}
                          size="sm"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  if (boardGroupBy === 'status') {
    return renderLane('all', issuesByStatus, 'min-h-[calc(100vh-140px)]');
  }

  // --- Swimlanes por épica ---------------------------------------------
  // Una lane por épica con issues visibles, más una final para lo que no
  // cuelga de ninguna. Las épicas sin nada dentro no generan lane: seis
  // columnas vacías por épica vacía no informan nada y empujan el resto
  // fuera de la pantalla.
  const lanes: { id: string; epic: Issue | null; issues: Issue[] }[] = [
    ...epics
      .filter(({ epic }) => (issuesByEpic.get(epic.id) || []).length > 0)
      .map(({ epic }) => ({
        id: epic.id,
        epic,
        issues: issuesByEpic.get(epic.id) || [],
      })),
  ];

  const orphans = issuesByEpic.get('') || [];
  if (orphans.length > 0) {
    lanes.push({ id: 'none', epic: null, issues: orphans });
  }

  if (lanes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-default rounded-lg my-6">
        <p className="text-secondary text-sm">No hay issues para agrupar por épica</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {lanes.map((lane) => {
        const collapsed = collapsedLanes.includes(lane.id);
        const byStatus: Record<string, Issue[]> = {};
        COLUMNS.forEach((s) => {
          byStatus[s] = lane.issues.filter((i) => i.status === s);
        });

        return (
          <section key={lane.id} className="flex flex-col">
            <button
              onClick={() => toggleLane(lane.id)}
              className="flex items-center gap-2.5 px-2 py-2.5 text-left hover:bg-elevated rounded-lg transition-colors group"
            >
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-tertiary transition-transform shrink-0',
                  collapsed && '-rotate-90'
                )}
              />
              {lane.epic ? (
                <>
                  <IssueTypeBadge type="epic" />
                  <span className="font-mono text-[11px] text-tertiary shrink-0">
                    {lane.epic.identifier}
                  </span>
                  <span className="text-sm font-semibold text-primary truncate">
                    {lane.epic.title}
                  </span>
                  <EpicProgress
                    progress={progressOf(allIssues, lane.epic)}
                    variant="inline"
                    className="ml-1"
                  />
                </>
              ) : (
                <span className="text-sm font-semibold text-secondary">Sin épica</span>
              )}
              <span className="ml-auto font-mono text-[11px] text-tertiary tabular-nums shrink-0">
                {lane.issues.length}
              </span>
            </button>

            {!collapsed && renderLane(lane.id, byStatus, 'min-h-[200px]')}
          </section>
        );
      })}
    </div>
  );
};
