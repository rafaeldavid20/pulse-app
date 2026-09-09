'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, Trash2, Send, GitBranch, ExternalLink, Loader2, ChevronRight, Plus } from 'lucide-react';
import { useIssueStore } from '@/stores/issueStore';
import { useAppStore } from '@/stores/appStore';
import { StatusBadge } from './StatusBadge';
import { AgentBadge } from './AgentBadge';
import { LabelPicker } from '@/components/labels/LabelPicker';
import { Issue, IssueStatus, IssuePriority, IssueType, Member, Comment } from '@/types';
import { ISSUE_PRIORITIES, ISSUE_STATUSES, canBeChild, canHaveChildren, isCompletedStatus } from '@/lib/constants/issue';
import { formatTimeAgo, cn } from '@/lib/utils';
import { IssueTypeBadge } from './IssueTypeBadge';
import { EpicProgress } from './EpicProgress';
import { ancestorsOf, childrenOf, progressOf, validParentsFor } from '@/lib/hierarchy';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceInfra } from '@/hooks/useWorkspaceInfra';
import { resolveRepo, describeRepoSource } from '@/lib/repo';
import { subscribeIssueComments, createComment, createIssueBranch } from '@/lib/firestore';

interface IssuePeekBodyProps {
  issue: Issue;
  members: Member[];
  updateIssue: (id: string, updates: Partial<Issue>) => void;
  onOpenIssue: (id: string) => void;
  deleteIssue: (id: string) => void;
  onClose: () => void;
}

/**
 * Keyed by `issue.id` from the parent so switching to a different issue
 * remounts this component and resets `titleDraft` from the new issue's
 * title — avoids syncing prop -> state via a `useEffect` (which
 * react-hooks/set-state-in-effect flags, since it can cascade renders).
 */
function CommentsSection({ workspaceId, issueId, members }: { workspaceId: string; issueId: string; members: Member[] }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const unsub = subscribeIssueComments(workspaceId, issueId, setComments);
    return unsub;
  }, [workspaceId, issueId]);

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

