'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  Inbox,
  UserCheck,
  Layers,
  FolderKanban,
  Pause,
  Play,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';
import { StatusBadge } from '@/components/issues/StatusBadge';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { getWorkspaceAgentBudget, updateWorkspaceGuardrails } from '@/lib/firestore';
import { execute, type Diagnostic } from '@/lib/pql';
import { usePqlContext } from '@/hooks/usePqlContext';
import { usePqlSearchStore } from '@/stores/pqlSearchStore';
import type { Issue } from '@/types';

export const CommandPalette: React.FC = () => {
  const workspaceId = useAppStore(s => s.activeWorkspace?.id);
  const actorId = useAppStore(s => s.workspaceUserId);
  const teamId = useAppStore(s => s.activeTeam?.id);
  return <CommandPaletteInner key={`${workspaceId}:${actorId}:${teamId}`} />;
};

const CommandPaletteInner: React.FC = () => {
  const router = useRouter();
  const isCmdKOpen = useAppStore((s) => s.isCmdKOpen);
  const setCmdKOpen = useAppStore((s) => s.setCmdKOpen);
  const setCreateIssueOpen = useAppStore((s) => s.setCreateIssueOpen);
  const workspaceId = useAppStore((s) => s.activeWorkspace?.id);
  const actorId = useAppStore(s => s.workspaceUserId);
  const activeTeam = useAppStore(s => s.activeTeam);
  const catalogReady = useAppStore(s => s.workspaceCatalogReady);
  const catalogError = useAppStore(s => s.workspaceCatalogError);

  const issues = useIssueStore((s) => s.issues);
  const setPeekIssueId = useIssueStore((s) => s.setPeekIssueId);
  const issuesLoaded = useIssueStore(s => s.issuesLoaded);
  const issuesError = useIssueStore(s => s.issuesError);
  const context = usePqlContext();
  const setSearch = usePqlSearchStore(s => s.setSearch);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<{ workspaceId: string; actorId: string | null; teamId?: string; source: string; inputIssues: Issue[]; context: typeof context; issues?: Issue[]; diagnostic?: Diagnostic } | null>(null);
  const trimmed = input.trimStart();
  const isPql = trimmed.startsWith('?');
  const source = isPql ? trimmed.slice(1) : '';
  const teamId = activeTeam && context.teams.some(t => t.id === activeTeam.id) ? activeTeam.id : undefined;
  const currentResult = result && result.workspaceId === workspaceId && result.actorId === actorId && result.teamId === teamId && result.source === source && result.inputIssues === issues && result.context === context ? result : null;
  const closePalette = useCallback(() => { setCmdKOpen(false); setInput(''); setResult(null); }, [setCmdKOpen]);

  const loadBudget = useCallback(() => getWorkspaceAgentBudget(workspaceId!), [workspaceId]);
  const { data: budget } = useLiveQuery(isCmdKOpen ? workspaceId : undefined, loadBudget);
  const agentsPaused = budget?.agentsPaused ?? false;

  const handleToggleAgentsPaused = async () => {
    if (!workspaceId) return;
    const nextValue = !agentsPaused;
    closePalette();
    try {
      await updateWorkspaceGuardrails(workspaceId, { agentsPaused: nextValue });
    } catch {
      // El presupuesto se vuelve a leer la próxima vez que se abra la paleta.
    }
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isCmdKOpen) closePalette(); else setCmdKOpen(true);
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [isCmdKOpen, setCmdKOpen, closePalette]);

  useEffect(() => {
    if (!isCmdKOpen || !isPql || !source.trim() || !workspaceId || !issuesLoaded || issuesError || !catalogReady || catalogError) return;
    const timer = window.setTimeout(() => {
      const evaluated = execute(source, issues.filter(i => i.workspaceId === workspaceId), { ...context, teamId, now: new Date().toISOString() });
      const scope = { workspaceId, actorId, teamId, source, inputIssues: issues, context };
      setResult(evaluated.ok ? { ...scope, issues: evaluated.issues } : { ...scope, diagnostic: evaluated.diagnostic });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [isCmdKOpen, isPql, source, workspaceId, actorId, issuesLoaded, issuesError, catalogReady, catalogError, issues, context, teamId]);

  if (!isCmdKOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-black/70 backdrop-blur-sm animate-fade-in-scale"
      onClick={closePalette} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); closePalette(); } }}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl">
        <Command label="Command Menu" shouldFilter={!isPql} className="w-full bg-surface border border-default rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center px-4 border-b border-subtle">
            <Search className="w-4 h-4 text-tertiary shrink-0 mr-2" />
            <Command.Input
              placeholder="Escribe un comando o busca un issue..."
              value={input} onValueChange={value => { setInput(value); setResult(null); }}
              autoFocus
            />
          </div>

          <Command.List className="max-h-96 overflow-y-auto p-2">
            {isPql ? <>
              <p role="status" className="p-3 text-xs text-secondary">
                {!source.trim() ? 'Escribí una consulta, por ejemplo: ? status = in_review ORDER BY updated DESC. Las fechas usan UTC.'
                  : issuesError ? `Error al cargar issues: ${issuesError}` : catalogError ? catalogError : !issuesLoaded || !catalogReady ? 'Cargando issues y catálogos…'
                  : !currentResult ? 'Evaluando consulta…' : currentResult.diagnostic ? `Línea ${currentResult.diagnostic.line}, columna ${currentResult.diagnostic.column + (currentResult.diagnostic.line === 1 ? input.length - trimmed.length + 1 : 0)}: ${currentResult.diagnostic.message}`
                  : currentResult.issues?.length ? `Mostrando ${Math.min(20, currentResult.issues.length)} de ${currentResult.issues.length}` : 'No se encontraron resultados.'}
              </p>
              {issuesLoaded && !issuesError && catalogReady && !catalogError && source.trim() && currentResult?.issues && <Command.Group heading="Resultados PQL">
                {currentResult.issues.slice(0, 20).map(issue => <Command.Item key={issue.id} value={issue.id} onSelect={() => { closePalette(); setPeekIssueId(issue.id); }}>
                  <span className="font-mono text-xs text-tertiary shrink-0">{issue.identifier}</span><StatusBadge status={issue.status} /><span className="truncate text-xs font-normal text-primary">{issue.title}</span><PriorityBadge priority={issue.priority} className="ml-auto shrink-0" />
                </Command.Item>)}
                {currentResult.issues.length > 20 && <Command.Item value="view-all-pql" onSelect={() => { if (!workspaceId || !actorId) return; setSearch({ workspaceId, actorId, teamId, query: source }); closePalette(); router.push('/pql-results'); }}>Ver todos los resultados</Command.Item>}
              </Command.Group>}
            </> : <>
            <Command.Empty className="p-4 text-center text-xs text-tertiary">
              No se encontraron resultados.
            </Command.Empty>

            {/* Quick Actions Group */}
            <Command.Group heading="Acciones rápidas">
              <Command.Item
                onSelect={() => {
                  closePalette();
                  setCreateIssueOpen(true);
                }}
              >
                <Plus className="w-4 h-4 text-accent" />
                <span>Crear nuevo issue...</span>
                <kbd className="ml-auto font-mono text-[10px] text-tertiary bg-hover px-1 rounded">
                  C
                </kbd>
              </Command.Item>

              <Command.Item onSelect={handleToggleAgentsPaused}>
                {agentsPaused ? (
                  <Play className="w-4 h-4 text-status-done" />
                ) : (
                  <Pause className="w-4 h-4 text-priority-urgent" />
                )}
                <span>{agentsPaused ? 'Reanudar agentes' : 'Pausar agentes'}</span>
              </Command.Item>
            </Command.Group>

            {/* Navigation Group */}
            <Command.Group heading="Navegación">
              <Command.Item
                onSelect={() => {
                  closePalette();
                  router.push('/inbox');
                }}
              >
                <Inbox className="w-4 h-4 text-secondary" />
                <span>Ir a Inbox</span>
                <kbd className="ml-auto font-mono text-[10px] text-tertiary">
                  G I
                </kbd>
              </Command.Item>

              <Command.Item
                onSelect={() => {
                  closePalette();
                  router.push('/my-issues');
                }}
              >
                <UserCheck className="w-4 h-4 text-secondary" />
                <span>Ir a Mis Issues</span>
                <kbd className="ml-auto font-mono text-[10px] text-tertiary">
                  G M
                </kbd>
              </Command.Item>

              <Command.Item
                onSelect={() => {
                  closePalette();
                  router.push('/team/eng/issues');
                }}
              >
                <Layers className="w-4 h-4 text-secondary" />
                <span>Ir a Engineering Issues</span>
                <kbd className="ml-auto font-mono text-[10px] text-tertiary">
                  G B
                </kbd>
              </Command.Item>

              <Command.Item
                onSelect={() => {
                  closePalette();
                  router.push('/team/eng/projects');
                }}
              >
                <FolderKanban className="w-4 h-4 text-secondary" />
                <span>Ir a Proyectos</span>
                <kbd className="ml-auto font-mono text-[10px] text-tertiary">
                  G P
                </kbd>
              </Command.Item>
            </Command.Group>

            {/* Issues Group */}
            <Command.Group heading="Issues recientes">
              {issues.filter(issue => issue.workspaceId === workspaceId).map((issue) => (
                <Command.Item
                  key={issue.id}
                  onSelect={() => {
                    closePalette();
                    setPeekIssueId(issue.id);
                  }}
                >
                  <span className="font-mono text-xs text-tertiary shrink-0">
                    {issue.identifier}
                  </span>
                  <StatusBadge status={issue.status} />
                  <span className="truncate text-xs font-normal text-primary">
                    {issue.title}
                  </span>
                  <PriorityBadge priority={issue.priority} className="ml-auto shrink-0" />
                </Command.Item>
              ))}
            </Command.Group>
            </>}
          </Command.List>
        </Command>
      </div>
    </div>
  );
};
