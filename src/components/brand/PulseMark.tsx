import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Símbolo de Pulse ("Orden"): una onda que se amortigua hasta volverse línea
 * recta — el lema "Orden y Progreso" dibujado. Toma el color de `currentColor`.
 * Si se cambia el trazo, actualizar también `src/app/icon.svg` y `apple-icon.png`.
 */
export const PULSE_MARK_PATH =
  'M3 16C5 5 7.5 5 9.5 16S13.5 25 15.5 16S18.5 10.5 20 16S22.5 19 23.5 16H29';

interface PulseMarkProps {
  className?: string;
  /** Dibuja la onda en loop; para estados de carga. */
  animated?: boolean;
  /** Texto accesible; sin él el símbolo es decorativo. */
  title?: string;
}

export const PulseMark: React.FC<PulseMarkProps> = ({ className, animated = false, title }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    className={cn(animated && 'pulse-mark-draw', className)}
    role={title ? 'img' : undefined}
    aria-hidden={title ? undefined : true}
  >
    {title && <title>{title}</title>}
    <path
      d={PULSE_MARK_PATH}
      pathLength={100}
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
