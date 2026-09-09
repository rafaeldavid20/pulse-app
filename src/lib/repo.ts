import { Issue } from '@/types';

/**
 * Espejo en el cliente de `resolveIssueRepo` del backend
 * (`common/utils/repo-resolution.ts`): a qué repo pertenece un issue, y de
 * dónde sale ese valor.
 *
 * Existe para poder *mostrar* el repo efectivo y su procedencia en el panel
 * ("Heredado de TES-120"), no para decidir nada: quien decide de verdad es el
 * backend, que es el único que puede validar contra la instalación de GitHub.
 * Si las dos cascadas se separan, lo que se rompe es la explicación, no el
 * comportamiento.
 */
export type RepoSource = 'issue' | 'epic' | 'agent' | 'none';

export interface ResolvedRepo {
  repo?: string;
  source: RepoSource;
  /** La épica de la que se hereda, cuando `source === 'epic'`. */
  from?: Issue;
}

export function resolveRepo(
  issues: Issue[],
  issue: Issue,
  agentDefaults: Record<string, string | undefined> = {}
): ResolvedRepo {
  if (issue.git?.repoFullName) {
    return { repo: issue.git.repoFullName, source: 'issue' };
  }

  if (issue.epicId) {
    const epic = issues.find((i) => i.id === issue.epicId);
    if (epic?.git?.repoFullName) {
      return { repo: epic.git.repoFullName, source: 'epic', from: epic };
    }
  }

  if (issue.assigneeId) {
    const agentRepo = agentDefaults[issue.assigneeId];
    if (agentRepo) return { repo: agentRepo, source: 'agent' };
  }

  return { source: 'none' };
}

export function describeRepoSource(r: ResolvedRepo): string {
  switch (r.source) {
    case 'issue':
      return 'Definido en este issue';
    case 'epic':
      return `Heredado de ${r.from?.identifier ?? 'la épica'}`;
    case 'agent':
      return 'Default del agente asignado';
    default:
      return 'Sin repo: el agente no va a poder crear la rama';
  }
}
