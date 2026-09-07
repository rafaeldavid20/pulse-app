'use client';

import React, { useEffect, useState } from 'react';
import { X, Trash2, Send } from 'lucide-react';
import { useIssueStore } from '@/stores/issueStore';
import { useAppStore } from '@/stores/appStore';
import { StatusBadge } from './StatusBadge';
import { LabelPicker } from '@/components/labels/LabelPicker';
import { Issue, IssueStatus, IssuePriority, Member, Comment } from '@/types';
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from '@/lib/constants/issue';
import { formatTimeAgo } from '@/lib/utils';
import { subscribeIssueComments, createComment } from '@/lib/firestore';

interface IssuePeekBodyProps {
  issue: Issue;
  members: Member[];
  updateIssue: (id: string, updates: Partial<Issue>) => void;
  deleteIssue: (id: string) => void;
  onClose: () => void;
}

/**
 * Keyed by `issue.id` from the parent so switching to a different issue
 * remounts this component and resets `titleDraft` from the new issue's
 * title — avoids syncing prop -> state via a `useEffect` (which
 * react-hooks/set-state-in-effect flags, since it can cascade renders).
 */
function CommentsSection({ issueId, members }: { issueId: string; members: Member[] }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const unsub = subscribeIssueComments(issueId, setComments);
    return unsub;
  }, [issueId]);

  const authorName = (authorId: string) => members.find((m) => m.userId === authorId)?.displayName || authorId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft('');
    try {
      await createComment(issueId, body);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al publicar el comentario.');
      setDraft(body);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-[#F7F8F8]">Actividad y Comentarios</h3>

      {comments.length === 0 ? (
        <p className="text-xs text-[#5B616E]">Todavía no hay comentarios.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {comments.map((c) => (
            <div key={c.id} className="flex flex-col gap-1 p-3 bg-[#16171A] border border-[#26292F] rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#F7F8F8]">{authorName(c.authorId)}</span>
                <span className="text-[10px] text-[#5B616E]">{formatTimeAgo(c.createdAt)}</span>
              </div>
              <p className="text-sm text-[#C4C7CD] whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escribí un comentario..."
          className="flex-1 bg-[#16171A] border border-[#26292F] focus:border-[#5E6AD2] rounded-lg px-3 py-2 text-sm text-[#F7F8F8] placeholder-[#5B616E] outline-none transition-colors"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="p-2 rounded-lg bg-[#5E6AD2] hover:bg-[#707CE6] text-white disabled:opacity-50 disabled:pointer-events-none transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

const IssuePeekBody: React.FC<IssuePeekBodyProps> = ({ issue, members, updateIssue, deleteIssue, onClose }) => {
  // Local draft for the title input, debounced against Firestore writes —
  // without this, every keystroke fired a Platform Action / direct write.
  const [titleDraft, setTitleDraft] = useState(issue.title);

  useEffect(() => {
    if (titleDraft === issue.title) return;
    const handle = setTimeout(() => {
      if (titleDraft.trim()) {
        updateIssue(issue.id, { title: titleDraft });
      }
    }, 500);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleDraft]);

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
              onClose();
            }}
            className="p-1.5 text-[#5B616E] hover:text-[#F75555] hover:bg-[#F75555]/10 rounded transition-colors"
            title="Eliminar issue"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="p-1.5 text-[#8A8F98] hover:text-[#F7F8F8] hover:bg-[#1E2024] rounded transition-colors"
            title="Cerrar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {/* Title Input — local draft, debounced 500ms before writing (see effect above) */}
        <input
          type="text"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
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
              {ISSUE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
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
              {ISSUE_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.value} - {p.label}
                </option>
              ))}
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

        <CommentsSection issueId={issue.id} members={members} />
      </div>
    </div>
  );
};

export const IssuePeekPanel: React.FC = () => {
  const peekIssueId = useIssueStore((s) => s.peekIssueId);
  const setPeekIssueId = useIssueStore((s) => s.setPeekIssueId);
  const issues = useIssueStore((s) => s.issues);
  const updateIssue = useIssueStore((s) => s.updateIssue);
  const deleteIssue = useIssueStore((s) => s.deleteIssue);
  const members = useAppStore((s) => s.members);

  if (!peekIssueId) return null;

  const issue = issues.find((i) => i.id === peekIssueId);
  if (!issue) return null;

  return (
    <IssuePeekBody
      key={issue.id}
      issue={issue}
      members={members}
      updateIssue={updateIssue}
      deleteIssue={deleteIssue}
      onClose={() => setPeekIssueId(null)}
    />
  );
};
