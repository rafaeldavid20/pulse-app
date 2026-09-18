'use client';

import React, { useMemo, useRef, useState } from 'react';
import { CalendarOff } from 'lucide-react';
import { useIssues } from '@/hooks/useIssues';
import { useIssueStore } from '@/stores/issueStore';
import { useAppStore } from '@/stores/appStore';
import { useCycleStore } from '@/stores/cycleStore';
import { Skeleton } from '@/components/ui/Skeleton';
import { IssueTypeBadge } from '@/components/issues/IssueTypeBadge';
import { progressFrom } from '@/lib/hierarchy';
import { cn, formatDate } from '@/lib/utils';
import {
  TimelineZoom,
  timelineRangeFor,
  timelineTicksFor,
  timelineWidthFor,
  xOffsetFor,
} from '@/lib/timeline';

const LABEL_WIDTH = 220;
const ROW_HEIGHT = 44;
const CYCLES_ROW_HEIGHT = 40;
const MIN_BAR_WIDTH = 10;

const ZOOM_OPTIONS: { value: TimelineZoom; label: string }[] = [
  { value: 'weeks', label: 'Semanas' },
  { value: 'months', label: 'Meses' },
  { value: 'quarters', label: 'Trimestres' },
];

export const TimelineView: React.FC = () => {
  const { epics } = useIssues();
  const activeTeam = useAppStore((s) => s.activeTeam);
  const setPeekIssueId = useIssueStore((s) => s.setPeekIssueId);
  const issuesLoaded = useIssueStore((s) => s.issuesLoaded);
  const cycles = useCycleStore((s) => s.cycles);
  const cyclesLoaded = useCycleStore((s) => s.cyclesLoaded);
  const [zoom, setZoom] = useState<TimelineZoom>('months');
  const scrollRef = useRef<HTMLDivElement>(null);

  const teamCycles = useMemo(
    () =>
      cycles
        .filter((c) => !activeTeam || c.teamId === activeTeam.id)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [cycles, activeTeam]
  );

  const { scheduled, unscheduled } = useMemo(() => {
    const withDates: { epic: (typeof epics)[number]['epic']; children: (typeof epics)[number]['children'] }[] = [];
    const withoutDates: typeof withDates = [];
    epics.forEach(({ epic, children }) => {
      if (epic.startDate && epic.dueDate) {
        withDates.push({ epic, children });
      } else {
        withoutDates.push({ epic, children });
      }
    });
    return { scheduled: withDates, unscheduled: withoutDates };
  }, [epics]);

  const range = useMemo(
    () => timelineRangeFor(teamCycles, scheduled.map(({ epic }) => epic), zoom),
    [teamCycles, scheduled, zoom]
  );
  const ticks = useMemo(() => timelineTicksFor(range, zoom), [range, zoom]);
  const trackWidth = useMemo(() => timelineWidthFor(range, zoom), [range, zoom]);
  const xOf = (date: Date) => xOffsetFor(date, range, zoom);

  const today = new Date();
  const todayInRange = today >= range.start && today <= range.end;

  const scrollToToday = () => {
    const container = scrollRef.current;
    if (!container) return;
    const target = LABEL_WIDTH + xOf(today) - container.clientWidth / 2;
    container.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  };

  if (!issuesLoaded || !cyclesLoaded) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center bg-surface border border-default p-0.5 rounded-md">
          <button
            onClick={scrollToToday}
            className="px-2.5 py-1.5 rounded text-xs font-medium text-secondary hover:text-primary hover:bg-hover transition-colors"
          >
            Hoy
          </button>
        </div>
        <div className="flex items-center bg-surface border border-default p-0.5 rounded-md">
          {ZOOM_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setZoom(opt.value)}
              className={cn(
                'px-2.5 py-1.5 rounded text-xs font-medium transition-colors',
                zoom === opt.value ? 'bg-hover text-primary' : 'text-secondary hover:text-primary'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {scheduled.length === 0 && teamCycles.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-default rounded-lg my-2">
          <p className="text-secondary text-sm">
            Todavía no hay ciclos ni épicas con fechas para dibujar el timeline.
          </p>
        </div>
      ) : (
        <div ref={scrollRef} className="overflow-x-auto border border-subtle rounded-xl bg-surface">
          <div style={{ width: LABEL_WIDTH + trackWidth, minWidth: '100%' }} className="relative">
            {todayInRange && (
              <div
                className="absolute top-0 bottom-0 w-px bg-accent/70 z-0 pointer-events-none"
                style={{ left: LABEL_WIDTH + xOf(today) }}
              />
            )}

            {/* Header de meses/semanas/trimestres */}
            <div className="flex bg-surface border-b border-subtle">
              <div
                className="sticky left-0 z-10 bg-surface shrink-0 border-r border-subtle"
                style={{ width: LABEL_WIDTH }}
              />
              <div className="relative flex" style={{ width: trackWidth }}>
                {ticks.map((tick, i) => (
                  <div
                    key={i}
                    style={{ width: xOf(tick.end) - xOf(tick.start) || 1 }}
                    className="shrink-0 px-2 py-2 text-[11px] font-medium text-tertiary border-r border-subtle/60 truncate capitalize"
                  >
                    {tick.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Fila fija de ciclos */}
            <div className="flex border-b border-subtle">
              <div
                className="sticky left-0 z-10 bg-surface shrink-0 border-r border-subtle flex items-center px-3 text-xs font-medium text-secondary"
                style={{ width: LABEL_WIDTH, height: CYCLES_ROW_HEIGHT }}
              >
                Ciclos
              </div>
              <div className="relative" style={{ width: trackWidth, height: CYCLES_ROW_HEIGHT }}>
                {teamCycles.map((cycle) => {
                  const left = xOf(new Date(cycle.startsAt));
                  const width = Math.max(xOf(new Date(cycle.endsAt)) - left, MIN_BAR_WIDTH);
                  return (
                    <div
                      key={cycle.id}
                      title={`${cycle.name} · ${formatDate(cycle.startsAt)} – ${formatDate(cycle.endsAt)}`}
                      className="absolute top-1.5 h-7 rounded-md bg-hover border border-default flex items-center px-2 text-[11px] font-medium text-secondary truncate"
                      style={{ left, width }}
                    >
                      {cycle.name}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Una fila por épica con fechas */}
            {scheduled.map(({ epic, children }) => {
              const progress = progressFrom(children);
              const left = xOf(new Date(epic.startDate!));
              const width = Math.max(xOf(new Date(epic.dueDate!)) - left, MIN_BAR_WIDTH);

              return (
                <div key={epic.id} className="flex border-b border-subtle last:border-b-0">
                  <button
                    onClick={() => setPeekIssueId(epic.id)}
                    className="sticky left-0 z-10 bg-surface hover:bg-hover shrink-0 border-r border-subtle flex items-center gap-1.5 px-3 text-left transition-colors"
                    style={{ width: LABEL_WIDTH, height: ROW_HEIGHT }}
                  >
                    <IssueTypeBadge type="epic" />
                    <span className="font-mono text-[10px] text-tertiary shrink-0">
                      {epic.identifier}
                    </span>
                    <span className="text-xs font-medium text-primary truncate">{epic.title}</span>
                  </button>
                  <div className="relative" style={{ width: trackWidth, height: ROW_HEIGHT }}>
                    <button
                      onClick={() => setPeekIssueId(epic.id)}
                      title={`${epic.title} · ${progress.closed}/${progress.total} · ${formatDate(epic.startDate)} – ${formatDate(epic.dueDate)}`}
                      className="absolute top-2.5 h-6 rounded-md bg-type-epic/20 border border-type-epic/40 overflow-hidden hover:brightness-110 transition-all cursor-pointer"
                      style={{ left, width }}
                    >
                      <div
                        className="h-full bg-type-epic/70"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {unscheduled.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-tertiary">
            <CalendarOff className="w-3.5 h-3.5" />
            Sin fecha ({unscheduled.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map(({ epic, children }) => {
              const progress = progressFrom(children);
              return (
                <button
                  key={epic.id}
                  onClick={() => setPeekIssueId(epic.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface hover:bg-hover border border-default rounded-md text-xs transition-colors"
                >
                  <IssueTypeBadge type="epic" />
                  <span className="font-mono text-[10px] text-tertiary">{epic.identifier}</span>
                  <span className="text-primary font-medium truncate max-w-[220px]">{epic.title}</span>
                  <span className="font-mono text-[10px] text-tertiary tabular-nums">
                    {progress.closed}/{progress.total}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
