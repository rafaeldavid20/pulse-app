import React from 'react';
import { IssuePriority } from '@/types';
import { cn, getPriorityLabel } from '@/lib/utils';

interface PriorityBadgeProps {
  priority: IssuePriority;
  showLabel?: boolean;
  className?: string;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({
  priority,
  showLabel = false,
  className,
}) => {
  const renderIcon = () => {
    switch (priority) {
      case 1: // Urgent
        return (
          <span className="w-4 h-4 bg-[#F75555]/20 border border-[#F75555] rounded flex items-center justify-center text-[#F75555] text-[10px] font-bold">
            !
          </span>
        );
      case 2: // High
        return (
          <svg className="w-3.5 h-3.5 text-[#F09436]" viewBox="0 0 16 16" fill="currentColor">
            <rect x="2" y="10" width="3" height="4" rx="0.5" />
            <rect x="6.5" y="7" width="3" height="7" rx="0.5" />
            <rect x="11" y="4" width="3" height="10" rx="0.5" />
          </svg>
        );
      case 3: // Medium
        return (
          <svg className="w-3.5 h-3.5 text-[#F7C948]" viewBox="0 0 16 16" fill="currentColor">
            <rect x="2" y="10" width="3" height="4" rx="0.5" />
            <rect x="6.5" y="7" width="3" height="7" rx="0.5" />
            <rect x="11" y="4" width="3" height="10" rx="0.5" opacity="0.2" />
          </svg>
        );
      case 4: // Low
        return (
          <svg className="w-3.5 h-3.5 text-[#5E94E4]" viewBox="0 0 16 16" fill="currentColor">
            <rect x="2" y="10" width="3" height="4" rx="0.5" />
            <rect x="6.5" y="7" width="3" height="7" rx="0.5" opacity="0.2" />
            <rect x="11" y="4" width="3" height="10" rx="0.5" opacity="0.2" />
          </svg>
        );
      default: // None
        return (
          <svg className="w-3.5 h-3.5 text-[#424651]" viewBox="0 0 16 16" fill="currentColor">
            <rect x="2" y="10" width="3" height="4" rx="0.5" opacity="0.3" />
            <rect x="6.5" y="7" width="3" height="7" rx="0.5" opacity="0.3" />
            <rect x="11" y="4" width="3" height="10" rx="0.5" opacity="0.3" />
          </svg>
        );
    }
  };

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 shrink-0 text-xs', className)}
      title={`Prioridad: ${getPriorityLabel(priority)}`}
    >
      {renderIcon()}
      {showLabel && <span className="text-[#8A8F98]">{getPriorityLabel(priority)}</span>}
    </span>
  );
};
