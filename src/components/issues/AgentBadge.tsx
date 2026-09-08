import React from 'react';
import { Loader2, GitPullRequest, AlertTriangle, CircleDot } from 'lucide-react';
import { AgentIssueState } from '@/types';
import { cn } from '@/lib/utils';

interface AgentBadgeProps {
  state: AgentIssueState;
  className?: string;
}

const STATE_CONFIG: Record<AgentIssueState, { label: string; color: string; icon: React.ReactNode }> = {
  idle: { label: 'Inactivo', color: 'text-[#5B616E] bg-[#1E2024]', icon: <CircleDot className="w-3 h-3" /> },
  claimed: {
    label: 'Reclamado',
    color: 'text-[#8A8F98] bg-[#1E2024]',
    icon: <CircleDot className="w-3 h-3" />,
  },
  working: {
    label: 'Trabajando',
    color: 'text-[#F09436] bg-[#F09436]/10',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  pr_open: {
    label: 'PR abierto',
    color: 'text-[#5E94E4] bg-[#5E94E4]/10',
    icon: <GitPullRequest className="w-3 h-3" />,
  },
  blocked: {
    label: 'Bloqueado',
    color: 'text-[#F75555] bg-[#F75555]/10',
    icon: <AlertTriangle className="w-3 h-3" />,
  },
};

// Chip showing where an agent is at on an issue (TES-110) — `idle` is
// intentionally not rendered by callers: it means "nothing to show."
export const AgentBadge: React.FC<AgentBadgeProps> = ({ state, className }) => {
  const config = STATE_CONFIG[state];
  if (!config) return null;

  return (
    <span
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
