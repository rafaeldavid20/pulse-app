'use client';

import React from 'react';
import { Issue, IssueStatus } from '@/types';
import { useIssueStore } from '@/stores/issueStore';
import { useAppStore } from '@/stores/appStore';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { IssueTypeBadge } from './IssueTypeBadge';
import { EpicProgress } from './EpicProgress';
import { progressOf } from '@/lib/hierarchy';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate, cn } from '@/lib/utils';
import { Trash2, CheckCircle2, X } from 'lucide-react';

interface IssueListProps {
  issues: Issue[];
}

export const IssueList: React.FC<IssueListProps> = ({ issues }) => {
  const issuesLoaded = useIssueStore((s) => s.issuesLoaded);
  const issuesError = useIssueStore((s) => s.issuesError);
  const selectedIssueId = useIssueStore((s) => s.selectedIssueId);
  const selectedIssueIds = useIssueStore((s) => s.selectedIssueIds);
  const setSelectedIssueId = useIssueStore((s) => s.setSelectedIssueId);
  const setPeekIssueId = useIssueStore((s) => s.setPeekIssueId);
  const toggleIssueSelection = useIssueStore((s) => s.toggleIssueSelection);
  const clearSelection = useIssueStore((s) => s.clearSelection);
  const deleteIssue = useIssueStore((s) => s.deleteIssue);
  const bulkUpdateStatus = useIssueStore((s) => s.bulkUpdateStatus);
  const members = useAppStore((s) => s.members);
  // El árbol se calcula sobre todos los issues del workspace, no sobre los
  // filtrados: una épica no debería mostrar 2/2 solo porque el filtro activo
  // esconde la mitad de sus hijos.
  const allIssues = useIssueStore((s) => s.issues);

  const handleBulkDelete = () => {
    selectedIssueIds.forEach((id) => deleteIssue(id));
    clearSelection();
  };

  if (issuesError) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-priority-urgent/40 bg-priority-urgent/5 rounded-lg my-6">
        <p className="text-priority-urgent text-sm">{issuesError}</p>
      </div>
    );
  }

  if (!issuesLoaded) {
    return (
      <div className="w-full flex flex-col border border-subtle rounded-lg overflow-hidden bg-surface">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3.5 py-3 border-b border-subtle last:border-b-0"
          >
            <Skeleton className="h-3.5 w-14 shrink-0" />
            <Skeleton className="h-4 w-4 rounded-full shrink-0" />
            <Skeleton className="h-4 w-14 rounded-full shrink-0" />
            <Skeleton className="h-4 flex-1 max-w-sm" />
          </div>
        ))}
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-default rounded-lg my-6">
        <p className="text-secondary text-sm mb-2">No se encontraron issues</p>
        <p className="text-tertiary text-xs">
          Presiona <kbd className="bg-hover px-1.5 py-0.5 rounded border border-default text-primary">C</kbd> para crear un nuevo issue
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col border border-subtle rounded-lg overflow-hidden bg-surface relative">
      {/* Floating Bulk Action Bar */}
      {selectedIssueIds.length > 0 && (
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-2.5 bg-accent/15 border-b border-accent/30 backdrop-blur-md animate-fade-in-scale">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-primary">
              {selectedIssueIds.length} {selectedIssueIds.length === 1 ? 'issue seleccionado' : 'issues seleccionados'}
            </span>
            <button
              onClick={clearSelection}
              className="text-xs text-secondary hover:text-primary underline"
            >
              Desmarcar
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => bulkUpdateStatus(selectedIssueIds, 'done')}
            >
              Marcar Completados
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={handleBulkDelete}
            >
              Eliminar
            </Button>
          </div>
        </div>
      )}

      {/* Rows */}
      {issues.map((issue) => {
        const isFocused = selectedIssueId === issue.id;
        const isChecked = selectedIssueIds.includes(issue.id);
        const assignee = members.find((m) => m.userId === issue.assigneeId);

        return (
          <div
            key={issue.id}
            onClick={() => {
              setSelectedIssueId(issue.id);
              setPeekIssueId(issue.id);
            }}
            className={cn(
              'group relative flex items-center justify-between px-3.5 py-2.5 border-b border-subtle last:border-b-0 cursor-pointer transition-colors select-none text-sm',
              isFocused ? 'bg-hover' : 'hover:bg-elevated',
              isChecked && 'bg-accent/10'
            )}
          >
            {/* Keyboard Focus Indicator Line */}
            {isFocused && (
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent" />
            )}

            {/* Left Side: Checkbox, Identifier, Priority, Status, Title */}
            <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleIssueSelection(issue.id);
                }}
                className="w-3.5 h-3.5 rounded border-default bg-elevated text-accent focus:ring-0 accent-accent cursor-pointer opacity-0 group-hover:opacity-100 checked:opacity-100 transition-opacity"
              />

              <span className="font-mono text-xs text-tertiary font-medium min-w-[64px] shrink-0">
                {issue.identifier}
              </span>

              <IssueTypeBadge type={issue.type} />

              <PriorityBadge priority={issue.priority} />

              <StatusBadge status={issue.status} />

              <span className="text-primary font-normal truncate">
                {issue.title}
              </span>

              {/* Progreso solo cuando hay algo colgando: una fila sin hijos no
                  gana nada mostrando una barra vacía. */}
              {progressOf(allIssues, issue).total > 0 && (
                <EpicProgress progress={progressOf(allIssues, issue)} variant="inline" />
              )}
            </div>

            {/* Right Side: Labels, Due Date, Assignee Avatar, Trash Delete Button */}
            <div className="flex items-center gap-3 shrink-0">
              {issue.labelIds && issue.labelIds.length > 0 && (
                <div className="hidden md:flex items-center gap-1">
                  {issue.labelIds.map((labelId) => (
                    <Badge key={labelId} variant="subtle" className="text-[11px] px-1.5 py-0">
                      {labelId}
                    </Badge>
                  ))}
                </div>
              )}

              {issue.dueDate && (
                <span className="text-xs text-tertiary hidden sm:inline">
                  {formatDate(issue.dueDate)}
                </span>
              )}

              <Avatar
                name={assignee?.displayName}
                src={assignee?.photoURL}
                size="sm"
              />

              {/* Quick Delete Row Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteIssue(issue.id);
                }}
                className="p-1 text-tertiary hover:text-priority-urgent opacity-0 group-hover:opacity-100 hover:bg-priority-urgent/10 rounded transition-all"
                title="Eliminar issue"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
