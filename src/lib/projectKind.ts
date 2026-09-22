import type { Project, ProjectKind } from '@/types';

export const PROJECT_KIND_LABEL: Record<ProjectKind, string> = {
  generic: 'Genérico',
  salesforce: 'Salesforce',
};

/** Los proyectos anteriores a TES-270 no tienen `kind`: se leen como genéricos. */
export function projectKind(project: Pick<Project, 'kind'>): ProjectKind {
  return project.kind ?? 'generic';
}

/**
 * Si el workspace muestra la superficie de Salesforce (pestaña de Settings,
 * entornos, deploys). Se deriva de los proyectos en vez de ser un toggle
 * propio del workspace: dos flags que dicen lo mismo terminan desincronizados.
 *
 * **No es un control de seguridad.** Esconder la pestaña no impide llamar
 * `environments.*` directo; la autorización real sigue siendo
 * `assertWorkspaceMember` en cada acción. Mismo criterio en el backend:
 * `workspaceHasSalesforceProject` (`pulse-backend/functions/src/salesforce/gate.ts`).
 */
export function hasSalesforceProject(projects: Pick<Project, 'kind'>[]): boolean {
  return projects.some((p) => projectKind(p) === 'salesforce');
}