function GitSection({ issue }: { issue: Issue }) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateBranch = async () => {
    setCreating(true);
    setError(null);
    try {
      await createIssueBranch(issue.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la rama.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-[#8A8F98] uppercase tracking-wider">Git</label>
      {issue.git?.branch ? (
        <div className="flex flex-col gap-1.5 p-3 bg-[#16171A] border border-[#26292F] rounded-lg text-xs">
          <a
            href={issue.git.branchUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[#F7F8F8] hover:text-[#5E6AD2] font-mono"
          >
            <GitBranch className="w-3.5 h-3.5 shrink-0" />
            {issue.git.branch}
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
          {issue.git.prUrl && (
            <a
              href={issue.git.prUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[#8A8F98] hover:text-[#5E6AD2]"
            >
              PR #{issue.git.prNumber} · {issue.git.prState}
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          )}
        </div>
      ) : (
        <button
          onClick={handleCreateBranch}
          disabled={creating}
          className="self-start flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-[#1E2024] hover:bg-[#26292E] text-[#F7F8F8] border border-[#26292F] rounded-md disabled:opacity-50 transition-colors"
        >
          {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitBranch className="w-3.5 h-3.5" />}
          Crear rama
        </button>
      )}
      {error && <p className="text-xs text-[#F75555]">{error}</p>}
    </div>
  );
}

/**
 * Ubicación del issue en el árbol: dónde está y qué cuelga de él.
 *
 * El breadcrumb y la lista de hijos se calculan del store (que tiene el
 * workspace entero suscrito), no de `subIssueCount` — así el panel no puede
 * mostrar "3/8" mientras la lista de abajo tiene 7 filas.
 */
function HierarchySection({
  issue,
  onOpenIssue,
}: {
  issue: Issue;
  onOpenIssue: (id: string) => void;
}) {
  const issues = useIssueStore((s) => s.issues);
  const moveIssue = useIssueStore((s) => s.moveIssue);
  const addIssue = useIssueStore((s) => s.addIssue);
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const { user } = useAuth();

  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const type = issue.type ?? 'task';
  const ancestors = useMemo(() => ancestorsOf(issues, issue), [issues, issue]);
  const children = useMemo(() => childrenOf(issues, issue.id), [issues, issue.id]);
  const progress = useMemo(() => progressOf(issues, issue), [issues, issue]);
  const parentOptions = useMemo(
    () => validParentsFor(issues, type, issue.id),
    [issues, type, issue.id]
  );

  // El tipo de los hijos que se crean inline: una épica recibe historias, una
  // historia o tarea recibe sub-tareas.
  const childType: IssueType = type === 'epic' ? 'story' : 'subtask';
  const canAddChildren = canHaveChildren(type);

  const handleReparent = async (parentId: string) => {
    setError('');
    try {
      await moveIssue(issue.id, parentId || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo mover el issue.');
    }
  };

  const handleCreateChild = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title || !user || !activeWorkspace) return;

    setCreating(true);
    setError('');
    try {
      await addIssue({
        workspaceId: activeWorkspace.id,
        teamId: issue.teamId,
        creatorId: user.uid,
        title,
        type: childType,
        parentId: issue.id,
        projectId: issue.projectId,
        status: 'todo',
        priority: issue.priority,
      });
      setNewTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el sub-issue.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-[#8A8F98] uppercase tracking-wider">
          Jerarquía
        </label>
        <IssueTypeBadge type={type} showLabel />
      </div>

      {/* Breadcrumb hacia la raíz */}
      {ancestors.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap text-xs">
          {ancestors.map((a) => (
            <React.Fragment key={a.id}>
              <button
                onClick={() => onOpenIssue(a.id)}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#16171A] border border-[#26292F] text-[#8A8F98] hover:text-[#F7F8F8] hover:border-[#5E6AD2]/40 transition-colors max-w-[200px]"
              >
                <IssueTypeBadge type={a.type ?? 'task'} />
                <span className="font-mono text-[10px] text-[#5B616E]">{a.identifier}</span>
                <span className="truncate">{a.title}</span>
              </button>
              <ChevronRight className="w-3 h-3 text-[#424651] shrink-0" />
            </React.Fragment>
          ))}
          <span className="px-2 py-1 font-mono text-[10px] text-[#5B616E]">
            {issue.identifier}
          </span>
        </div>
      )}

      {/* Selector de padre */}
      {canBeChild(type) && (
        <div className="flex items-center justify-between gap-3 p-3 bg-[#16171A] border border-[#26292F] rounded-lg">
          <span className="text-xs text-[#8A8F98] shrink-0">
            {type === 'subtask' ? 'Historia padre' : 'Épica'}
          </span>
          <select
            value={issue.parentId || ''}
            onChange={(e) => handleReparent(e.target.value)}
            disabled={parentOptions.length === 0}
            className="bg-[#1E2024] text-[#F7F8F8] border border-[#26292F] rounded px-2 py-1 outline-none text-xs cursor-pointer max-w-[60%] truncate disabled:opacity-50"
          >
            <option value="">
              {parentOptions.length === 0 ? 'No hay padres disponibles' : 'Sin asignar'}
            </option>
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.identifier} · {p.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Hijos */}
      {canAddChildren && (
        <div className="flex flex-col gap-2">
          {children.length > 0 && (
            <>
              <EpicProgress progress={progress} />
              <div className="flex flex-col rounded-lg border border-[#26292F] overflow-hidden">
                {children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => onOpenIssue(child.id)}
                    className="flex items-center gap-2.5 px-3 py-2 bg-[#16171A] hover:bg-[#1E2024] border-b border-[#1C1E22] last:border-b-0 text-left transition-colors"
                  >
                    <StatusBadge status={child.status} />
                    <span className="font-mono text-[10px] text-[#5B616E] shrink-0">
                      {child.identifier}
                    </span>
                    <span
                      className={cn(
                        'text-xs truncate flex-1',
                        isCompletedStatus(child.status)
                          ? 'text-[#5B616E] line-through'
                          : 'text-[#F7F8F8]'
                      )}
                    >
                      {child.title}
                    </span>
                    <IssueTypeBadge type={child.type ?? 'task'} />
                  </button>
                ))}
              </div>
            </>
          )}

          <form onSubmit={handleCreateChild} className="flex items-center gap-2">
            <Plus className="w-3.5 h-3.5 text-[#5B616E] shrink-0" />
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={
                childType === 'story' ? 'Añadir historia a la épica…' : 'Añadir sub-tarea…'
              }
              className="flex-1 bg-transparent border-none outline-none text-xs text-[#F7F8F8] placeholder-[#5B616E] py-1.5"
            />
            {newTitle.trim() && (
              <button
                type="submit"
                disabled={creating}
                className="px-2.5 py-1 text-[11px] rounded bg-[#5E6AD2] hover:bg-[#707CE6] text-white disabled:opacity-50 transition-colors shrink-0"
              >
                {creating ? 'Creando…' : 'Crear'}
              </button>
            )}
          </form>
        </div>
      )}

      {error && <p className="text-xs text-[#F75555]">{error}</p>}
    </div>
  );
}

/**
 * Repo del issue y, si es una épica, su agente por defecto.
 *
 * En una épica los dos campos son "defaults que heredan los hijos"; en
 * cualquier otro issue el repo es un override de lo que ya heredó. La UI dice
 * cuál de los dos casos es, porque la diferencia importa: cambiar el repo de
 * una épica mueve el trabajo de todos sus issues.
 */
function RepoSection({ issue }: { issue: Issue }) {
  const issues = useIssueStore((s) => s.issues);
  const updateIssue = useIssueStore((s) => s.updateIssue);
  const setIssueRepo = useIssueStore((s) => s.setIssueRepo);
  const members = useAppStore((s) => s.members);
  const { repos, agents, connected, loading } = useWorkspaceInfra();
  const [error, setError] = useState('');

  const isEpicIssue = (issue.type ?? 'task') === 'epic';

  const agentDefaults = useMemo(
    () => Object.fromEntries(agents.map((a) => [a.id, a.defaultRepo])),
    [agents]
  );
  const resolved = useMemo(
    () => resolveRepo(issues, issue, agentDefaults),
    [issues, issue, agentDefaults]
  );

  const own = issue.git?.repoFullName ?? '';

  const handleRepo = async (value: string) => {
    setError('');
    try {
      // Cadena vacía borra el campo en el backend, que es cómo se vuelve a
      // heredar de la épica.
      await setIssueRepo(issue.id, value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el repo.');
    }
  };

  const handleDefaultAssignee = async (value: string) => {
    setError('');
    try {
      await updateIssue(issue.id, { defaultAssigneeId: value || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el agente.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-[#8A8F98] uppercase tracking-wider">
          Repositorio
        </label>
        <div className="h-9 rounded-lg bg-[#16171A] border border-[#26292F] animate-pulse" />
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-[#8A8F98] uppercase tracking-wider">
          Repositorio
        </label>
        <p className="text-xs text-[#5B616E]">
          Este workspace no tiene GitHub conectado. Conectalo en Configuración → GitHub para que
          los agentes puedan crear ramas.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs font-semibold text-[#8A8F98] uppercase tracking-wider">
        {isEpicIssue ? 'Defaults de la épica' : 'Repositorio'}
      </label>

      <div className="flex flex-col gap-2 p-3 bg-[#16171A] border border-[#26292F] rounded-lg">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-[#8A8F98] shrink-0 flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5" />
            {isEpicIssue ? 'Repo por defecto' : 'Repo'}
          </span>
          <select
            value={own}
            onChange={(e) => handleRepo(e.target.value)}
            className="bg-[#1E2024] text-[#F7F8F8] border border-[#26292F] rounded px-2 py-1 outline-none text-xs cursor-pointer max-w-[62%] truncate"
          >
            <option value="">
              {isEpicIssue
                ? 'Sin definir'
                : resolved.source === 'issue'
                  ? 'Heredar'
                  : `Heredar (${resolved.repo ?? 'sin repo'})`}
            </option>
            {repos.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <p
          className={cn(
            'text-[11px]',
            resolved.source === 'none' ? 'text-[#F09436]' : 'text-[#5B616E]'
          )}
        >
          {resolved.repo ? (
            <>
              <span className="font-mono text-[#8A8F98]">{resolved.repo}</span>
              {' · '}
              {describeRepoSource(resolved)}
            </>
          ) : (
            describeRepoSource(resolved)
          )}
        </p>

        {isEpicIssue && (
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#26292F]">
            <span className="text-xs text-[#8A8F98] shrink-0">Agente por defecto</span>
            <select
              value={issue.defaultAssigneeId || ''}
              onChange={(e) => handleDefaultAssignee(e.target.value)}
              className="bg-[#1E2024] text-[#F7F8F8] border border-[#26292F] rounded px-2 py-1 outline-none text-xs cursor-pointer max-w-[62%] truncate"
            >
              <option value="">Sin definir</option>
              {members
                .filter((m) => m.isAgent)
                .map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.displayName}
                    {m.agentKind ? ` (${m.agentKind})` : ''}
                  </option>
                ))}
            </select>
          </div>
        )}

        {isEpicIssue && (
          <p className="text-[11px] text-[#5B616E]">
            Preselecciona el asignado al crear issues dentro de esta épica. No los reasigna solo:
            un issue que dejaste sin asignar sigue sin asignar.
          </p>
        )}
      </div>

      {error && <p className="text-xs text-[#F75555]">{error}</p>}
    </div>
  );
}

const IssuePeekBody: React.FC<IssuePeekBodyProps> = ({ issue, members, updateIssue, deleteIssue, onClose, onOpenIssue }) => {
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
            <span className="text-[#8A8F98] flex items-center gap-1.5">
              Asignado a
              {issue.agent?.state && issue.agent.state !== 'idle' && <AgentBadge state={issue.agent.state} />}
            </span>
            <select
              value={issue.assigneeId || ''}
              onChange={(e) => updateIssue(issue.id, { assigneeId: e.target.value || undefined })}
              className="bg-[#1E2024] text-[#F7F8F8] border border-[#26292F] rounded px-2 py-1 outline-none text-xs cursor-pointer"
            >
              <option value="">Sin asignar</option>
              <optgroup label="Humanos">
                {members
                  .filter((m) => !m.isAgent)
                  .map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.displayName}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Agentes">
                {members
                  .filter((m) => m.isAgent)
                  .map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.displayName}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          {/* Created Date */}
          <div className="flex items-center justify-between">
            <span className="text-[#8A8F98]">Creado</span>
            <span className="text-[#F7F8F8] font-mono">{formatTimeAgo(issue.createdAt)}</span>
          </div>
        </div>

        <HierarchySection issue={issue} onOpenIssue={onOpenIssue} />

        <RepoSection issue={issue} />

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

        <GitSection issue={issue} />

        <CommentsSection workspaceId={issue.workspaceId} issueId={issue.id} members={members} />
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
      onOpenIssue={(id) => setPeekIssueId(id)}
    />
  );
};
