'use client';

import React, { useMemo } from 'react';
import { Issue, IssueListColumn, IssueListDensity, IssuePriority, IssueStatus, Member, Project } from '@/types';
import { useIssueStore } from '@/stores/issueStore';
import { useAppStore } from '@/stores/appStore';
import { useProjectStore } from '@/stores/projectStore';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { IssueTypeBadge } from './IssueTypeBadge';
import { EpicProgress } from './EpicProgress';
import { progressOf, isEpic } from '@/lib/hierarchy';
import { applyIssueFilters, sortIssues, groupIssues } from '@/lib/issueFilters';
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from '@/lib/constants/issue';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { useLabelStore } from '@/stores/labelStore';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate, cn } from '@/lib/utils';
import { FolderKanban, Trash2, Zap } from 'lucide-react';

interface IssueListProps {
  /** Universo base de issues (equipo, proyecto, "mis issues"...). La barra de
   *  filtros, la agrupación y el orden se aplican acá adentro, no en el caller. */
  issues: Issue[];
}

interface QuickSelectOption {
  value: string;
  label: string;
}

interface QuickSelectProps {
  value: string;
  title: string;
  options: QuickSelectOption[];
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Select nativo invisible superpuesto sobre un badge/avatar de la fila.
 * `pointer-events` solo se habilita con el hover del `group` (la fila
 * completa), así que el control no compite por clicks cuando la fila no está
 * en foco, y `stopPropagation` evita que abrir el dropdown dispare el
 * `onClick` de la fila que abre el panel de detalle.
 */
const QuickSelect: React.FC<QuickSelectProps> = ({ value, title, options, onChange, className }) => (
  <select
    value={value}
    title={title}
    onClick={(e) => e.stopPropagation()}
    onChange={(e) => {
      e.stopPropagation();
      onChange(e.target.value);
    }}
    className={cn(
      'absolute inset-0 w-full h-full opacity-0 cursor-pointer pointer-events-none group-hover:pointer-events-auto',
      className
    )}
  >
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);

interface IssueRowProps {
  issue: Issue;
  isFocused: boolean;
  isChecked: boolean;
  density: IssueListDensity;
  visibleColumns: IssueListColumn[];
  assigneeName?: string;
  assigneePhoto?: string;
  labelsById: Record<string, { name: string; color: string }>;
  allIssues: Issue[];
  projectsById: Record<string, Project>;
  epicsById: Record<string, Issue>;
  members: Member[];
  onOpen: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onQuickUpdate: (id: string, updates: Partial<Issue>) => void;
}

const IssueRow: React.FC<IssueRowProps> = ({
  issue,
  isFocused,
  isChecked,
  density,
  visibleColumns,
  assigneeName,
  assigneePhoto,
  labelsById,
  allIssues,
  projectsById,
  epicsById,
  members,
  onOpen,
  onToggleSelect,
  onDelete,
  onQuickUpdate,
}) => {
  const isCompact = density === 'compact';
  const project = issue.projectId ? projectsById[issue.projectId] : undefined;
  const epic = issue.epicId ? epicsById[issue.epicId] : undefined;

  return (
    <div
      onClick={() => onOpen(issue.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onOpen(issue.id);
        }
      }}
      tabIndex={0}
      aria-label={`${issue.identifier} ${issue.title}`}
      className={cn(
        'group relative flex items-center justify-between border-b border-subtle last:border-b-0 cursor-pointer transition-colors select-none',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2',
        isCompact ? 'px-3.5 py-1 text-xs' : 'px-3.5 py-2.5 text-sm',
        isFocused ? 'bg-hover' : 'hover:bg-elevated',
        isChecked && 'bg-accent/10'
      )}
    >
      {/* Keyboard Focus Indicator Line */}
      {isFocused && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent" />}

      {/* Left Side: Checkbox, Identifier, Priority, Status, Title */}
      <div className={cn('flex items-center min-w-0 flex-1 pr-4', isCompact ? 'gap-2' : 'gap-3')}>
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelect(issue.id);
          }}
          className="w-3.5 h-3.5 rounded border-default bg-elevated text-accent focus:ring-0 accent-accent cursor-pointer opacity-0 group-hover:opacity-100 checked:opacity-100 transition-opacity"
        />

        {visibleColumns.includes('identifier') && (
          <span className="font-mono text-xs text-tertiary font-medium min-w-[64px] shrink-0">
            {issue.identifier}
          </span>
        )}

        <IssueTypeBadge type={issue.type} />

