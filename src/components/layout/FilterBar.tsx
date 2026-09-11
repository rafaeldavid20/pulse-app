'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  CircleDot,
  Flag,
  FolderKanban,
  Save,
  Tag,
  User,
  X,
  Zap,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useIssues } from '@/hooks/useIssues';
import { useProjectStore } from '@/stores/projectStore';
import { useLabelStore } from '@/stores/labelStore';
import { IssueGroupBy, IssuePriority, IssueSortBy, IssueStatus } from '@/types';
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from '@/lib/constants/issue';
import { UNASSIGNED, countActiveFilters } from '@/lib/issueFilters';
import { StatusBadge } from '@/components/issues/StatusBadge';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import { cn } from '@/lib/utils';

const GROUP_BY_OPTIONS: { value: IssueGroupBy; label: string }[] = [
  { value: 'none', label: 'Sin agrupar' },
  { value: 'status', label: 'Estado' },
  { value: 'assignee', label: 'Asignado' },
  { value: 'priority', label: 'Prioridad' },
  { value: 'project', label: 'Proyecto' },
  { value: 'epic', label: 'Épica' },
];

const SORT_BY_OPTIONS: { value: IssueSortBy; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'priority', label: 'Prioridad' },
  { value: 'updated', label: 'Actualización' },
  { value: 'created', label: 'Creación' },
  { value: 'estimate', label: 'Estimación' },
];

interface ChipProps {
  chipKey: string;
  label: string;
  icon: React.ReactNode;
  count: number;
  openChip: string | null;
  setOpenChip: (key: string | null) => void;
  children: React.ReactNode;
}

const FilterChip: React.FC<ChipProps> = ({ chipKey, label, icon, count, openChip, setOpenChip, children }) => {
  const isOpen = openChip === chipKey;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpenChip(isOpen ? null : chipKey)}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
          count > 0
            ? 'bg-accent/10 border-accent/40 text-accent'
            : 'bg-surface border-default text-secondary hover:text-primary hover:bg-hover'
        )}
      >
        {icon}
        <span>{label}</span>
        {count > 0 && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-accent text-white text-[10px] font-semibold">
            {count}
          </span>
        )}
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <div className="absolute top-8 left-0 z-30 w-56 bg-surface border border-default rounded-xl p-2 shadow-2xl flex flex-col gap-0.5 max-h-64 overflow-y-auto animate-fade-in-scale">
          {children}
        </div>
      )}
    </div>
  );
};

