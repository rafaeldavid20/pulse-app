'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import type { Issue } from '@/types';
import { useAppStore } from '@/stores/appStore';
import { applyIssueFilters, sortIssues } from '@/lib/issueFilters';
import { execute } from '@/lib/pql';
import { usePqlContext } from './usePqlContext';

/** The caller supplies an already scoped set; PQL cannot broaden that scope. */
export function useFilteredIssues(issues: Issue[], alreadyFiltered = false): Issue[] {
  const filters = useAppStore(s => s.filterState);
  const sortBy = useAppStore(s => s.sortBy);
  const mode = useAppStore(s => s.filterMode);
  const query = useAppStore(s => s.pqlApplied);
  const scope = useAppStore(s => s.pqlScope);
  const evaluatedAt = useAppStore(s => s.pqlEvaluatedAt);
  const catalogReady = useAppStore(s => s.workspaceCatalogReady);
  const catalogError = useAppStore(s => s.workspaceCatalogError);
  const context = usePqlContext();
  const pathname = usePathname();
  return useMemo(() => {
    if (alreadyFiltered) return issues;
    if (mode === 'filters') return sortIssues(applyIssueFilters(issues, filters), sortBy);
    if (query === null || !evaluatedAt || !catalogReady || catalogError || !context.workspaceId || scope !== `${context.workspaceId}:${context.actorId}:${pathname}`) return [];
    const routeTeam = /^\/team\/([^/]+)(?:\/|$)/.exec(pathname)?.[1];
    if (routeTeam && routeTeam !== context.teamId) return [];
    const scoped = issues.filter(issue => issue.workspaceId === context.workspaceId && (!routeTeam || issue.teamId === routeTeam));
    const result = execute(query, scoped, { ...context, now: evaluatedAt });
    return result.ok ? result.issues : [];
  }, [issues, filters, sortBy, mode, query, context, scope, pathname, evaluatedAt, catalogReady, catalogError, alreadyFiltered]);
}
