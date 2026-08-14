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
          <svg className="w-3.5 h-3.5 text-[#5C5C66]" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
          </svg>
        );
      case 'todo':
        return (
          <svg className="w-3.5 h-3.5 text-[#8A8F98]" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        );
      case 'in_progress':
        return (
          <svg className="w-3.5 h-3.5 text-[#F09436]" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 2A6 6 0 0 1 8 14V2Z" fill="currentColor" />
          </svg>
        );
      case 'in_review':
        return (
          <svg className="w-3.5 h-3.5 text-[#5E94E4]" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 2A6 6 0 1 1 2 8H8V2Z" fill="currentColor" />
          </svg>
        );
      case 'done':
        return (
          <svg className="w-3.5 h-3.5 text-[#4ADE80]" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" fill="currentColor" />
            <path d="M5 8L7 10L11 6" stroke="#0F1012" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'canceled':
        return (
          <svg className="w-3.5 h-3.5 text-[#6B7280]" viewBox="0 0 16 16" fill="none">
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
      {showLabel && <span className="text-[#8A8F98]">{getStatusLabel(status)}</span>}
    </span>
  );
};
