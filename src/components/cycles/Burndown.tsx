import React from 'react';
import { Cycle } from '@/types';
import { totalDays } from '@/lib/cycles';

interface BurndownProps {
  cycle: Cycle;
  scope: number;
  completed: number;
}

const WIDTH = 480;
const HEIGHT = 160;
const PADDING = 24;

/**
 * Burndown "simple": la línea ideal (scope -> 0 en línea recta a lo largo del
 * ciclo) contra un único segmento real (inicio -> hoy). No hay una línea real
 * día a día porque `Activity` (el historial de cambios de status) todavía no
 * se escribe desde ningún lado — reconstruir el remaining pasado no es
 * posible con los datos que hay hoy. E5 (scope creep, dos líneas completas)
 * es quien agrega el snapshot de scope inicial que haría falta para eso.
 */
export const Burndown: React.FC<BurndownProps> = ({ cycle, scope, completed }) => {
  const days = totalDays(cycle);
  const now = new Date();
  const elapsedMs = now.getTime() - new Date(cycle.startsAt).getTime();
  const elapsedDays = Math.min(days, Math.max(0, elapsedMs / (1000 * 60 * 60 * 24)));
  const remaining = Math.max(0, scope - completed);

  const x = (day: number) => PADDING + (day / days) * (WIDTH - PADDING * 2);
  const y = (points: number) => {
    if (scope <= 0) return HEIGHT - PADDING;
    return PADDING + (1 - points / scope) * (HEIGHT - PADDING * 2);
  };

  const idealPath = `M ${x(0)} ${y(scope)} L ${x(days)} ${y(0)}`;
  const actualPath = `M ${x(0)} ${y(scope)} L ${x(elapsedDays)} ${y(remaining)}`;

  if (scope === 0) {
    return (
      <div className="flex items-center justify-center h-[160px] text-xs text-tertiary border border-dashed border-subtle rounded-lg">
        Sin issues estimados en este ciclo todavía
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full h-auto"
      role="img"
      aria-label={`Burndown: ${remaining} de ${scope} puntos restantes`}
    >
      {/* Eje base */}
      <line
        x1={PADDING}
        y1={HEIGHT - PADDING}
        x2={WIDTH - PADDING}
        y2={HEIGHT - PADDING}
        stroke="var(--color-subtle)"
        strokeWidth={1}
      />
      <line
        x1={PADDING}
        y1={PADDING}
        x2={PADDING}
        y2={HEIGHT - PADDING}
        stroke="var(--color-subtle)"
        strokeWidth={1}
      />

      {/* Línea ideal */}
      <path d={idealPath} stroke="var(--color-strong)" strokeWidth={1.5} strokeDasharray="4 3" fill="none" />

      {/* Línea real (inicio -> hoy) */}
      <path d={actualPath} stroke="var(--color-accent)" strokeWidth={2} fill="none" />
      <circle cx={x(elapsedDays)} cy={y(remaining)} r={3.5} fill="var(--color-accent)" />

      {/* Etiquetas */}
      <text x={PADDING} y={PADDING - 8} fontSize="10" fill="var(--color-tertiary)">
        {scope} pts
      </text>
      <text x={WIDTH - PADDING} y={HEIGHT - PADDING + 14} fontSize="10" fill="var(--color-tertiary)" textAnchor="end">
        0 pts
      </text>
    </svg>
  );
};
