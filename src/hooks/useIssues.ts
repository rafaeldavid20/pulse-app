'use client';

import { useMemo } from 'react';
import { useIssueStore } from '@/stores/issueStore';
import { useAppStore } from '@/stores/appStore';
import { Issue } from '@/types';
import { ISSUE_STATUSES } from '@/lib/constants/issue';
import { descendantsOfEpic, isEpic } from '@/lib/hierarchy';

export function useIssues() {
  const issues = useIssueStore((s) => s.issues);
  const filterState = useAppStore((s) => s.filterState);
  const activeTeam = useAppStore((s) => s.activeTeam);

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      // Filter by team
      if (activeTeam && issue.teamId !== activeTeam.id) {
        return false;
      }

      // Filter by search text
      if (filterState.search) {
        const query = filterState.search.toLowerCase();
        const matchesTitle = issue.title.toLowerCase().includes(query);
        const matchesId = issue.identifier.toLowerCase().includes(query);
        if (!matchesTitle && !matchesId) return false;
      }

      // Filter by status
      if (filterState.status.length > 0 && !filterState.status.includes(issue.status)) {
        return false;
      }

      // Filter by priority
      if (filterState.priority.length > 0 && !filterState.priority.includes(issue.priority)) {
        return false;
      }

      // Filter by assignee
      if (filterState.assigneeId && issue.assigneeId !== filterState.assigneeId) {
        return false;
      }

      // Filter by hierarchy level
      if (filterState.type.length > 0 && !filterState.type.includes(issue.type ?? 'task')) {
        return false;
      }

      // Filtro por proyecto y por etiquetas: ambos campos ya existían en
      // `FilterState` y la UI los seteaba, pero este hook nunca los aplicaba —
      // filtrar por proyecto desde el sidebar no hacía nada.
      if (filterState.projectId && issue.projectId !== filterState.projectId) {
        return false;
      }

      if (filterState.labelIds.length > 0) {
        const labels = issue.labelIds || [];
        if (!filterState.labelIds.some((id) => labels.includes(id))) return false;
      }

      // Filtro por épica: incluye la épica misma además de su subárbol, para que
      // seleccionarla no la haga desaparecer de su propia vista.
      if (filterState.epicId) {
        const belongs = issue.epicId === filterState.epicId || issue.id === filterState.epicId;
        if (!belongs) return false;
      }

      return true;
    });
  }, [issues, filterState, activeTeam]);

  // Group issues by status for Kanban Board
  const issuesByStatus = useMemo(() => {
    const map: Record<string, Issue[]> = {};
    ISSUE_STATUSES.forEach((s) => {
      map[s.value] = [];
    });

    filteredIssues.forEach((issue) => {
      if (map[issue.status]) {
        map[issue.status].push(issue);
      } else {
        map.backlog.push(issue);
      }
    });

    return map;
  }, [filteredIssues]);

  /**
   * Los issues filtrados agrupados por épica, para las swimlanes del board.
   * La clave `''` junta a los que no cuelgan de ninguna épica; las épicas
   * mismas no aparecen como items dentro de su propio grupo.
   */
  const issuesByEpic = useMemo(() => {
    const map = new Map<string, Issue[]>();
    filteredIssues.forEach((issue) => {
      if (isEpic(issue)) return;
      const key = issue.epicId ?? '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(issue);
    });
    return map;
  }, [filteredIssues]);

  const epics = useMemo(
    () =>
      issues
        .filter((i) => isEpic(i) && (!activeTeam || i.teamId === activeTeam.id))
        .map((epic) => ({ epic, children: descendantsOfEpic(issues, epic.id) }))
        .sort((a, b) => a.epic.number - b.epic.number),
    [issues, activeTeam]
  );

  return {
    issues: filteredIssues,
    allIssues: issues,
    issuesByStatus,
    issuesByEpic,
    epics,
    totalCount: filteredIssues.length,
  };
}
