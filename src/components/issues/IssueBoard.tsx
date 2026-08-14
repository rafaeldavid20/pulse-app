'use client';

import React, { useState } from 'react';
import { IssueStatus } from '@/types';
import { useIssues } from '@/hooks/useIssues';
import { useIssueStore } from '@/stores/issueStore';
import { useAppStore } from '@/stores/appStore';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { Avatar } from '@/components/ui/Avatar';
import { getStatusLabel, cn } from '@/lib/utils';
import { Plus, GripVertical, Trash2 } from 'lucide-react';

const COLUMNS: IssueStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'canceled'];

export const IssueBoard: React.FC = () => {
  const { issuesByStatus } = useIssues();
  const setPeekIssueId = useIssueStore((s) => s.setPeekIssueId);
  const setSelectedIssueId = useIssueStore((s) => s.setSelectedIssueId);
  const updateIssue = useIssueStore((s) => s.updateIssue);
  const deleteIssue = useIssueStore((s) => s.deleteIssue);
  const setCreateIssueOpen = useAppStore((s) => s.setCreateIssueOpen);
  const members = useAppStore((s) => s.members);

  const [draggedIssueId, setDraggedIssueId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<IssueStatus | null>(null);

  const handleDragStart = (e: React.DragEvent, issueId: string) => {
    e.dataTransfer.setData('text/plain', issueId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedIssueId(issueId);
  };

  const handleDragEnd = () => {
    setDraggedIssueId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, status: IssueStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDragLeave = (e: React.DragEvent, status: IssueStatus) => {
    e.preventDefault();
    if (dragOverColumn === status) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: IssueStatus) => {
    e.preventDefault();
    const issueId = e.dataTransfer.getData('text/plain') || draggedIssueId;
    if (issueId) {
      updateIssue(issueId, { status: targetStatus });
    }
    setDraggedIssueId(null);
    setDragOverColumn(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-6 pt-2 min-h-[calc(100vh-140px)]">
      {COLUMNS.map((status) => {
        const columnIssues = issuesByStatus[status] || [];
        const isDragTarget = dragOverColumn === status;

        return (
          <div
            key={status}
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={(e) => handleDragLeave(e, status)}
            onDrop={(e) => handleDrop(e, status)}
            className={cn(
              'w-72 shrink-0 flex flex-col bg-[#0F1012] border rounded-xl overflow-hidden max-h-[calc(100vh-160px)] transition-all duration-150',
              isDragTarget
                ? 'border-[#5E6AD2] bg-[#5E6AD2]/5 shadow-lg shadow-[#5E6AD2]/10 scale-[1.01]'
                : 'border-[#1C1E22]'
            )}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between px-3.5 py-3 border-b border-[#1C1E22] bg-[#16171A]">
              <div className="flex items-center gap-2">
                <StatusBadge status={status} />
                <span className="font-semibold text-xs text-[#F7F8F8]">
                  {getStatusLabel(status)}
                </span>
                <span className="text-xs text-[#5B616E] font-mono">
                  {columnIssues.length}
                </span>
              </div>

              <button
                onClick={() => setCreateIssueOpen(true)}
                className="text-[#8A8F98] hover:text-[#F7F8F8] p-1 rounded hover:bg-[#1E2024] transition-colors"
                title="Añadir issue"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Column Drop Zone */}
            <div className="p-2.5 flex flex-col gap-2 overflow-y-auto flex-1 min-h-[150px]">
              {columnIssues.length === 0 ? (
                <div
                  className={cn(
                    'p-6 text-center text-xs border border-dashed rounded-lg transition-colors flex flex-col items-center justify-center gap-1 select-none',
                    isDragTarget
                      ? 'border-[#5E6AD2] text-[#5E6AD2] bg-[#5E6AD2]/10 font-medium'
                      : 'border-[#1C1E22] text-[#5B616E]'
                  )}
                >
                  {isDragTarget ? 'Soltar aquí' : 'Arrastra un issue aquí'}
                </div>
              ) : (
                columnIssues.map((issue) => {
                  const assignee = members.find((m) => m.userId === issue.assigneeId);
                  const isBeingDragged = draggedIssueId === issue.id;

                  return (
                    <div
                      key={issue.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, issue.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => {
                        setSelectedIssueId(issue.id);
                        setPeekIssueId(issue.id);
                      }}
                      className={cn(
                        'group flex flex-col gap-2 p-3 bg-[#16171A] hover:bg-[#1E2024] border border-[#26292F] hover:border-[#32363F] rounded-lg cursor-grab active:cursor-grabbing transition-all shadow-sm select-none',
                        isBeingDragged && 'opacity-30 border-dashed border-[#5E6AD2]'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <GripVertical className="w-3 h-3 text-[#5B616E] opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
                          <span className="font-mono text-[11px] text-[#5B616E] font-medium truncate">
                            {issue.identifier}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <PriorityBadge priority={issue.priority} />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteIssue(issue.id);
                            }}
                            className="p-1 text-[#5B616E] hover:text-[#F75555] opacity-0 group-hover:opacity-100 hover:bg-[#F75555]/10 rounded transition-all"
                            title="Eliminar issue"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-[#F7F8F8] font-medium line-clamp-2 leading-relaxed">
                        {issue.title}
                      </p>

                      <div className="flex items-center justify-between pt-1 border-t border-[#1C1E22] mt-1">
                        <div className="flex items-center gap-1">
                          {issue.labelIds && issue.labelIds[0] && (
                            <span className="text-[10px] text-[#8A8F98] bg-[#1E2024] px-1.5 py-0.5 rounded border border-[#26292F]">
                              {issue.labelIds[0]}
                            </span>
                          )}
                        </div>

                        <Avatar
                          name={assignee?.displayName}
                          src={assignee?.photoURL}
                          size="sm"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
