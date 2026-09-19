import React from 'react';
import { Loader2, CheckCircle2, AlertTriangle, UserCog, Clock3 } from 'lucide-react';
import { ReviewState } from '@/types';
import { cn } from '@/lib/utils';

interface ReviewBadgeProps {
  state: ReviewState;
  className?: string;
}

const STATE_CONFIG: Record<ReviewState, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: 'En revisión',
    color: 'text-priority-low bg-priority-low/10',
    icon: <Clock3 className="w-3 h-3" />,
  },
  running: {
    label: 'En revisión',
    color: 'text-priority-low bg-priority-low/10',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  approved: {
    label: 'Aprobado',
    color: 'text-status-done bg-status-done/10',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  changes_requested: {
    label: 'Cambios pedidos',
    color: 'text-priority-high bg-priority-high/10',
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  needs_human: {
    label: 'Necesita humano',
    color: 'text-priority-urgent bg-priority-urgent/10',
    icon: <UserCog className="w-3 h-3" />,
  },
  stale: {
    label: 'Desactualizado',
    color: 'text-tertiary bg-hover',
    icon: <Clock3 className="w-3 h-3" />,
  },
};

/** Badge de revisión de QA (D7) — fila, card y panel. `undefined` (issue nunca revisado) no se renderiza. */
export const ReviewBadge: React.FC<ReviewBadgeProps> = ({ state, className }) => {
  const config = STATE_CONFIG[state];
  if (!config) return null;

  return (
    <span
      title={`Revisión de QA: ${config.label}`}
      className={cn(
        'inline-flex items-center gap-1 shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded',
        config.color,
        className
      )}
    >
      {config.icon}
      {config.label}
    </span>
  );
};
