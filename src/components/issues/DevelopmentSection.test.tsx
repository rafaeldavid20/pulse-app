import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DevelopmentSection } from './DevelopmentSection';
import { Issue } from '@/types';
import { DevelopmentStatus } from '@/lib/development-status';

const { call, subscribe } = vi.hoisted(() => ({ call: vi.fn(), subscribe: vi.fn() }));
let changed: () => void;
vi.mock('@/lib/firestore', () => ({ callPlatformAction: call }));
vi.mock('@/lib/control-signals', () => ({ subscribeControlSignal: subscribe }));
const issue = { id: 'issue-test', status: 'in_progress', execution: { agentId: 'manual-agent' }, agent: { state: 'claimed' } } as Issue;
let server: DevelopmentStatus;
beforeEach(() => {
  localStorage.clear();
  server = { state: 'idle', available: true, active: false, mode: 'task' };
  call.mockReset();
  subscribe.mockImplementation((_kind, _id, callback) => { changed = callback; return () => {}; });
  call.mockImplementation(async (code: string) => code === 'issues.developmentStatus' ? server : { jobId: 'job-1' });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('issue development recovery', () => {
  it('keeps the action visible after a historical claim and labels QA rework independently of old marks', async () => {
    const rework = { ...issue, review: { state: 'changes_requested', attempt: 1, reworkDispatchedForAttempt: 1 } } as Issue;
    render(<DevelopmentSection issue={rework} />);
    await waitFor(() => expect((screen.getByRole('button', { name: 'Corregir findings' }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByText(/mismos PRs/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Indicaciones adicionales (opcional)'), { target: { value: ' Revisá ambos repos. ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Corregir findings' }));
    await waitFor(() => expect(call.mock.calls.find(([code]) => code === 'issues.requestDevelopment')?.[1].comment).toBe('Revisá ambos repos.'));
  });

  it('shows requested while waiting and prevents double clicks; queued requires server evidence', async () => {
    let acknowledge!: (value: { jobId: string }) => void;
    call.mockImplementation((code: string) => code === 'issues.developmentStatus' ? Promise.resolve(server) : new Promise(resolve => { acknowledge = resolve; }));
    render(<DevelopmentSection issue={issue} />);
    const button = await screen.findByRole('button', { name: 'Ejecutar desarrollo' });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button); fireEvent.click(button);
    expect(screen.getByRole('status').textContent).toMatch(/esperando confirmación/);
    expect(screen.queryByText('En cola en el Runner.')).toBeNull();
    expect(call.mock.calls.filter(([code]) => code === 'issues.requestDevelopment')).toHaveLength(1);
    server = { state: 'queued', available: false, active: true, mode: 'task', jobId: 'job-1' };
    await act(async () => acknowledge({ jobId: 'job-1' }));
    await screen.findByText('En cola en el Runner.');
    expect(localStorage.getItem('pulse:development:issue-test')).toBeNull();
  });

  it('reconciles queue and execution on refresh and allows retry after failure', async () => {
    server = { state: 'running', available: false, active: true, mode: 'task', jobId: 'live-job' };
    const first = render(<DevelopmentSection issue={issue} />);
    await screen.findByText('En ejecución.');
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    first.unmount();
    server = { state: 'failed', available: true, active: false, mode: 'task', jobId: 'live-job' };
    render(<DevelopmentSection issue={issue} />);
    await waitFor(() => expect((screen.getByRole('button', { name: 'Reintentar desarrollo' }) as HTMLButtonElement).disabled).toBe(false));
  });

  it('preserves an uncertain request ID across reload and retries the same request', async () => {
    call.mockImplementation(async (code: string) => {
      if (code === 'issues.developmentStatus') return server;
      throw new Error('Se perdió la conexión; reintentá.');
    });
    const first = render(<DevelopmentSection issue={issue} />);
    await waitFor(() => expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button'));
    await screen.findByRole('alert');
    const requestId = call.mock.calls.find(([code]) => code === 'issues.requestDevelopment')![1].requestId;
    first.unmount();
    render(<DevelopmentSection issue={issue} />);
    await waitFor(() => expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button'));
    await screen.findByRole('alert');
    expect(call.mock.calls.filter(([code]) => code === 'issues.requestDevelopment').map(([, data]) => data.requestId)).toEqual([requestId, requestId]);
    expect(screen.queryByText('En cola en el Runner.')).toBeNull();
  });

  it.each(['Reabrí el issue antes de ejecutar.', 'El Runner no está disponible. Iniciá el servicio.', 'El issue alcanzó su límite de ejecuciones.', 'Solo el dueño puede solicitar correcciones.'])('shows server blocking reason and diagnosis: %s', async reason => {
    server = { state: 'failed', available: false, active: false, mode: 'task', reason };
    render(<DevelopmentSection issue={issue} />);
    await screen.findByText(reason);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/settings/agentes');
  });

  it('offers a single human-authorized run when the issue budget is exhausted', async () => {
    server = {state:'failed', available:false, active:false, mode:'task', reason:'PULSE_BUDGET:issue-run-limit:6'};
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<DevelopmentSection issue={issue} />);
    fireEvent.click(await screen.findByRole('button', {name:'Autorizar una ejecución'}));
    await waitFor(() => expect(call.mock.calls.find(([code]) => code === 'issues.requestDevelopment')?.[1].budgetExceptions).toEqual(['issue-run-limit']));
  });

  it('identifies a pending repository handoff', async () => {
    server = {state:'idle', available:true, active:false, mode:'handoff'};
    render(<DevelopmentSection issue={issue} />);
    expect(await screen.findByRole('button', {name:'Continuar traspaso'})).toBeTruthy();
  });
});

it('updates development from signals and never polls an unchanged view',async()=>{
  vi.useFakeTimers();render(<DevelopmentSection issue={issue}/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(100);});
  expect(call).toHaveBeenCalledTimes(1);
  server={state:'queued',available:false,active:true,mode:'task',jobId:'queued-job'};
  changed();await act(async()=>{await vi.advanceTimersByTimeAsync(100);});
  expect(screen.getByText('En cola en el Runner.')).toBeTruthy();
  await act(async()=>{await vi.advanceTimersByTimeAsync(30_000);});
  expect(call).toHaveBeenCalledTimes(2);
});
