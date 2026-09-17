'use client';

import { useMemo } from 'react';
import { useIssueStore } from '@/stores/issueStore';
import { useAppStore } from '@/stores/appStore';
import { Issue } from '@/types';
import { ISSUE_STATUSES } from '@/lib/constants/issue';
import { descendantsOfEpic, isEpic } from '@/lib/hierarchy';
import { applyIssueFilters, sortIssues } from '@/lib/issueFilters';

export function useIssues() {
  const issues = useIssueStore((s) => s.issues);
  const filterState = useAppStore((s) => s.filterState);
  const sortBy = useAppStore((s) => s.sortBy);
  const activeTeam = useAppStore((s) => s.activeTeam);

  // Issues del equipo activo, sin aplicar todavía los filtros de la barra —
  // lo usan las páginas que necesitan el universo "sin filtrar" del equipo
  // (p.ej. para que `IssueList` aplique los filtros por su cuenta).
  const teamIssues = useMemo(
    () => (activeTeam ? issues.filter((issue) => issue.teamId === activeTeam.id) : issues),
    [issues, activeTeam]
  );

  const filteredIssues = useMemo(
    () => applyIssueFilters(teamIssues, filterState),
    [teamIssues, filterState]
  );

  const sortedIssues = useMemo(
    () => sortIssues(filteredIssues, sortBy),
    [filteredIssues, sortBy]
  );

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
   * mismas no aparecen como items dentro de su propio grupo.
   */
  const issuesByEpic = useMemo(() => {
    const map = new Map<string, Issue[]>();
    sortedIssues.forEach((issue) => {
      if (isEpic(issue)) return;
      const key = issue.epicId ?? '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(issue);
    });
    return map;
  }, [sortedIssues]);

  const epics = useMemo(
    () =>
      issues
        .filter((i) => isEpic(i) && (!activeTeam || i.teamId === activeTeam.id))
        .map((epic) => ({ epic, children: descendantsOfEpic(issues, epic.id) }))
        .sort((a, b) => a.epic.number - b.epic.number),
    [issues, activeTeam]
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
