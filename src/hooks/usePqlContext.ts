'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';
import { useProjectStore } from '@/stores/projectStore';
import { useLabelStore } from '@/stores/labelStore';
import { useCycleStore } from '@/stores/cycleStore';
import type { Context } from '@/lib/pql';

/** Constructs only from the current workspace's subscribed data. */
export function usePqlContext(): Context {
  const pathname = usePathname();
  const workspaceId = useAppStore(s => s.activeWorkspace?.id ?? '');
  const actorId = useAppStore(s => s.workspaceUserId ?? undefined);
  const teams = useAppStore(s => s.teams);
  const members = useAppStore(s => s.members);
  const issues = useIssueStore(s => s.issues);
  const projects = useProjectStore(s => s.projects);
  const labels = useLabelStore(s => s.labels);
  const cycles = useCycleStore(s => s.cycles);
  return useMemo(() => {
    const authorizedTeams = teams.filter(t => t.workspaceId === workspaceId);
    const teamIds = new Set(authorizedTeams.map(t => t.id));
    const routeTeam = /^\/team\/([^/]+)(?:\/|$)/.exec(pathname)?.[1];
    return {
      workspaceId, actorId, now: new Date().toISOString(),
      teamId: routeTeam && teamIds.has(routeTeam) ? routeTeam : undefined,
      teams: authorizedTeams,
      members: members.filter(m => m.workspaceId === workspaceId),
      issues: issues.filter(i => i.workspaceId === workspaceId).map(i => ({ id: i.id, identifier: i.identifier, name: i.title, type: i.type, teamId: i.teamId })),
      projects: projects.filter(p => teamIds.has(p.teamId)),
      labels: labels.filter(l => teamIds.has(l.teamId)),
      cycles: cycles.filter(c => c.workspaceId === workspaceId && teamIds.has(c.teamId)),
    };
  }, [pathname, workspaceId, actorId, teams, members, issues, projects, labels, cycles]);
}
