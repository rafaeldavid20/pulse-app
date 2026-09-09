'use client';

import React from 'react';
import { Zap, ChevronRight } from 'lucide-react';
import { Issue } from '@/types';
import { useIssueStore } from '@/stores/issueStore';
import { useAppStore } from '@/stores/appStore';
import { StatusBadge } from '@/components/issues/StatusBadge';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import { EpicProgress } from '@/components/issues/EpicProgress';
import { Avatar } from '@/components/ui/Avatar';
import { progressFrom } from '@/lib/hierarchy';
import { ISSUE_STATUSES } from '@/lib/constants/issue';

interface EpicCardProps {
  epic: Issue;
  /** El subárbol de la épica. No se llama `children` a propósito: en un
   *  componente de React ese nombre es el contenido anidado, no un dato. */
  issues: Issue[];
}

export const EpicCard: React.FC<EpicCardProps> = ({ epic, issues }) => {
  const setPeekIssueId = useIssueStore((s) => s.setPeekIssueId);
  const setFilterState = useAppStore((s) => s.setFilterState);
  const members = useAppStore((s) => s.members);

  const progress = progressFrom(issues);
  const lead = members.find((m) => m.userId === epic.assigneeId);

  const byStatus = ISSUE_STATUSES.map((s) => ({
    ...s,
    count: issues.filter((c) => c.status === s.value).length,
  })).filter((s) => s.count > 0);

  return (
    <div className="flex flex-col gap-4 p-5 bg-[#0F1012] border border-[#26292F] rounded-2xl hover:border-[#A78BFA]/40 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <button
          onClick={() => setPeekIssueId(epic.id)}
          className="flex items-start gap-3 min-w-0 text-left group"
        >
          <div className="w-9 h-9 rounded-xl bg-[#A78BFA]/15 flex items-center justify-center text-[#A78BFA] shrink-0">
            <Zap className="w-4.5 h-4.5" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-mono text-[10px] text-[#5B616E] font-medium">
              {epic.identifier}
            </span>
            <h3 className="text-sm font-semibold text-[#F7F8F8] truncate group-hover:text-[#A78BFA] transition-colors">
              {epic.title}
            </h3>
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <PriorityBadge priority={epic.priority} />
          <StatusBadge status={epic.status} />
        </div>
      </div>

      {epic.description && (
        <p className="text-xs text-[#8A8F98] line-clamp-2">{epic.description}</p>
      )}

      <EpicProgress progress={progress} />

      {byStatus.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#5B616E]">
          {byStatus.map((s) => (
            <span key={s.value} className="font-mono tabular-nums">
              {s.count} {s.label.toLowerCase()}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-[#1C1E22]">
        {lead ? (
          <div className="flex items-center gap-2">
            <Avatar name={lead.displayName} src={lead.photoURL} size="sm" />
            <span className="text-xs text-[#8A8F98] truncate">{lead.displayName}</span>
          </div>
        ) : (
          <span className="text-xs text-[#5B616E]">Sin responsable</span>
        )}

        <button
          onClick={() => setFilterState({ epicId: epic.id })}
          className="flex items-center gap-1 text-xs text-[#8A8F98] hover:text-[#A78BFA] transition-colors"
        >
          Ver issues
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
