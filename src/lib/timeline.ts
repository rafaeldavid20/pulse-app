import {
  addDays,
  addMonths,
  addQuarters,
  addWeeks,
  differenceInCalendarDays,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  format,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Cycle, Issue } from '@/types';

export type TimelineZoom = 'weeks' | 'months' | 'quarters';

/** Ancho de un día, en px, para cada nivel de zoom del eje horizontal. */
export const TIMELINE_PX_PER_DAY: Record<TimelineZoom, number> = {
  weeks: 16,
  months: 4.5,
  quarters: 1.6,
};

/** Margen a cada lado del rango de fechas real, antes de redondear al borde de la unidad de zoom. */
const PAD_DAYS = 14;

export interface TimelineRange {
  start: Date;
  end: Date;
}

function snapStart(date: Date, zoom: TimelineZoom): Date {
  if (zoom === 'weeks') return startOfWeek(date, { weekStartsOn: 1 });
  if (zoom === 'months') return startOfMonth(date);
  return startOfQuarter(date);
}

function snapEnd(date: Date, zoom: TimelineZoom): Date {
  if (zoom === 'weeks') return endOfWeek(date, { weekStartsOn: 1 });
  if (zoom === 'months') return endOfMonth(date);
  return endOfQuarter(date);
}

/**
 * Rango visible del timeline: toma las fechas de ciclos y épicas con
 * `startDate`/`dueDate` completos, les suma un margen, y redondea al límite
 * de la unidad de zoom activa para que los ticks del header queden prolijos.
 * Sin ningún dato con fecha, cae a una ventana fija alrededor de hoy.
 */
export function timelineRangeFor(
  cycles: Pick<Cycle, 'startsAt' | 'endsAt'>[],
  epics: Pick<Issue, 'startDate' | 'dueDate'>[],
  zoom: TimelineZoom,
  now: Date = new Date()
): TimelineRange {
  const dates: Date[] = [];
  cycles.forEach((c) => {
    dates.push(new Date(c.startsAt), new Date(c.endsAt));
  });
  epics.forEach((e) => {
    if (e.startDate && e.dueDate) {
      dates.push(new Date(e.startDate), new Date(e.dueDate));
    }
  });

  if (dates.length === 0) {
    return { start: snapStart(addMonths(now, -1), zoom), end: snapEnd(addMonths(now, 5), zoom) };
  }

  const min = new Date(Math.min(...dates.map((d) => d.getTime())));
  const max = new Date(Math.max(...dates.map((d) => d.getTime())));

  return {
    start: snapStart(addDays(min, -PAD_DAYS), zoom),
    end: snapEnd(addDays(max, PAD_DAYS), zoom),
  };
}

export interface TimelineTick {
  start: Date;
  end: Date;
  label: string;
}

/** Divide un rango en ticks (semana/mes/trimestre) para el header del eje. */
export function timelineTicksFor(range: TimelineRange, zoom: TimelineZoom): TimelineTick[] {
  const ticks: TimelineTick[] = [];
  let cursor = range.start;
  let guard = 0;

  while (cursor < range.end && guard < 500) {
    guard += 1;
    if (zoom === 'weeks') {
      ticks.push({ start: cursor, end: endOfWeek(cursor, { weekStartsOn: 1 }), label: format(cursor, 'd MMM', { locale: es }) });
      cursor = addWeeks(cursor, 1);
    } else if (zoom === 'months') {
      ticks.push({ start: cursor, end: endOfMonth(cursor), label: format(cursor, 'MMMM yyyy', { locale: es }) });
      cursor = addMonths(cursor, 1);
    } else {
      ticks.push({
        start: cursor,
        end: endOfQuarter(cursor),
        label: `T${Math.floor(cursor.getMonth() / 3) + 1} ${format(cursor, 'yyyy')}`,
      });
      cursor = addQuarters(cursor, 1);
    }
  }

  return ticks;
}

/** Días de calendario entre dos fechas (puede ser negativo). */
export function daysBetween(from: Date, to: Date): number {
  return differenceInCalendarDays(to, from);
}

/**
 * Offset horizontal en px de `date` dentro de `range`, para el zoom dado.
 * Clampeado a los bordes del rango: una fecha fuera de rango se dibuja pegada
 * al borde más cercano en vez de desaparecer o romper el layout.
 */
export function xOffsetFor(date: Date, range: TimelineRange, zoom: TimelineZoom): number {
  const totalDays = daysBetween(range.start, range.end);
  const days = Math.min(Math.max(daysBetween(range.start, date), 0), totalDays);
  return days * TIMELINE_PX_PER_DAY[zoom];
}

export function timelineWidthFor(range: TimelineRange, zoom: TimelineZoom): number {
  return daysBetween(range.start, range.end) * TIMELINE_PX_PER_DAY[zoom];
}
