'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CalendarOff, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { useIssues } from '@/hooks/useIssues';
import { useIssueStore } from '@/stores/issueStore';
import { useProjectStore } from '@/stores/projectStore';
import { Skeleton } from '@/components/ui/Skeleton';
import { IssueTypeBadge } from '@/components/issues/IssueTypeBadge';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import { cn } from '@/lib/utils';
import { Issue, Project } from '@/types';

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MAX_VISIBLE_PER_DAY = 3;
const TODAY_KEY = format(new Date(), 'yyyy-MM-dd');

interface SidePanelState {
  title: string;
  issues: Issue[];
}

interface IssueChipProps {
  issue: Issue;
  project?: Project;
  onOpen: (id: string) => void;
}

const IssueChip: React.FC<IssueChipProps> = ({ issue, project, onOpen }) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onOpen(issue.id);
    }}
    title={`${issue.identifier} · ${issue.title}`}
    className="w-full flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded text-[10px] bg-surface hover:bg-elevated border-l-2 truncate text-left transition-colors"
    style={{ borderLeftColor: project?.color || 'var(--color-accent)' }}
  >
    <IssueTypeBadge type={issue.type} />
    <PriorityBadge priority={issue.priority} />
    <span className="truncate text-primary">{issue.title}</span>
  </button>
);

/**
 * Lista lateral reutilizada tanto para "click en un día con varios issues"
 * como para el contador "N sin fecha" — ambos casos son "mostrame estos
 * issues sin salir del calendario", la única diferencia es qué subconjunto
 * reciben. Convive con `IssuePeekPanel` (z-40): un issue clickeado acá abre
 * el peek por encima sin cerrar esta lista, para poder volver a ella.
 */
const SidePanel: React.FC<{ panel: SidePanelState; onClose: () => void; onOpenIssue: (id: string) => void }> = ({
  panel,
  onClose,
  onOpenIssue,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-y-0 right-0 z-30 w-full max-w-sm bg-surface border-l border-default shadow-2xl flex flex-col animate-slide-in-right">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-subtle bg-elevated shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-primary truncate capitalize">{panel.title}</span>
          <span className="font-mono text-[11px] text-tertiary tabular-nums shrink-0">{panel.issues.length}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-secondary hover:text-primary hover:bg-hover rounded-md transition-colors shrink-0"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
        {panel.issues.map((issue) => (
          <button
            key={issue.id}
            onClick={() => onOpenIssue(issue.id)}
            className="flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-hover text-left transition-colors"
          >
            <IssueTypeBadge type={issue.type} />
            <PriorityBadge priority={issue.priority} />
            <span className="font-mono text-[10px] text-tertiary shrink-0">{issue.identifier}</span>
            <span className="text-xs text-primary truncate flex-1">{issue.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export const CalendarView: React.FC = () => {
  const { issues } = useIssues();
  const setPeekIssueId = useIssueStore((s) => s.setPeekIssueId);
  const issuesLoaded = useIssueStore((s) => s.issuesLoaded);
  const projects = useProjectStore((s) => s.projects);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [panel, setPanel] = useState<SidePanelState | null>(null);

  const projectsById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);

  const { issuesByDate, unscheduled } = useMemo(() => {
    const byDate = new Map<string, Issue[]>();
    const withoutDate: Issue[] = [];
    issues.forEach((issue) => {
      if (!issue.dueDate) {
        withoutDate.push(issue);
        return;
      }
      // El input de fecha guarda `YYYY-MM-DD` plano; comparar el string
      // directo evita el corrimiento de día que trae parsear a `Date` y
      // volver a formatear en una zona horaria con offset negativo.
      const key = issue.dueDate.slice(0, 10);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(issue);
    });
    return { issuesByDate: byDate, unscheduled: withoutDate };
  }, [issues]);

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [cursor]);

  const monthLabel = format(cursor, 'MMMM yyyy', { locale: es });

  const openIssue = (id: string) => setPeekIssueId(id);

  if (!issuesLoaded) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-surface border border-default p-0.5 rounded-md">
            <button
              onClick={() => setCursor(startOfMonth(new Date()))}
              className="px-2.5 py-1.5 rounded text-xs font-medium text-secondary hover:text-primary hover:bg-hover transition-colors"
            >
              Hoy
            </button>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setCursor((c) => subMonths(c, 1))}
              aria-label="Mes anterior"
              className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-hover transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCursor((c) => addMonths(c, 1))}
              aria-label="Mes siguiente"
              className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-hover transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <h2 className="text-sm font-semibold text-primary capitalize">{monthLabel}</h2>
        </div>

        {unscheduled.length > 0 && (
          <button
            onClick={() => setPanel({ title: 'Sin fecha', issues: unscheduled })}
            className="inline-flex items-center gap-1.5 text-xs text-tertiary hover:text-primary transition-colors"
          >
            <CalendarOff className="w-3.5 h-3.5" />
            {unscheduled.length} sin fecha
          </button>
        )}
      </div>

      <div className="border border-subtle rounded-xl bg-surface overflow-hidden">
        <div className="grid grid-cols-7 border-b border-subtle">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="px-2 py-2 text-[11px] font-medium text-tertiary text-center uppercase tracking-wide"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayIssues = issuesByDate.get(key) ?? [];
            const visible = dayIssues.slice(0, MAX_VISIBLE_PER_DAY);
            const overflow = dayIssues.length - visible.length;
            const inCurrentMonth = isSameMonth(day, cursor);
            const isToday = key === TODAY_KEY;

            return (
              <div
                key={key}
                onClick={() => {
                  if (dayIssues.length > 0) {
                    setPanel({ title: format(day, "d 'de' MMMM", { locale: es }), issues: dayIssues });
                  }
                }}
                className={cn(
                  'min-h-[104px] border-b border-subtle p-1.5 flex flex-col gap-1',
                  (i + 1) % 7 !== 0 && 'border-r',
                  !inCurrentMonth && 'bg-base/40',
                  dayIssues.length > 0 && 'cursor-pointer hover:bg-hover/40 transition-colors'
                )}
              >
                <span
                  className={cn(
                    'text-[11px] font-medium w-5 h-5 flex items-center justify-center rounded-full shrink-0',
                    isToday
                      ? 'bg-accent text-white'
                      : inCurrentMonth
                        ? 'text-secondary'
                        : 'text-tertiary'
                  )}
                >
                  {format(day, 'd')}
                </span>

                <div className="flex flex-col gap-0.5 min-w-0">
                  {visible.map((issue) => (
                    <IssueChip
                      key={issue.id}
                      issue={issue}
                      project={issue.projectId ? projectsById[issue.projectId] : undefined}
                      onOpen={openIssue}
                    />
                  ))}
                  {overflow > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPanel({ title: format(day, "d 'de' MMMM", { locale: es }), issues: dayIssues });
                      }}
                      className="text-left text-[10px] font-medium text-tertiary hover:text-primary px-1.5 transition-colors"
                    >
                      +{overflow} más
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {panel && <SidePanel panel={panel} onClose={() => setPanel(null)} onOpenIssue={openIssue} />}
    </div>
  );
};
