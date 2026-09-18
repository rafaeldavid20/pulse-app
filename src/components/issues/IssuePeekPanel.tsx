'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Trash2, Send, GitBranch, ExternalLink, Loader2, ChevronRight, Plus } from 'lucide-react';
import { useIssueStore } from '@/stores/issueStore';
import { useAppStore } from '@/stores/appStore';
import { useProjectStore } from '@/stores/projectStore';
import { useCycleStore } from '@/stores/cycleStore';
import { StatusBadge } from './StatusBadge';
import { AgentBadge } from './AgentBadge';
import { LabelPicker } from '@/components/labels/LabelPicker';
import { Issue, IssueStatus, IssuePriority, IssueType, IssueGitRef, Member, Comment } from '@/types';
import { ISSUE_PRIORITIES, ISSUE_STATUSES, canBeChild, canHaveChildren, isCompletedStatus } from '@/lib/constants/issue';
import { formatTimeAgo, cn } from '@/lib/utils';
import { markdownToHtml } from '@/lib/markdown';
import { IssueTypeBadge } from './IssueTypeBadge';
import { EpicProgress } from './EpicProgress';
import { ancestorsOf, childrenOf, progressOf, validParentsFor } from '@/lib/hierarchy';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceInfra } from '@/hooks/useWorkspaceInfra';
import { resolveRepo, describeRepoSource } from '@/lib/repo';
import { subscribeIssueComments, createComment, createIssueBranch } from '@/lib/firestore';
import { SelectPopover } from '@/components/ui/SelectPopover';

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
      {comments.length === 0 ? (
        <p className="text-xs text-tertiary">Todavía no hay comentarios.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {comments.map((c) => (
            <div key={c.id} className="flex flex-col gap-1 p-3 bg-elevated border border-default rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-primary">{authorName(c.authorId)}</span>
                <span className="text-[10px] text-tertiary">{formatTimeAgo(c.createdAt)}</span>
              </div>
              <p className="text-sm text-secondary whitespace-pre-wrap">{c.body}</p>
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
          className="flex-1 bg-elevated border border-default focus:border-accent rounded-lg px-3 py-2 text-sm text-primary placeholder-tertiary outline-none transition-colors"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          aria-label="Publicar comentario"
          className="p-2 rounded-lg bg-accent hover:bg-accent-hover text-white disabled:opacity-50 disabled:pointer-events-none transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

/**
 * El feed de actividad real (diff de campos, cambios de relación, veredictos de
 * QA) todavía no existe: el tipo `Activity` no se escribe desde ningún lado —
 * ver TES-162. Hasta que esa historia entregue el backend, esta pestaña es un
 * placeholder para no mentir en el título ("Actividad y Comentarios" cuando
 * solo había comentarios).
 */
function ActivitySection() {
  return (
    <p className="text-xs text-tertiary">
      Todavía no hay feed de actividad — se implementa en TES-162.
    </p>
  );
}

function ActivityAndCommentsSection({
  workspaceId,
  issueId,
  members,
}: {
  workspaceId: string;
  issueId: string;
  members: Member[];
}) {
  const [tab, setTab] = useState<'activity' | 'comments'>('comments');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-primary">Actividad y Comentarios</h3>
        <div className="flex items-center bg-surface border border-default p-0.5 rounded-md">
          <button
            type="button"
            onClick={() => setTab('activity')}
            className={cn(
              'px-2.5 py-1 rounded text-xs font-medium transition-colors',
              tab === 'activity' ? 'bg-hover text-primary' : 'text-secondary hover:text-primary'
            )}
          >
            Actividad
          </button>
          <button
            type="button"
            onClick={() => setTab('comments')}
            className={cn(
              'px-2.5 py-1 rounded text-xs font-medium transition-colors',
              tab === 'comments' ? 'bg-hover text-primary' : 'text-secondary hover:text-primary'
            )}
          >
            Comentarios
          </button>
        </div>
      </div>

      {tab === 'activity' ? (
        <ActivitySection />
      ) : (
        <CommentsSection workspaceId={workspaceId} issueId={issueId} members={members} />
      )}
    </div>
  );
}

/**
 * Ramas del issue, una por repo, y el selector para abrir una más.
 *
 * Un issue puede tocar varios repos —el modelo de dominio vive en pulse-app y
 * sus consumidores en pulse-backend—, así que esto lista `gitRefs` en vez de la
 * única `git`. Los issues anteriores a `gitRefs` solo tienen `git`, y se muestra
 * esa: por eso las dos fuentes se unifican acá y no en el store.
 */
function GitSection({ issue }: { issue: Issue }) {
  const projects = useProjectStore((s) => s.projects);
  const { repos: installationRepos, connected } = useWorkspaceInfra();
  const [creating, setCreating] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [error, setError] = useState<string | null>(null);

  // El límite lo pone el proyecto; si no declara ninguno, valen todos los de la
  // instalación, igual que en el backend.
  const project = projects.find((p) => p.id === issue.projectId);
  const allowedRepos =
    project?.repoFullNames && project.repoFullNames.length > 0
      ? project.repoFullNames.filter((r) => installationRepos.includes(r))
      : installationRepos;

  const refs: IssueGitRef[] =
    issue.gitRefs && issue.gitRefs.length > 0
      ? issue.gitRefs
      : issue.git?.branch
        ? [{ ...issue.git, repoFullName: issue.git.repoFullName || '(sin repo)' }]
        : [];

  const reposWithoutBranch = allowedRepos.filter(
    (r) => !refs.some((ref) => ref.repoFullName === r)
  );

  const handleCreateBranch = async () => {
    if (!selectedRepo) return;
    setCreating(true);
    setError(null);
    try {
      await createIssueBranch(issue.id, selectedRepo);
      setSelectedRepo('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la rama.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Git</label>

      {refs.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {refs.map((ref) => (
            <div
              key={ref.repoFullName}
              className="flex flex-col gap-1.5 p-3 bg-elevated border border-default rounded-lg text-xs"
            >
              <span className="text-[10px] text-tertiary font-mono truncate">
                {ref.repoFullName}
              </span>
              <a
                href={ref.branchUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-primary hover:text-accent font-mono"
              >
                <GitBranch className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{ref.branch}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
              {ref.prUrl && (
                <a
                  href={ref.prUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-secondary hover:text-accent"
                >
                  PR #{ref.prNumber} · {ref.prState}
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {!connected ? (
        <p className="text-xs text-tertiary">
          Conectá GitHub en Configuración para poder crear ramas.
        </p>
      ) : reposWithoutBranch.length === 0 ? (
        refs.length > 0 && (
          <p className="text-[11px] text-tertiary">
            Ya hay una rama en cada repo permitido por el proyecto.
          </p>
        )
      ) : (
        <div className="flex items-center gap-2">
          <SelectPopover
            value={selectedRepo}
            onChange={setSelectedRepo}
            disabled={creating}
            ariaLabel={refs.length > 0 ? 'Crear rama en otro repo' : 'Crear rama en'}
            placeholder={refs.length > 0 ? 'Crear rama en otro repo…' : 'Crear rama en…'}
            align="left"
            className="flex-1 min-w-0 [&>button]:w-full"
            options={reposWithoutBranch.map((r) => ({ value: r, label: r }))}
          />
          <button
            onClick={handleCreateBranch}
            disabled={creating || !selectedRepo}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-hover hover:bg-active text-primary border border-default rounded-md disabled:opacity-40 disabled:pointer-events-none transition-colors shrink-0"
          >
            {creating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <GitBranch className="w-3.5 h-3.5" />
            )}
            Crear
          </button>
        </div>
      )}

      {error && <p className="text-xs text-priority-urgent">{error}</p>}
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
        <label className="text-xs font-semibold text-secondary uppercase tracking-wider">
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
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-elevated border border-default text-secondary hover:text-primary hover:border-accent/40 transition-colors max-w-[200px]"
              >
                <IssueTypeBadge type={a.type ?? 'task'} />
                <span className="font-mono text-[10px] text-tertiary">{a.identifier}</span>
                <span className="truncate">{a.title}</span>
              </button>
              <ChevronRight className="w-3 h-3 text-muted shrink-0" />
            </React.Fragment>
          ))}
          <span className="px-2 py-1 font-mono text-[10px] text-tertiary">
            {issue.identifier}
          </span>
        </div>
      )}

      {/* Selector de padre */}
      {canBeChild(type) && (
        <div className="flex items-center justify-between gap-3 p-3 bg-elevated border border-default rounded-lg">
          <span className="text-xs text-secondary shrink-0">
            {type === 'subtask' ? 'Historia padre' : 'Épica'}
          </span>
          <SelectPopover
            value={issue.parentId || ''}
            onChange={handleReparent}
            disabled={parentOptions.length === 0}
            ariaLabel={type === 'subtask' ? 'Historia padre' : 'Épica'}
            placeholder={parentOptions.length === 0 ? 'No hay padres disponibles' : 'Sin asignar'}
            className="max-w-[60%]"
            options={parentOptions.map((p) => ({
              value: p.id,
              label: `${p.identifier} · ${p.title}`,
            }))}
          />
        </div>
      )}

      {/* Hijos */}
      {canAddChildren && (
        <div className="flex flex-col gap-2">
          {children.length > 0 && (
            <>
              <EpicProgress progress={progress} />
              <div className="flex flex-col rounded-lg border border-default overflow-hidden">
                {children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => onOpenIssue(child.id)}
                    className="flex items-center gap-2.5 px-3 py-2 bg-elevated hover:bg-hover border-b border-subtle last:border-b-0 text-left transition-colors"
                  >
                    <StatusBadge status={child.status} />
                    <span className="font-mono text-[10px] text-tertiary shrink-0">
                      {child.identifier}
                    </span>
                    <span
                      className={cn(
                        'text-xs truncate flex-1',
                        isCompletedStatus(child.status)
                          ? 'text-tertiary line-through'
                          : 'text-primary'
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
            <Plus className="w-3.5 h-3.5 text-tertiary shrink-0" />
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={
                childType === 'story' ? 'Añadir historia a la épica…' : 'Añadir sub-tarea…'
              }
              className="flex-1 bg-transparent border-none outline-none text-xs text-primary placeholder-tertiary py-1.5"
            />
            {newTitle.trim() && (
              <button
                type="submit"
                disabled={creating}
                className="px-2.5 py-1 text-[11px] rounded-md bg-accent hover:bg-accent-hover text-white disabled:opacity-50 transition-colors shrink-0"
              >
                {creating ? 'Creando…' : 'Crear'}
              </button>
            )}
          </form>
        </div>
      )}

      {error && <p className="text-xs text-priority-urgent">{error}</p>}
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
        <label className="text-xs font-semibold text-secondary uppercase tracking-wider">
          Repositorio
        </label>
        <div className="h-9 rounded-lg bg-elevated border border-default animate-pulse" />
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-secondary uppercase tracking-wider">
          Repositorio
        </label>
        <p className="text-xs text-tertiary">
          Este workspace no tiene GitHub conectado. Conectalo en Configuración → GitHub para que
          los agentes puedan crear ramas.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs font-semibold text-secondary uppercase tracking-wider">
        {isEpicIssue ? 'Defaults de la épica' : 'Repositorio'}
      </label>

      <div className="flex flex-col gap-2 p-3 bg-elevated border border-default rounded-lg">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-secondary shrink-0 flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5" />
            {isEpicIssue ? 'Repo por defecto' : 'Repo'}
          </span>
          <SelectPopover
            value={own}
            onChange={handleRepo}
            ariaLabel={isEpicIssue ? 'Repo por defecto' : 'Repo'}
            placeholder={
              isEpicIssue
                ? 'Sin definir'
                : resolved.source === 'issue'
                  ? 'Heredar'
                  : `Heredar (${resolved.repo ?? 'sin repo'})`
            }
            className="max-w-[62%]"
            options={repos.map((r) => ({ value: r, label: r }))}
          />
        </div>

        <p
          className={cn(
            'text-[11px]',
            resolved.source === 'none' ? 'text-priority-high' : 'text-tertiary'
          )}
        >
          {resolved.repo ? (
            <>
              <span className="font-mono text-secondary">{resolved.repo}</span>
              {' · '}
              {describeRepoSource(resolved)}
            </>
          ) : (
            describeRepoSource(resolved)
          )}
        </p>

        {isEpicIssue && (
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-default">
            <span className="text-xs text-secondary shrink-0">Agente por defecto</span>
            <SelectPopover
              value={issue.defaultAssigneeId || ''}
              onChange={handleDefaultAssignee}
              ariaLabel="Agente por defecto"
              placeholder="Sin definir"
              className="max-w-[62%]"
              options={members
                .filter((m) => m.isAgent)
                .map((m) => ({
                  value: m.userId,
                  label: `${m.displayName}${m.agentKind ? ` (${m.agentKind})` : ''}`,
                }))}
            />
          </div>
        )}

        {isEpicIssue && (
          <p className="text-[11px] text-tertiary">
            Preselecciona el asignado al crear issues dentro de esta épica. No los reasigna solo:
            un issue que dejaste sin asignar sigue sin asignar.
          </p>
        )}
      </div>

      {error && <p className="text-xs text-priority-urgent">{error}</p>}
    </div>
  );
}

/** Textarea de markdown con una pestaña de vista previa renderizada (ver `@/lib/markdown`). */
function DescriptionSection({
  issue,
  updateIssue,
}: {
  issue: Issue;
  updateIssue: (id: string, updates: Partial<Issue>) => void;
}) {
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const html = useMemo(() => markdownToHtml(issue.description || ''), [issue.description]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-secondary uppercase tracking-wider">
          Descripción
        </label>
        <div className="flex items-center bg-surface border border-default p-0.5 rounded-md">
          <button
            type="button"
            onClick={() => setMode('write')}
            className={cn(
              'px-2.5 py-1 rounded text-xs font-medium transition-colors',
              mode === 'write' ? 'bg-hover text-primary' : 'text-secondary hover:text-primary'
            )}
          >
            Escribir
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={cn(
              'px-2.5 py-1 rounded text-xs font-medium transition-colors',
              mode === 'preview' ? 'bg-hover text-primary' : 'text-secondary hover:text-primary'
            )}
          >
            Vista previa
          </button>
        </div>
      </div>

      {mode === 'write' ? (
        <textarea
          value={issue.description || ''}
          onChange={(e) => updateIssue(issue.id, { description: e.target.value })}
          placeholder="Añade una descripción con Markdown..."
          rows={5}
          className="w-full bg-elevated border border-default focus:border-accent rounded-lg p-3 text-sm text-primary placeholder-tertiary outline-none transition-colors resize-y font-mono"
        />
      ) : html ? (
        <div
          className="min-h-[8rem] w-full bg-elevated border border-default rounded-lg p-3 text-sm text-primary [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mb-1 [&_h2]:text-base [&_h2]:font-bold [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:mb-1 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_li]:mb-0.5 [&_a]:text-accent [&_a]:underline [&_code]:bg-hover [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-hover [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-semibold [&_em]:italic"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="min-h-[8rem] w-full bg-elevated border border-default rounded-lg p-3 text-xs text-tertiary">
          Sin descripción.
        </p>
      )}
    </div>
  );
}

/** Escala de estimación que usa el panel (Fibonacci recortado, 0 = trivial). */
const ISSUE_ESTIMATES = [0, 1, 2, 3, 5, 8];

/** Umbral en px para que un swipe hacia abajo del handle mobile cierre el panel. */
const SWIPE_CLOSE_THRESHOLD = 90;

const IssuePeekBody: React.FC<IssuePeekBodyProps> = ({ issue, members, updateIssue, deleteIssue, onClose, onOpenIssue }) => {
  const projects = useProjectStore((s) => s.projects);
  // Solo ciclos del propio equipo del issue: asignar uno de otro equipo no
  // tiene sentido y el picker de proyecto no lo ofrece tampoco.
  const cycles = useCycleStore((s) => s.cycles).filter((c) => c.teamId === issue.teamId);

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

  // En mobile el panel ocupa toda la pantalla (ver clase w-full del root):
  // sin un gesto de cierre, la única salida es el botón X del header. El
  // handle solo trackea arrastres hacia abajo; para arriba se ignora, así no
  // compite con el scroll del contenido.
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartY = useRef<number | null>(null);

  // La animación de entrada usa `animation-fill-mode: forwards`, que fija su
  // transform final por encima de cualquier `style.transform` en línea (el
  // origen "animations" pisa al inline en la cascada) mientras siga activa.
  // Sin soltar la clase después de que corre, el translateY del drag nunca se
  // vería.
  const [entered, setEntered] = useState(false);

  const handleDragStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    setDragging(true);
  };

  const handleDragMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    setDragY(Math.max(0, delta));
  };

  const handleDragEnd = () => {
    setDragging(false);
    dragStartY.current = null;
    if (dragY > SWIPE_CLOSE_THRESHOLD) {
      onClose();
    } else {
      setDragY(0);
    }
  };

  return (
    <div
      onAnimationEnd={() => setEntered(true)}
      className={cn(
        'fixed inset-y-0 right-0 z-40 w-full max-w-xl bg-surface border-l border-default shadow-2xl flex flex-col glass-panel',
        !entered && 'animate-slide-in-right'
      )}
      style={{
        transform: dragY ? `translateY(${dragY}px)` : undefined,
        transition: dragging ? 'none' : 'transform 0.2s ease-out',
      }}
    >
      {/* Drag Handle — solo mobile, gesto de swipe-down para cerrar */}
      <div
        aria-hidden="true"
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
        className="sm:hidden flex items-center justify-center py-2 shrink-0 touch-none"
      >
        <div className="w-9 h-1 rounded-full bg-default" />
      </div>

      {/* Header Bar */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-subtle bg-elevated">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-tertiary font-medium">
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
            aria-label="Eliminar issue"
            className="p-1.5 text-tertiary hover:text-priority-urgent hover:bg-priority-urgent/10 rounded-md transition-colors"
            title="Eliminar issue"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            aria-label="Cerrar panel"
            className="p-1.5 text-secondary hover:text-primary hover:bg-hover rounded-md transition-colors"
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
          className="text-xl font-bold text-primary bg-transparent border-none outline-none focus:ring-0 p-0"
        />

        {/* Quick Property Pickers Grid */}
        <div className="grid grid-cols-2 gap-3 p-3.5 bg-elevated border border-default rounded-lg text-xs">
          {/* Status Dropdown */}
          <div className="flex items-center justify-between">
            <span className="text-secondary">Estado</span>
            <SelectPopover
              value={issue.status}
              onChange={(v) => updateIssue(issue.id, { status: v as IssueStatus })}
              ariaLabel="Estado"
              options={ISSUE_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            />
          </div>

          {/* Priority Dropdown */}
          <div className="flex items-center justify-between">
            <span className="text-secondary">Prioridad</span>
            <SelectPopover
              value={String(issue.priority)}
              onChange={(v) => updateIssue(issue.id, { priority: parseInt(v, 10) as IssuePriority })}
              ariaLabel="Prioridad"
              options={ISSUE_PRIORITIES.map((p) => ({
                value: String(p.value),
                label: `${p.value} - ${p.label}`,
              }))}
            />
          </div>

          {/* Assignee Picker */}
          <div className="flex items-center justify-between">
            <span className="text-secondary flex items-center gap-1.5">
              Asignado a
              {issue.agent?.state && issue.agent.state !== 'idle' && <AgentBadge state={issue.agent.state} />}
            </span>
            <SelectPopover
              value={issue.assigneeId || ''}
              onChange={(v) => updateIssue(issue.id, { assigneeId: v || undefined })}
              ariaLabel="Asignado a"
              placeholder="Sin asignar"
              options={[
                { value: '', label: 'Sin asignar' },
                { heading: 'Humanos', options: members.filter((m) => !m.isAgent).map((m) => ({ value: m.userId, label: m.displayName })) },
                { heading: 'Agentes', options: members.filter((m) => m.isAgent).map((m) => ({ value: m.userId, label: m.displayName })) },
              ]}
            />
          </div>

          {/* Project Picker */}
          <div className="flex items-center justify-between">
            <span className="text-secondary">Proyecto</span>
            <SelectPopover
              value={issue.projectId || ''}
              onChange={(v) => updateIssue(issue.id, { projectId: v || undefined })}
              ariaLabel="Proyecto"
              placeholder="Sin proyecto"
              className="max-w-[60%]"
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>

          {/* Cycle Picker */}
          <div className="flex items-center justify-between">
            <span className="text-secondary">Ciclo</span>
            <SelectPopover
              value={issue.cycleId || ''}
              onChange={(v) => updateIssue(issue.id, { cycleId: v || undefined })}
              ariaLabel="Ciclo"
              placeholder="Sin ciclo"
              className="max-w-[60%]"
              options={cycles.map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>

          {/* Start Date */}
          <div className="flex items-center justify-between">
            <span className="text-secondary">Fecha de inicio</span>
            <input
              type="date"
              value={issue.startDate ? issue.startDate.slice(0, 10) : ''}
              onChange={(e) => updateIssue(issue.id, { startDate: e.target.value || undefined })}
              className="bg-hover text-primary border border-default rounded-md px-2.5 py-1.5 outline-none text-xs cursor-pointer"
            />
          </div>

          {/* Due Date */}
          <div className="flex items-center justify-between">
            <span className="text-secondary">Vencimiento</span>
            <input
              type="date"
              value={issue.dueDate ? issue.dueDate.slice(0, 10) : ''}
              onChange={(e) => updateIssue(issue.id, { dueDate: e.target.value || undefined })}
              className="bg-hover text-primary border border-default rounded-md px-2.5 py-1.5 outline-none text-xs cursor-pointer"
            />
          </div>

          {/* Estimate */}
          <div className="flex items-center justify-between">
            <span className="text-secondary">Estimación</span>
            <SelectPopover
              value={issue.estimate != null ? String(issue.estimate) : ''}
              onChange={(v) =>
                updateIssue(issue.id, { estimate: v === '' ? undefined : parseInt(v, 10) })
              }
              ariaLabel="Estimación"
              placeholder="Sin estimar"
              options={ISSUE_ESTIMATES.map((n) => ({ value: String(n), label: String(n) }))}
            />
          </div>

          {/* Created Date */}
          <div className="flex items-center justify-between">
            <span className="text-secondary">Creado</span>
            <span className="text-primary font-mono">{formatTimeAgo(issue.createdAt)}</span>
          </div>
        </div>

        <HierarchySection issue={issue} onOpenIssue={onOpenIssue} />

        <RepoSection issue={issue} />

        <DescriptionSection issue={issue} updateIssue={updateIssue} />

        {/* Labels Section */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-secondary uppercase tracking-wider">
            Etiquetas
          </label>
          <LabelPicker
            selectedLabelIds={issue.labelIds || []}
            onChange={(labelIds) => updateIssue(issue.id, { labelIds })}
          />
        </div>

        <hr className="border-subtle" />

        <GitSection issue={issue} />

        <ActivityAndCommentsSection workspaceId={issue.workspaceId} issueId={issue.id} members={members} />
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
