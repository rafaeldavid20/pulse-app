import React from 'react';
import { IssueStatus } from '@/types';
import { cn, getStatusLabel } from '@/lib/utils';

interface StatusBadgeProps {
  status: IssueStatus;
  showLabel?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  showLabel = false,
  className,
}) => {
  const renderIcon = () => {
    switch (status) {
      case 'backlog':
        return (
          <svg className="w-3.5 h-3.5 text-status-backlog" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
          </svg>
        );
      case 'todo':
        return (
          <svg className="w-3.5 h-3.5 text-secondary" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        );
      case 'in_progress':
        return (
          <svg className="w-3.5 h-3.5 text-priority-high" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 2A6 6 0 0 1 8 14V2Z" fill="currentColor" />
          </svg>
        );
      case 'in_review':
        return (
          <svg className="w-3.5 h-3.5 text-priority-low" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 2A6 6 0 1 1 2 8H8V2Z" fill="currentColor" />
          </svg>
        );
      case 'done':
        return (
          <svg className="w-3.5 h-3.5 text-status-done" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" fill="currentColor" />
            <path d="M5 8L7 10L11 6" stroke="var(--color-surface)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'canceled':
        return (
          <svg className="w-3.5 h-3.5 text-status-canceled" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 shrink-0 text-xs font-medium', className)}
      title={getStatusLabel(status)}
    >
      {renderIcon()}
      {showLabel && <span className="text-secondary">{getStatusLabel(status)}</span>}
    </span>
  );
};
