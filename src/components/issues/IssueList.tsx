'use client';

import React from 'react';
import { Issue, IssueStatus } from '@/types';
import { useIssueStore } from '@/stores/issueStore';
import { useAppStore } from '@/stores/appStore';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate, cn } from '@/lib/utils';
import { Trash2, CheckCircle2, X } from 'lucide-react';

interface IssueListProps {
  issues: Issue[];
}

export const IssueList: React.FC<IssueListProps> = ({ issues }) => {
  const selectedIssueId = useIssueStore((s) => s.selectedIssueId);
  const selectedIssueIds = useIssueStore((s) => s.selectedIssueIds);
  const setSelectedIssueId = useIssueStore((s) => s.setSelectedIssueId);
  const setPeekIssueId = useIssueStore((s) => s.setPeekIssueId);
  const toggleIssueSelection = useIssueStore((s) => s.toggleIssueSelection);
  const clearSelection = useIssueStore((s) => s.clearSelection);
  const deleteIssue = useIssueStore((s) => s.deleteIssue);
  const bulkUpdateStatus = useIssueStore((s) => s.bulkUpdateStatus);
  const members = useAppStore((s) => s.members);

  const handleBulkDelete = () => {
    selectedIssueIds.forEach((id) => deleteIssue(id));
    clearSelection();
  };

  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-[#26292F] rounded-lg my-6">
        <p className="text-[#8A8F98] text-sm mb-2">No se encontraron issues</p>
        <p className="text-[#5B616E] text-xs">
          Presiona <kbd className="bg-[#1E2024] px-1.5 py-0.5 rounded border border-[#26292F] text-[#F7F8F8]">C</kbd> para crear un nuevo issue
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col border border-[#1C1E22] rounded-lg overflow-hidden bg-[#0F1012] relative">
      {/* Floating Bulk Action Bar */}
      {selectedIssueIds.length > 0 && (
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-2.5 bg-[#5E6AD2]/15 border-b border-[#5E6AD2]/30 backdrop-blur-md animate-fade-in-scale">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[#F7F8F8]">
              {selectedIssueIds.length} {selectedIssueIds.length === 1 ? 'issue seleccionado' : 'issues seleccionados'}
            </span>
            <button
              onClick={clearSelection}
              className="text-xs text-[#8A8F98] hover:text-[#F7F8F8] underline"
            >
              Desmarcar
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => bulkUpdateStatus(selectedIssueIds, 'done')}
            >
              Marcar Completados
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={handleBulkDelete}
            >
              Eliminar
            </Button>
          </div>
        </div>
      )}

      {/* Rows */}
      {issues.map((issue) => {
        const isFocused = selectedIssueId === issue.id;
        const isChecked = selectedIssueIds.includes(issue.id);
        const assignee = members.find((m) => m.userId === issue.assigneeId);

        return (
          <div
            key={issue.id}
            onClick={() => {
              setSelectedIssueId(issue.id);
              setPeekIssueId(issue.id);
            }}
            className={cn(
              'group relative flex items-center justify-between px-3.5 py-2.5 border-b border-[#1C1E22] last:border-b-0 cursor-pointer transition-colors select-none text-sm',
              isFocused ? 'bg-[#1E2024]' : 'hover:bg-[#16171A]',
              isChecked && 'bg-[#5E6AD2]/10'
            )}
          >
            {/* Keyboard Focus Indicator Line */}
            {isFocused && (
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#5E6AD2]" />
            )}

            {/* Left Side: Checkbox, Identifier, Priority, Status, Title */}
            <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleIssueSelection(issue.id);
                }}
                className="w-3.5 h-3.5 rounded border-[#26292F] bg-[#16171A] text-[#5E6AD2] focus:ring-0 accent-[#5E6AD2] cursor-pointer opacity-0 group-hover:opacity-100 checked:opacity-100 transition-opacity"
              />

              <span className="font-mono text-xs text-[#5B616E] font-medium min-w-[64px] shrink-0">
                {issue.identifier}
              </span>

              <PriorityBadge priority={issue.priority} />

              <StatusBadge status={issue.status} />

              <span className="text-[#F7F8F8] font-normal truncate">
                {issue.title}
              </span>
            </div>

            {/* Right Side: Labels, Due Date, Assignee Avatar, Trash Delete Button */}
            <div className="flex items-center gap-3 shrink-0">
              {issue.labelIds && issue.labelIds.length > 0 && (
                <div className="hidden md:flex items-center gap-1">
                  {issue.labelIds.map((labelId) => (
                    <Badge key={labelId} variant="subtle" className="text-[11px] px-1.5 py-0">
                      {labelId}
                    </Badge>
                  ))}
                </div>
              )}

              {issue.dueDate && (
                <span className="text-xs text-[#5B616E] hidden sm:inline">
                  {formatDate(issue.dueDate)}
                </span>
              )}

              <Avatar
                name={assignee?.displayName}
                src={assignee?.photoURL}
                size="sm"
              />

              {/* Quick Delete Row Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteIssue(issue.id);
                }}
                className="p-1 text-[#5B616E] hover:text-[#F75555] opacity-0 group-hover:opacity-100 hover:bg-[#F75555]/10 rounded transition-all"
                title="Eliminar issue"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
