import { writeFileSync } from 'node:fs';
import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useFilteredIssues } from './useFilteredIssues';
import { usePqlContext } from './usePqlContext';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';
import { useProjectStore } from '@/stores/projectStore';
import { useLabelStore } from '@/stores/labelStore';
import { useCycleStore } from '@/stores/cycleStore';
import { fixtureCases, fixtureContexts, fixtureIssues } from '@/lib/pql/fixtures';
import { validatePql } from '@/lib/pql-validation';
import type { Issue } from '@/types';

vi.mock('next/navigation', () => ({ usePathname: () => '/team/team-a/issues' }));
afterEach(cleanup);

it('runs the portable corpus through the real frontend context and list adapter', () => {
  const workspaceId = 'fixture';
  const issues = fixtureIssues.map(issue => ({ ...issue, workspaceId })) as Issue[];
  const outputs: unknown[] = [];
  for (const fixture of fixtureCases) {
    const context = fixtureContexts['context' in fixture ? fixture.context : 'default'];
    useAppStore.setState({
      activeWorkspace: { id: workspaceId } as never, workspaceUserId: context.actorId,
      teams: context.teams.map(team => ({ ...team, workspaceId })) as never,
      members: context.members.map(member => ({ ...member, workspaceId })) as never,
      pqlAgentCatalog: { workspaceId, userId: context.actorId!, agents: context.agents.map(agent => ({ ...agent, workspaceId })) as never, loading: false, error: null },
      workspaceCatalogReady: true, workspaceCatalogError: null,
      filterMode: 'pql', pqlApplied: fixture.query, pqlScope: 'fixture:user-a:/team/team-a/issues', pqlEvaluatedAt: context.now,
    });
    useIssueStore.getState().setIssues(issues);
    useProjectStore.getState().setProjects(context.projects.map(project => ({ ...project, workspaceId, teamId: 'team-a' })) as never);
    useLabelStore.getState().setLabels(context.labels.map(label => ({ ...label, workspaceId, teamId: 'team-a' })) as never);
    useCycleStore.getState().setCycles(context.cycles.map(cycle => ({ ...cycle, workspaceId })) as never);
    const hook = renderHook(() => ({ context: usePqlContext(), issues: useFilteredIssues(issues) }));
    const validation = validatePql(fixture.query, { ...hook.result.current.context, now: context.now });
    if ('ids' in fixture) {
      expect(validation.ok, fixture.query).toBe(true);
      const ids = hook.result.current.issues.map(issue => issue.id);
      expect(ids, fixture.query).toEqual([...fixture.ids]);
      outputs.push({ ok: true, ids });
    } else {
      expect(validation.ok, fixture.query).toBe(false);
      if (validation.ok) throw new Error('Expected a diagnostic');
      const { code, start, end, line, column, expected } = validation.diagnostic;
      outputs.push({ ok: false, diagnostic: { code, start, end, line, column, expected } });
    }
    hook.unmount();
  }
  if (process.env.PQL_FRONTEND_RESULTS) writeFileSync(process.env.PQL_FRONTEND_RESULTS, JSON.stringify(outputs));
});
