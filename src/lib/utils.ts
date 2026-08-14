import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name?: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function formatDate(dateString?: string): string {
  if (!dateString) return '';
  try {
    const date = parseISO(dateString);
    return format(date, 'MMM d', { locale: es });
  } catch {
    return dateString;
  }
}

export function formatTimeAgo(dateString?: string): string {
  if (!dateString) return '';
  try {
    const date = parseISO(dateString);
    return formatDistanceToNow(date, { addSuffix: true, locale: es });
  } catch {
    return dateString;
  }
}

export function generateIdentifier(teamKey: string, issueNumber: number): string {
  return `${teamKey.toUpperCase()}-${issueNumber}`;
}

export function getPriorityLabel(priority: number): string {
  switch (priority) {
    case 1:
      return 'Urgente';
    case 2:
      return 'Alta';
    case 3:
      return 'Media';
    case 4:
      return 'Baja';
    default:
      return 'Sin prioridad';
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'backlog':
      return 'Backlog';
    case 'todo':
      return 'Por hacer';
    case 'in_progress':
      return 'En progreso';
    case 'in_review':
      return 'En revisión';
    case 'done':
      return 'Completado';
    case 'canceled':
      return 'Cancelado';
    default:
      return status;
  }
}
