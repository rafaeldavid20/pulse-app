import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandPalette } from './CommandPalette';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';
import { usePqlSearchStore } from '@/stores/pqlSearchStore';
import { fixtureContext } from '@/lib/pql/fixtures';
import type { Issue, Team, Workspace } from '@/types';

const push = vi.fn();
const agentMocks = vi.hoisted(() => ({ update: vi.fn(), paused: false }));
vi.mock('@/lib/firestore', async (importOriginal) => ({ ...await importOriginal<typeof import('@/lib/firestore')>(), updateWorkspaceGuardrails: agentMocks.update }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/team/team-a/issues' }));
vi.mock('@/hooks/usePqlContext', () => ({ usePqlContext: () => fixtureContext }));
vi.mock('@/hooks/useLiveQuery', () => ({ useLiveQuery: () => ({ data: { agentsPaused: agentMocks.paused } }) }));
beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = vi.fn();
});
const issues = Array.from({ length: 21 }, (_, n) => ({ id: `i${String(n).padStart(2, '0')}`, workspaceId: 'fixture', teamId: 'team-a', identifier: `TES-${n}`, title: `Issue ${n}`, status: 'in_review', priority: 2, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-02T00:00:00Z' })) as Issue[];
describe('command palette PQL', () => {
  beforeEach(() => {
    vi.useFakeTimers(); push.mockReset(); agentMocks.update.mockReset().mockResolvedValue(undefined); agentMocks.paused = false;
    useIssueStore.getState().setPeekIssueId(null); useAppStore.setState({ isCreateIssueOpen: false }); usePqlSearchStore.getState().setSearch(null);
    useAppStore.setState({ isCmdKOpen: true, workspaceUserId: 'user-a', activeWorkspace: { id: 'fixture' } as Workspace, activeTeam: { id: 'team-a', workspaceId: 'fixture' } as Team, workspaceCatalogReady: true, workspaceCatalogError: null });
    useIssueStore.getState().setIssues(issues);
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  it('shows help, 20 of 21 results, and hands the full query to the results page', () => {
    render(<CommandPalette />);
    const input = screen.getByPlaceholderText('Escribe un comando o busca un issue...');
    fireEvent.change(input, { target: { value: '?' } });
    expect(screen.getByText(/Escribí una consulta/)).toBeTruthy();
    fireEvent.change(input, { target: { value: '? status = in_review ORDER BY updated DESC' } });
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByText('Mostrando 20 de 21')).toBeTruthy();
    expect(screen.queryByText('TES-20')).toBeNull();
    fireEvent.click(screen.getByText('Ver todos los resultados'));
    expect(push).toHaveBeenCalledWith('/pql-results');
    expect(usePqlSearchStore.getState().search).toMatchObject({ workspaceId: 'fixture', query: ' status = in_review ORDER BY updated DESC' });
  });
  it('removes stale rows on invalid input and preserves ordinary commands', () => {
    render(<CommandPalette />);
    const input = screen.getByPlaceholderText('Escribe un comando o busca un issue...');
    fireEvent.change(input, { target: { value: '? status = todo' } });
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByText('No se encontraron resultados.')).toBeTruthy();
    fireEvent.change(input, { target: { value: '? status =' } });
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByText(/Se esperaba un valor/)).toBeTruthy();
    expect(screen.queryByText('TES-0')).toBeNull();
    fireEvent.change(input, { target: { value: 'Crear' } });
    expect(within(screen.getByRole('listbox')).getByText('Crear nuevo issue...')).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(useAppStore.getState().isCmdKOpen).toBe(false);
  });
  it('selects results with the keyboard and clears them when the workspace changes', () => {
    render(<CommandPalette />);
    const input = screen.getByPlaceholderText('Escribe un comando o busca un issue...');
    fireEvent.change(input, { target: { value: '? status = in_review' } });
    act(() => vi.advanceTimersByTime(250));
    expect(screen.getByText('TES-0')).toBeTruthy();
    act(() => useAppStore.setState({ activeWorkspace: { id: 'other' } as Workspace }));
    expect(screen.queryByText('TES-0')).toBeNull();
    act(() => useAppStore.setState({ activeWorkspace: { id: 'fixture' } as Workspace }));
    const reopenedInput = screen.getByPlaceholderText('Escribe un comando o busca un issue...');
    fireEvent.change(reopenedInput, { target: { value: '? status = in_review' } });
    act(() => vi.advanceTimersByTime(250));
    fireEvent.keyDown(reopenedInput, { key: 'ArrowDown' });
    fireEvent.keyDown(reopenedInput, { key: 'Enter' });
    expect(useAppStore.getState().isCmdKOpen).toBe(false);
    expect(useIssueStore.getState().peekIssueId).toMatch(/^i\d\d$/);
  });
  it('shows a single result and leaves creation actions working outside PQL', () => {
    render(<CommandPalette />);
    const input = screen.getByPlaceholderText('Escribe un comando o busca un issue...');
    fireEvent.change(input, { target: { value: '? text = "TES-0"' } });
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByText('Mostrando 1 de 1')).toBeTruthy();
    expect(screen.getByText('TES-0')).toBeTruthy();
    fireEvent.change(input, { target: { value: 'Crear' } });
    fireEvent.click(screen.getByText('Crear nuevo issue...'));
    expect(useAppStore.getState().isCreateIssueOpen).toBe(true);
    expect(useAppStore.getState().isCmdKOpen).toBe(false);
  });
  it('filters ordinary issue search and opens the matching issue with Enter', () => {
    render(<CommandPalette />);
    const input = screen.getByPlaceholderText('Escribe un comando o busca un issue...');
    fireEvent.change(input, { target: { value: 'TES-17' } });
    expect(screen.getByText('TES-17')).toBeTruthy();
    expect(screen.queryByText('TES-16')).toBeNull();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useIssueStore.getState().peekIssueId).toBe('i17');
    expect(useAppStore.getState().isCmdKOpen).toBe(false);
  });
  it('navigates using ordinary search and the keyboard', () => {
    render(<CommandPalette />);
    const input = screen.getByPlaceholderText('Escribe un comando o busca un issue...');
    fireEvent.change(input, { target: { value: 'Ir a Inbox' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(push).toHaveBeenCalledWith('/inbox');
    expect(useAppStore.getState().isCmdKOpen).toBe(false);
  });
  it.each([[false, 'Pausar agentes', true], [true, 'Reanudar agentes', false]])(
    'keeps agent action %s safe across PQL transitions and executes it on Enter',
    (paused, label, expected) => {
      agentMocks.paused = paused;
      render(<CommandPalette />);
      const input = screen.getByPlaceholderText('Escribe un comando o busca un issue...');
      fireEvent.change(input, { target: { value: label } });
      fireEvent.change(input, { target: { value: '?' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.change(input, { target: { value: '? status = in_review' } });
      act(() => vi.advanceTimersByTime(200));
      fireEvent.change(input, { target: { value: label } });
      expect(agentMocks.update).not.toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
      expect(useIssueStore.getState().peekIssueId).toBeNull();
      expect(useAppStore.getState().isCreateIssueOpen).toBe(false);
      expect(screen.getByText(label)).toBeTruthy();
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(agentMocks.update).toHaveBeenCalledExactlyOnceWith('fixture', { agentsPaused: expected });
      expect(useAppStore.getState().isCmdKOpen).toBe(false);
    },
  );

});
