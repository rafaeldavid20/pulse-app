import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  getPriorityLabel as getPriorityLabelFromConstants,
  getStatusLabel as getStatusLabelFromConstants,
} from '@/lib/constants/issue';
import type { IssuePriority } from '@/types';

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

// Re-exported for backwards compatibility with existing imports from
// '@/lib/utils' — the actual status/priority list lives in
// '@/lib/constants/issue' as the single source of truth.
export function getPriorityLabel(priority: number): string {
  return getPriorityLabelFromConstants(priority as IssuePriority);
}

export function getStatusLabel(status: string): string {
  return getStatusLabelFromConstants(status);
}