interface OptionRowProps {
  isChecked: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const OptionRow: React.FC<OptionRowProps> = ({ isChecked, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs transition-colors text-left',
      isChecked ? 'bg-accent/15 text-primary' : 'hover:bg-hover text-secondary'
    )}
  >
    <span className="flex items-center gap-2 min-w-0 truncate">{children}</span>
    {isChecked && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
  </button>
);

export const FilterBar: React.FC = () => {
  const filterState = useAppStore((s) => s.filterState);
  const setFilterState = useAppStore((s) => s.setFilterState);
  const resetFilters = useAppStore((s) => s.resetFilters);
  const groupBy = useAppStore((s) => s.groupBy);
  const setGroupBy = useAppStore((s) => s.setGroupBy);
  const sortBy = useAppStore((s) => s.sortBy);
  const setSortBy = useAppStore((s) => s.setSortBy);
  const members = useAppStore((s) => s.members);
  const activeTeam = useAppStore((s) => s.activeTeam);
  const activeView = useAppStore((s) => s.activeView);

  const { epics } = useIssues();
  const projects = useProjectStore((s) => s.projects).filter(
    (p) => !activeTeam || p.teamId === activeTeam.id
  );
  const labels = useLabelStore((s) => s.labels);

  const [openChip, setOpenChip] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenChip(null);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const toggleInArray = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const activeCount = useMemo(() => countActiveFilters(filterState), [filterState]);

  return (
    <div
      ref={containerRef}
      className="flex flex-wrap items-center gap-2 border-b border-subtle bg-base px-4 sm:px-6 py-2"
    >
      <FilterChip
        chipKey="status"
        label="Status"
        icon={<CircleDot className="w-3.5 h-3.5" />}
        count={filterState.status.length}
        openChip={openChip}
        setOpenChip={setOpenChip}
      >
        {ISSUE_STATUSES.map((s) => (
          <OptionRow
            key={s.value}
            isChecked={filterState.status.includes(s.value)}
            onClick={() =>
              setFilterState({ status: toggleInArray<IssueStatus>(filterState.status, s.value) })
            }
          >
            <StatusBadge status={s.value} showLabel />
          </OptionRow>
        ))}
      </FilterChip>

      <FilterChip
        chipKey="priority"
        label="Priority"
        icon={<Flag className="w-3.5 h-3.5" />}
        count={filterState.priority.length}
        openChip={openChip}
        setOpenChip={setOpenChip}
      >
        {ISSUE_PRIORITIES.map((p) => (
          <OptionRow
            key={p.value}
            isChecked={filterState.priority.includes(p.value)}
            onClick={() =>
              setFilterState({ priority: toggleInArray<IssuePriority>(filterState.priority, p.value) })
            }
          >
            <PriorityBadge priority={p.value} showLabel />
          </OptionRow>
        ))}
      </FilterChip>

      <FilterChip
        chipKey="assignee"
        label="Assignee"
        icon={<User className="w-3.5 h-3.5" />}
        count={filterState.assigneeIds.length}
        openChip={openChip}
        setOpenChip={setOpenChip}
      >
        <OptionRow
          isChecked={filterState.assigneeIds.includes(UNASSIGNED)}
          onClick={() => setFilterState({ assigneeIds: toggleInArray(filterState.assigneeIds, UNASSIGNED) })}
        >
          Sin asignar
        </OptionRow>
        {members.map((m) => (
          <OptionRow
            key={m.userId}
            isChecked={filterState.assigneeIds.includes(m.userId)}
            onClick={() =>
              setFilterState({ assigneeIds: toggleInArray(filterState.assigneeIds, m.userId) })
            }
          >
            {m.displayName}
          </OptionRow>
        ))}
      </FilterChip>

      <FilterChip
        chipKey="label"
        label="Label"
        icon={<Tag className="w-3.5 h-3.5" />}
        count={filterState.labelIds.length}
        openChip={openChip}
        setOpenChip={setOpenChip}
      >
        {labels.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-tertiary">Sin etiquetas todavía</p>
        )}
        {labels.map((l) => (
          <OptionRow
            key={l.id}
            isChecked={filterState.labelIds.includes(l.id)}
            onClick={() => setFilterState({ labelIds: toggleInArray(filterState.labelIds, l.id) })}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
            {l.name}
          </OptionRow>
        ))}
      </FilterChip>

      <FilterChip
        chipKey="project"
        label="Project"
        icon={<FolderKanban className="w-3.5 h-3.5" />}
        count={filterState.projectIds.length}
        openChip={openChip}
        setOpenChip={setOpenChip}
      >
        <OptionRow
          isChecked={filterState.projectIds.includes(UNASSIGNED)}
          onClick={() => setFilterState({ projectIds: toggleInArray(filterState.projectIds, UNASSIGNED) })}
        >
          Sin proyecto
        </OptionRow>
        {projects.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-tertiary">Sin proyectos en este equipo</p>
        )}
        {projects.map((p) => (
          <OptionRow
            key={p.id}
            isChecked={filterState.projectIds.includes(p.id)}
            onClick={() => setFilterState({ projectIds: toggleInArray(filterState.projectIds, p.id) })}
          >
            {p.name}
          </OptionRow>
        ))}
      </FilterChip>

      <FilterChip
        chipKey="epic"
        label="Epic"
        icon={<Zap className="w-3.5 h-3.5" />}
        count={filterState.epicIds.length}
        openChip={openChip}
        setOpenChip={setOpenChip}
      >
        {epics.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-tertiary">Sin épicas en este equipo</p>
        )}
        {epics.map(({ epic }) => (
          <OptionRow
            key={epic.id}
            isChecked={filterState.epicIds.includes(epic.id)}
            onClick={() => setFilterState({ epicIds: toggleInArray(filterState.epicIds, epic.id) })}
          >
            <span className="font-mono text-[10px] text-tertiary shrink-0">{epic.identifier}</span>
            {epic.title}
          </OptionRow>
        ))}
      </FilterChip>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => {
            resetFilters();
            setOpenChip(null);
          }}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-secondary hover:text-primary transition-colors"
        >
          <X className="w-3 h-3" />
          Limpiar
        </button>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* En board la agrupación la maneja el toggle Estado/Épica del Header:
            un segundo "agrupar" acá no tendría ningún efecto visible. */}
        {activeView !== 'board' && (
          <label className="flex items-center gap-1.5 text-xs text-tertiary">
            Agrupar
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as IssueGroupBy)}
              className="bg-surface border border-default text-secondary text-xs rounded-md px-1.5 py-1 outline-none cursor-pointer"
            >
              {GROUP_BY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex items-center gap-1.5 text-xs text-tertiary">
          Ordenar
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as IssueSortBy)}
            className="bg-surface border border-default text-secondary text-xs rounded-md px-1.5 py-1 outline-none cursor-pointer"
          >
            {SORT_BY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          disabled
          title="Próximamente: guardar esta combinación como una vista (TES-C4)"
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border border-default text-tertiary cursor-not-allowed opacity-60"
        >
          <Save className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Guardar como vista</span>
        </button>
      </div>
    </div>
  );
};
