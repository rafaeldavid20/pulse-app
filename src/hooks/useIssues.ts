'use client';

import { useMemo } from 'react';
import { useIssueStore } from '@/stores/issueStore';
import { useAppStore } from '@/stores/appStore';
import { Issue } from '@/types';

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

      return true;
    });
  }, [issues, filterState, activeTeam]);

  // Group issues by status for Kanban Board
  const issuesByStatus = useMemo(() => {
    const map: Record<string, Issue[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      in_review: [],
      done: [],
      canceled: [],
    };

    filteredIssues.forEach((issue) => {
      if (map[issue.status]) {
        map[issue.status].push(issue);
      } else {
        map.backlog.push(issue);
      }
    });

    return map;
  }, [filteredIssues]);

  return {
    issues: filteredIssues,
    allIssues: issues,
    issuesByStatus,
    totalCount: filteredIssues.length,
  };
}
