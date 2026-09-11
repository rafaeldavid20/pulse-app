import React from 'react';
import { Zap, BookOpen, CircleDot, Bug, GitBranch } from 'lucide-react';
import { IssueType } from '@/types';
import { cn, } from '@/lib/utils';
import { getIssueTypeLabel } from '@/lib/constants/issue';

interface IssueTypeBadgeProps {
  type?: IssueType;
  showLabel?: boolean;
  className?: string;
}

/**
 * Los colores por tipo son deliberadamente distintos de los de prioridad y
 * estado: un issue muestra los tres a la vez en la fila de la lista, y si el
 * tipo reusara la paleta de prioridad (rojo/naranja/amarillo) los tres se leerían
 * como la misma señal.
 */
const TYPE_STYLE: Record<IssueType, { icon: React.ElementType; color: string }> = {
  epic: { icon: Zap, color: 'var(--color-type-epic)' },
  story: { icon: BookOpen, color: 'var(--color-priority-low)' },
  task: { icon: CircleDot, color: 'var(--color-secondary)' },
  bug: { icon: Bug, color: 'var(--color-priority-urgent)' },
  subtask: { icon: GitBranch, color: 'var(--color-tertiary)' },
};

export const IssueTypeBadge: React.FC<IssueTypeBadgeProps> = ({
  type = 'task',
  showLabel = false,
  className,
}) => {
  const { icon: Icon, color } = TYPE_STYLE[type] ?? TYPE_STYLE.task;
  const label = getIssueTypeLabel(type);

  // La tarea es el tipo por defecto y el más común: mostrar su icono en cada
  // fila sería ruido sin información. Solo se pinta cuando se pide la etiqueta.
  if (type === 'task' && !showLabel) return null;

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 shrink-0 text-xs', className)}
      title={`Tipo: ${label}`}
    >
      <Icon className="w-3.5 h-3.5" style={{ color }} />
      {showLabel && <span style={{ color }}>{label}</span>}
    </span>
  );
};
