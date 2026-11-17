import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PqlBar } from './PqlBar';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';
import { fixtureContext } from '@/lib/pql/fixtures';

vi.mock('next/navigation', () => ({ usePathname: () => '/team/team-a/issues' }));
vi.mock('@/hooks/usePqlContext', () => ({ usePqlContext: () => fixtureContext }));

describe('PQL bar', () => {
  beforeEach(() => { vi.useFakeTimers(); useAppStore.getState().resetView(); useAppStore.setState({ workspaceCatalogReady: true, workspaceCatalogError: null }); useIssueStore.getState().setIssues([]); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  it('keeps last valid results identified while a draft is invalid', () => {
    render(<PqlBar />);
    fireEvent.click(screen.getByRole('button', { name: 'PQL' }));
    act(() => vi.advanceTimersByTime(200));
    expect(useAppStore.getState().pqlApplied).toBe('');
    const input = screen.getByRole('combobox', { name: 'Consulta PQL' });
    fireEvent.change(input, { target: { value: 'status =' } });
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByText(/Resultados de la última consulta válida/)).toBeTruthy();
    expect(useAppStore.getState().pqlApplied).toBe('');
    fireEvent.change(input, { target: { value: 'status = todo' } });
    act(() => vi.advanceTimersByTime(200));
    expect(useAppStore.getState().pqlApplied).toBe('status = todo');
  });
  it('retains a complex query when it cannot be converted to filters', () => {
    render(<PqlBar />);
    fireEvent.click(screen.getByRole('button', { name: 'PQL' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Consulta PQL' }), { target: { value: 'status = todo OR priority = 2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    expect(screen.getByRole('alert').textContent).toContain('no se puede expresar');
    expect(useAppStore.getState().filterMode).toBe('pql');
  });
  it('inserts a suggestion with the keyboard without losing the suffix', () => {
    render(<PqlBar />);
    fireEvent.click(screen.getByRole('button', { name: 'PQL' }));
    const input = screen.getByRole('combobox', { name: 'Consulta PQL' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'status = to AND priority = 2', selectionStart: 11, selectionEnd: 11 } });
    fireEvent.select(input, { target: { selectionStart: 11, selectionEnd: 11 } });
    expect(screen.getByRole('option', { name: 'todo' })).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe('status = "todo" AND priority = 2');
  });
  it('closes suggestions on Escape and does not intercept IME input', () => {
    render(<PqlBar />);
    fireEvent.click(screen.getByRole('button', { name: 'PQL' }));
    const input = screen.getByRole('combobox', { name: 'Consulta PQL' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'sta', selectionStart: 3, selectionEnd: 3 } });
    expect(input.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(input.value).toBe('sta');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.value).toBe('sta');
  });
  it('distinguishes loading from a catalog error', () => {
    useAppStore.setState({ workspaceCatalogReady: false });
    render(<PqlBar />);
    fireEvent.click(screen.getByRole('button', { name: 'PQL' }));
    expect(screen.getByText(/Cargando issues y catálogos/)).toBeTruthy();
    act(() => useAppStore.setState({ workspaceCatalogError: 'Sin acceso a catálogos' }));
    expect(screen.getByText('Sin acceso a catálogos')).toBeTruthy();
    expect(useAppStore.getState().pqlApplied).toBeNull();
  });
});
