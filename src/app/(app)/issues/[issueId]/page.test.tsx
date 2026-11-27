import { act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import { Suspense } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import IssuePage from './page';

const { app, issueStore, push } = vi.hoisted(() => ({
  app: { activeWorkspace: { id: 'ws-a' }, members: [] },
  issueStore: { issues: [] as { id: string; workspaceId: string; title: string }[], issuesLoaded: true, issuesError: null as string | null, updateIssue: vi.fn(), deleteIssue: vi.fn() },
  push: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/stores/appStore', () => ({ useAppStore: (select: (value: typeof app) => unknown) => select(app) }));
vi.mock('@/stores/issueStore', () => ({ useIssueStore: (select: (value: typeof issueStore) => unknown) => select(issueStore) }));
vi.mock('@/components/issues/IssuePeekPanel', () => ({ IssuePeekBody: ({ issue, fullPage, onOpenIssue }: { issue: { title: string }; fullPage: boolean; onOpenIssue: (id: string) => void }) => <div><h1>{issue.title}</h1><span>{fullPage ? 'Detalle completo' : 'Panel'}</span><button onClick={() => onOpenIssue('issue-next')}>Abrir relacionado</button></div> }));

beforeEach(() => { app.activeWorkspace.id = 'ws-a'; issueStore.issues = [{ id: 'issue-a', workspaceId: 'ws-a', title: 'Issue de prueba' }]; issueStore.issuesLoaded = true; issueStore.issuesError = null; push.mockReset(); });
afterEach(cleanup);
const open = async () => { await act(async () => { render(<Suspense fallback="Cargando"><IssuePage params={Promise.resolve({ issueId: 'issue-a' })} /></Suspense>); }); };

it('opens the issue directly and navigates to related issues', async () => {
  await open();
  expect(screen.getByText('Issue de prueba')).toBeTruthy();
  expect(screen.getByText('Detalle completo')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Abrir relacionado' }));
  expect(push).toHaveBeenCalledWith('/issues/issue-next');
});

it('does not reveal an issue from a different workspace', async () => {
  app.activeWorkspace.id = 'ws-b';
  await open();
  expect(screen.queryByText('Issue de prueba')).toBeNull();
  expect(screen.getByText(/no está disponible/)).toBeTruthy();
});

it('shows loading and subscription errors instead of an empty detail', async () => {
  issueStore.issuesLoaded = false;
  await open();
  expect(screen.getByRole('status').textContent).toContain('Cargando');
  cleanup();
  issueStore.issuesError = 'Sin conexión';
  await open();
  expect(screen.getByRole('alert').textContent).toBe('Sin conexión');
});
