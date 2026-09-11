'use client';

import React, { useMemo } from 'react';
import { Issue } from '@/types';
import { useIssueStore } from '@/stores/issueStore';
import { useAppStore } from '@/stores/appStore';
import { useProjectStore } from '@/stores/projectStore';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { IssueTypeBadge } from './IssueTypeBadge';
import { EpicProgress } from './EpicProgress';
import { progressOf, isEpic } from '@/lib/hierarchy';
import { applyIssueFilters, sortIssues, groupIssues } from '@/lib/issueFilters';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { useLabelStore } from '@/stores/labelStore';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate, cn } from '@/lib/utils';
import { Trash2 } from 'lucide-react';

interface IssueListProps {
  /** Universo base de issues (equipo, proyecto, "mis issues"...). La barra de
   *  filtros, la agrupación y el orden se aplican acá adentro, no en el caller. */
  issues: Issue[];
}

interface IssueRowProps {
  issue: Issue;
  isFocused: boolean;
  isChecked: boolean;
  assigneeName?: string;
  assigneePhoto?: string;
  labelsById: Record<string, { name: string; color: string }>;
  allIssues: Issue[];
  onOpen: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

const IssueRow: React.FC<IssueRowProps> = ({
  issue,
  isFocused,
  isChecked,
  assigneeName,
  assigneePhoto,
  labelsById,
  allIssues,
  onOpen,
  onToggleSelect,
  onDelete,
}) => (
  <div
    onClick={() => onOpen(issue.id)}
    className={cn(
      'group relative flex items-center justify-between px-3.5 py-2.5 border-b border-subtle last:border-b-0 cursor-pointer transition-colors select-none text-sm',
      isFocused ? 'bg-hover' : 'hover:bg-elevated',
      isChecked && 'bg-accent/10'
    )}
  >
    {/* Keyboard Focus Indicator Line */}
    {isFocused && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent" />}

    {/* Left Side: Checkbox, Identifier, Priority, Status, Title */}
    <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
      <input
        type="checkbox"
        checked={isChecked}
        onChange={(e) => {
          e.stopPropagation();
          onToggleSelect(issue.id);
        }}
        className="w-3.5 h-3.5 rounded border-default bg-elevated text-accent focus:ring-0 accent-accent cursor-pointer opacity-0 group-hover:opacity-100 checked:opacity-100 transition-opacity"
      />

      <span className="font-mono text-xs text-tertiary font-medium min-w-[64px] shrink-0">
        {issue.identifier}
      </span>

      <IssueTypeBadge type={issue.type} />

      <PriorityBadge priority={issue.priority} />

      <StatusBadge status={issue.status} />

      <span className="text-primary font-normal truncate">{issue.title}</span>

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
            <Badge key={labelId} variant="subtle" className="text-[11px] px-1.5 py-0" color={labelsById[labelId]?.color}>
              {labelsById[labelId]?.name ?? labelId}
            </Badge>
          ))}
        </div>
      )}

      {issue.dueDate && (
        <span className="text-xs text-tertiary hidden sm:inline">{formatDate(issue.dueDate)}</span>
      )}

      <Avatar name={assigneeName} src={assigneePhoto} size="sm" />

      {/* Quick Delete Row Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(issue.id);
        }}
        className="p-1 text-tertiary hover:text-priority-urgent opacity-0 group-hover:opacity-100 hover:bg-priority-urgent/10 rounded transition-all"
        title="Eliminar issue"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

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
  const filterState = useAppStore((s) => s.filterState);
  const sortBy = useAppStore((s) => s.sortBy);
  const groupBy = useAppStore((s) => s.groupBy);
  const projects = useProjectStore((s) => s.projects);
  // El árbol se calcula sobre todos los issues del workspace, no sobre los
  // filtrados: una épica no debería mostrar 2/2 solo porque el filtro activo
  // esconde la mitad de sus hijos.
  const allIssues = useIssueStore((s) => s.issues);
  // Los issues guardan ids de etiqueta; mostrar el id crudo ("lbl-XXXX") no le
  // dice nada a nadie. Los ids viejos que no son etiquetas ("feature") se
  // muestran tal cual.
  const labels = useLabelStore((s) => s.labels);
  const labelsById = Object.fromEntries(labels.map((l) => [l.id, l]));

  const epicsById = useMemo(() => {
    const map: Record<string, Issue> = {};
    allIssues.forEach((i) => {
      if (isEpic(i)) map[i.id] = i;
    });
    return map;
  }, [allIssues]);

  const groups = useMemo(() => {
    const filtered = applyIssueFilters(issues, filterState);
    const sorted = sortIssues(filtered, sortBy);
    return groupIssues(sorted, groupBy, { members, projects, epicsById });
  }, [issues, filterState, sortBy, groupBy, members, projects, epicsById]);

  const totalVisible = groups.reduce((sum, g) => sum + g.issues.length, 0);

  const handleBulkDelete = () => {
    selectedIssueIds.forEach((id) => deleteIssue(id));
    clearSelection();
  };

  const handleOpen = (id: string) => {
    setSelectedIssueId(id);
    setPeekIssueId(id);
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

  if (totalVisible === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-default rounded-lg my-6">
        <p className="text-secondary text-sm mb-2">No se encontraron issues</p>
        <p className="text-tertiary text-xs">
          Presiona <kbd className="bg-hover px-1.5 py-0.5 rounded border border-default text-primary">C</kbd> para crear un nuevo issue
        </p>
      </div>
    );
  }

  const renderRows = (rows: Issue[]) =>
    rows.map((issue) => {
      const assignee = members.find((m) => m.userId === issue.assigneeId);
      return (
        <IssueRow
          key={issue.id}
          issue={issue}
          isFocused={selectedIssueId === issue.id}
          isChecked={selectedIssueIds.includes(issue.id)}
          assigneeName={assignee?.displayName}
          assigneePhoto={assignee?.photoURL}
          labelsById={labelsById}
          allIssues={allIssues}
          onOpen={handleOpen}
          onToggleSelect={toggleIssueSelection}
          onDelete={deleteIssue}
        />
      );
    });

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Floating Bulk Action Bar */}
      {selectedIssueIds.length > 0 && (
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-2.5 bg-accent/15 border border-accent/30 rounded-lg backdrop-blur-md animate-fade-in-scale">
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

      {groupBy === 'none' ? (
        <div className="w-full flex flex-col border border-subtle rounded-lg overflow-hidden bg-surface">
          {renderRows(groups[0]?.issues ?? [])}
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-1">
              <h3 className="text-xs font-semibold text-secondary uppercase tracking-wide">
                {group.label}
              </h3>
              <span className="font-mono text-[11px] text-tertiary tabular-nums">
                {group.issues.length}
              </span>
            </div>
            <div className="w-full flex flex-col border border-subtle rounded-lg overflow-hidden bg-surface">
              {renderRows(group.issues)}
            </div>
          </section>
        ))
      )}
    </div>
  );
};
