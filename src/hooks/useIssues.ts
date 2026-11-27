'use client';

import { useMemo } from 'react';
import { useIssueStore } from '@/stores/issueStore';
import { useAppStore } from '@/stores/appStore';
import { Issue } from '@/types';
import { ISSUE_STATUSES } from '@/lib/constants/issue';
import { descendantsOfEpic, isEpic } from '@/lib/hierarchy';
import { useFilteredIssues } from './useFilteredIssues';

/**
 * `scopeIssues`, si se pasa, reemplaza el universo "equipo activo" de base
 * (p.ej. los issues de un ciclo puntual): permite que `IssueBoard` se use
 * acotado a un subconjunto igual que `IssueList` ya acepta con su prop
 * `issues`, sin duplicar el resto del pipeline (filtros de la barra, orden,
 * agrupación por estado/épica).
 */
export function useIssues(scopeIssues?: Issue[], alreadyFiltered = false) {
  const issues = useIssueStore((s) => s.issues);
  const activeTeam = useAppStore((s) => s.activeTeam);
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspace?.id);

  // Issues del equipo activo, sin aplicar todavía los filtros de la barra —
  // lo usan las páginas que necesitan el universo "sin filtrar" del equipo
  // (p.ej. para que `IssueList` aplique los filtros por su cuenta).
  const teamIssues = useMemo(
    () =>
      scopeIssues ?? (activeTeam ? issues.filter((issue) => issue.teamId === activeTeam.id) : issues),
    [issues, activeTeam, scopeIssues]
  );

  const sortedIssues = useFilteredIssues(teamIssues, alreadyFiltered);

  // Group issues by status for Kanban Board
  const issuesByStatus = useMemo(() => {
    const map: Record<string, Issue[]> = {};
    ISSUE_STATUSES.forEach((s) => {
      map[s.value] = [];
    });

    sortedIssues.forEach((issue) => {
      if (map[issue.status]) {
        map[issue.status].push(issue);
      } else {
        map.backlog.push(issue);
      }
    });

    return map;
  }, [sortedIssues]);

  /**
   * Los issues filtrados agrupados por épica, para las swimlanes del board.
   * La clave `''` junta a los que no cuelgan de ninguna épica; las épicas
   * mismas aparecen en su lane cuando coinciden con el filtro.
   */
  const issuesByEpic = useMemo(() => {
    const map = new Map<string, Issue[]>();
    sortedIssues.forEach((issue) => {
      const key = isEpic(issue) ? issue.id : issue.epicId ?? '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(issue);
    });
    return map;
  }, [sortedIssues]);

  const epics = useMemo(
    () => {
      const workspaceIssues = issues.filter(i => !!activeWorkspaceId && i.workspaceId === activeWorkspaceId);
      return workspaceIssues
        .filter(i => isEpic(i) && (alreadyFiltered || !activeTeam || i.teamId === activeTeam.id))
        .map(epic => ({ epic, children: descendantsOfEpic(workspaceIssues, epic.id) }))
        .sort((a, b) => a.epic.number - b.epic.number);
    },
    [issues, activeTeam, activeWorkspaceId, alreadyFiltered]
  );

  return {
    issues: sortedIssues,
    allIssues: issues,
    teamIssues,
    issuesByStatus,
    issuesByEpic,
    epics,
    totalCount: sortedIssues.length,
  };
}
