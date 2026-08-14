'use client';

import React, { useState } from 'react';
import { X, Trash2, Calendar, UserCheck, Tag, AlertCircle } from 'lucide-react';
import { useIssueStore } from '@/stores/issueStore';
import { useAppStore } from '@/stores/appStore';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LabelPicker } from '@/components/labels/LabelPicker';
import { IssueStatus, IssuePriority } from '@/types';
import { formatTimeAgo, getPriorityLabel, getStatusLabel } from '@/lib/utils';

export const IssuePeekPanel: React.FC = () => {
  const peekIssueId = useIssueStore((s) => s.peekIssueId);
  const setPeekIssueId = useIssueStore((s) => s.setPeekIssueId);
  const issues = useIssueStore((s) => s.issues);
  const updateIssue = useIssueStore((s) => s.updateIssue);
  const deleteIssue = useIssueStore((s) => s.deleteIssue);
  const members = useAppStore((s) => s.members);

  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Array<{ id: string; author: string; text: string; date: string }>>([
    {
      id: 'c-1',
      author: 'Rafael Rodriguez',
      text: 'Revisé la configuración de Firebase Auth y los tokens se refrescan correctamente.',
      date: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
  ]);

  if (!peekIssueId) return null;

  const issue = issues.find((i) => i.id === peekIssueId);
  if (!issue) return null;

  const assignee = members.find((m) => m.userId === issue.assigneeId);

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setComments((prev) => [
      ...prev,
      {
        id: `c-${Date.now()}`,
        author: 'Rafael Rodriguez',
        text: commentText.trim(),
        date: new Date().toISOString(),
      },
    ]);
    setCommentText('');
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-xl bg-[#0F1012] border-l border-[#26292F] shadow-2xl flex flex-col animate-slide-in-right glass-panel">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1C1E22] bg-[#16171A]">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-[#5B616E] font-medium">
            {issue.identifier}
          </span>
          <StatusBadge status={issue.status} showLabel />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              deleteIssue(issue.id);
              setPeekIssueId(null);
            }}
            className="p-1.5 text-[#5B616E] hover:text-[#F75555] hover:bg-[#F75555]/10 rounded transition-colors"
            title="Eliminar issue"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setPeekIssueId(null)}
            className="p-1.5 text-[#8A8F98] hover:text-[#F7F8F8] hover:bg-[#1E2024] rounded transition-colors"
            title="Cerrar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {/* Title Input */}
        <input
          type="text"
          value={issue.title}
          onChange={(e) => updateIssue(issue.id, { title: e.target.value })}
          className="text-xl font-bold text-[#F7F8F8] bg-transparent border-none outline-none focus:ring-0 p-0"
        />

        {/* Quick Property Pickers Grid */}
        <div className="grid grid-cols-2 gap-3 p-3.5 bg-[#16171A] border border-[#26292F] rounded-lg text-xs">
          {/* Status Dropdown */}
          <div className="flex items-center justify-between">
            <span className="text-[#8A8F98]">Estado</span>
            <select
              value={issue.status}
              onChange={(e) => updateIssue(issue.id, { status: e.target.value as IssueStatus })}
              className="bg-[#1E2024] text-[#F7F8F8] border border-[#26292F] rounded px-2 py-1 outline-none text-xs cursor-pointer"
            >
              <option value="backlog">Backlog</option>
              <option value="todo">Por hacer</option>
              <option value="in_progress">En progreso</option>
              <option value="in_review">En revisión</option>
              <option value="done">Completado</option>
              <option value="canceled">Cancelado</option>
            </select>
          </div>

          {/* Priority Dropdown */}
          <div className="flex items-center justify-between">
            <span className="text-[#8A8F98]">Prioridad</span>
            <select
              value={issue.priority}
              onChange={(e) =>
                updateIssue(issue.id, { priority: parseInt(e.target.value, 10) as IssuePriority })
              }
              className="bg-[#1E2024] text-[#F7F8F8] border border-[#26292F] rounded px-2 py-1 outline-none text-xs cursor-pointer"
            >
              <option value={1}>1 - Urgente</option>
              <option value={2}>2 - Alta</option>
              <option value={3}>3 - Media</option>
              <option value={4}>4 - Baja</option>
              <option value={0}>0 - Sin prioridad</option>
            </select>
          </div>

          {/* Assignee Picker */}
          <div className="flex items-center justify-between">
            <span className="text-[#8A8F98]">Asignado a</span>
            <select
              value={issue.assigneeId || ''}
              onChange={(e) => updateIssue(issue.id, { assigneeId: e.target.value || undefined })}
              className="bg-[#1E2024] text-[#F7F8F8] border border-[#26292F] rounded px-2 py-1 outline-none text-xs cursor-pointer"
            >
              <option value="">Sin asignar</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Created Date */}
          <div className="flex items-center justify-between">
            <span className="text-[#8A8F98]">Creado</span>
            <span className="text-[#F7F8F8] font-mono">{formatTimeAgo(issue.createdAt)}</span>
          </div>
        </div>

        {/* Description Section */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-[#8A8F98] uppercase tracking-wider">
            Descripción
          </label>
          <textarea
            value={issue.description || ''}
            onChange={(e) => updateIssue(issue.id, { description: e.target.value })}
            placeholder="Añade una descripción con Markdown..."
            rows={5}
            className="w-full bg-[#16171A] border border-[#26292F] focus:border-[#5E6AD2] rounded-lg p-3 text-sm text-[#F7F8F8] placeholder-[#5B616E] outline-none transition-colors resize-y font-mono"
          />
        </div>

        {/* Labels Section */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-[#8A8F98] uppercase tracking-wider">
            Etiquetas
          </label>
          <LabelPicker
            selectedLabelIds={issue.labelIds || []}
            onChange={(labelIds) => updateIssue(issue.id, { labelIds })}
          />
        </div>

        <hr className="border-[#1C1E22]" />

        {/* Activity & Comments */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-[#F7F8F8]">Actividad y Comentarios</h3>

          <form onSubmit={handleAddComment} className="flex flex-col gap-2">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Escribe un comentario..."
              rows={2}
              className="w-full bg-[#16171A] border border-[#26292F] focus:border-[#5E6AD2] rounded-lg p-3 text-sm text-[#F7F8F8] placeholder-[#5B616E] outline-none resize-none"
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={!commentText.trim()}>
                Comentar
              </Button>
            </div>
          </form>

          <div className="flex flex-col gap-3 mt-2">
            {comments.map((c) => (
              <div key={c.id} className="p-3 bg-[#16171A] border border-[#1C1E22] rounded-lg text-xs flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#F7F8F8]">{c.author}</span>
                  <span className="text-[#5B616E]">{formatTimeAgo(c.date)}</span>
                </div>
                <p className="text-[#8A8F98] leading-relaxed">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