        {/* Prioridad y estado son acciones rápidas: hover sobre la fila
            habilita un <select> nativo invisible encima del badge, sin abrir
            el panel de detalle. */}
        {visibleColumns.includes('priority') && (
          <span className="relative inline-flex items-center rounded group-hover:ring-1 group-hover:ring-accent/30">
            <PriorityBadge priority={issue.priority} />
            <QuickSelect
              value={String(issue.priority)}
              title="Cambiar prioridad"
              options={ISSUE_PRIORITIES.map((p) => ({ value: String(p.value), label: `${p.value} - ${p.label}` }))}
              onChange={(v) => onQuickUpdate(issue.id, { priority: parseInt(v, 10) as IssuePriority })}
            />
          </span>
        )}

        <span className="relative inline-flex items-center rounded group-hover:ring-1 group-hover:ring-accent/30">
          <StatusBadge status={issue.status} />
          <QuickSelect
            value={issue.status}
            title="Cambiar estado"
            options={ISSUE_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            onChange={(v) => onQuickUpdate(issue.id, { status: v as IssueStatus })}
          />
        </span>

        <span className="text-primary font-normal truncate">{issue.title}</span>

        {/* Progreso solo cuando hay algo colgando: una fila sin hijos no
            gana nada mostrando una barra vacía. */}
        {progressOf(allIssues, issue).total > 0 && (
          <EpicProgress progress={progressOf(allIssues, issue)} variant="inline" />
        )}
      </div>

      {/* Right Side: Labels, Project, Epic, Estimate, Due Date, Assignee Avatar, Trash Delete Button */}
      <div className="flex items-center gap-3 shrink-0">
        {visibleColumns.includes('labels') && issue.labelIds && issue.labelIds.length > 0 && (
          <div className="hidden md:flex items-center gap-1">
            {issue.labelIds.map((labelId) => (
              <Badge key={labelId} variant="subtle" className="text-[11px] px-1.5 py-0" color={labelsById[labelId]?.color}>
                {labelsById[labelId]?.name ?? labelId}
              </Badge>
            ))}
          </div>
        )}

        {visibleColumns.includes('project') && project && (
          <span className="hidden lg:flex items-center gap-1 text-xs text-tertiary" title="Proyecto">
            <FolderKanban className="w-3 h-3 shrink-0" />
            <span className="truncate max-w-[96px]">{project.name}</span>
          </span>
        )}

        {visibleColumns.includes('epic') && epic && (
          <span className="hidden lg:flex items-center gap-1 text-xs text-tertiary" title="Épica">
            <Zap className="w-3 h-3 shrink-0" />
            <span className="truncate max-w-[96px]">{epic.identifier}</span>
          </span>
        )}

        {visibleColumns.includes('estimate') && typeof issue.estimate === 'number' && (
          <span className="text-xs text-tertiary tabular-nums hidden sm:inline" title="Estimación">
            {issue.estimate} pts
          </span>
        )}

        {visibleColumns.includes('date') && issue.dueDate && (
          <span className="text-xs text-tertiary hidden sm:inline">{formatDate(issue.dueDate)}</span>
        )}

        {visibleColumns.includes('assignee') && (
          <span className="relative inline-flex items-center rounded-full group-hover:ring-2 group-hover:ring-accent/30">
            <Avatar name={assigneeName} src={assigneePhoto} size="sm" />
            <QuickSelect
              value={issue.assigneeId || ''}
              title="Asignar"
              className="rounded-full"
              options={[
                { value: '', label: 'Sin asignar' },
                ...members.map((m) => ({ value: m.userId, label: m.displayName })),
              ]}
              onChange={(v) => onQuickUpdate(issue.id, { assigneeId: v || undefined })}
            />
          </span>
        )}

        {/* Quick Delete Row Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(issue.id);
          }}
          aria-label="Eliminar issue"
          className="p-1 text-tertiary hover:text-priority-urgent opacity-0 group-hover:opacity-100 hover:bg-priority-urgent/10 rounded-md transition-all"
          title="Eliminar issue"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

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
  const updateIssue = useIssueStore((s) => s.updateIssue);
  const bulkUpdateStatus = useIssueStore((s) => s.bulkUpdateStatus);
  const members = useAppStore((s) => s.members);
  const filterState = useAppStore((s) => s.filterState);
  const sortBy = useAppStore((s) => s.sortBy);
  const groupBy = useAppStore((s) => s.groupBy);
  const listDensity = useAppStore((s) => s.listDensity);
  const visibleColumns = useAppStore((s) => s.visibleColumns);
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
  const projectsById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);

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
          density={listDensity}
          visibleColumns={visibleColumns}
          assigneeName={assignee?.displayName}
          assigneePhoto={assignee?.photoURL}
          labelsById={labelsById}
          allIssues={allIssues}
          projectsById={projectsById}
          epicsById={epicsById}
          members={members}
          onOpen={handleOpen}
          onToggleSelect={toggleIssueSelection}
          onDelete={deleteIssue}
          onQuickUpdate={updateIssue}
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
