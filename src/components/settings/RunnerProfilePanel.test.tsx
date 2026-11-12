import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RunnerProfilePanel } from './RunnerProfilePanel';
import { AgentSummary } from '@/lib/firestore';
const { read, subscribe } = vi.hoisted(()=>({read:vi.fn(),subscribe:vi.fn()}));
vi.mock('@/lib/firestore',()=>({runnerProfile:read}));
vi.mock('@/lib/control-signals',()=>({subscribeControlSignal:subscribe}));
let changed:()=>void;
let view:Record<string,unknown>;
beforeEach(()=>{
  vi.useFakeTimers();localStorage.clear();read.mockReset();subscribe.mockReset();
  vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
  subscribe.mockImplementation((_kind,_id,cb)=>{changed=cb;return()=>{};});
  view={workspaceId:'ws',agentId:'a',runnerId:'r',provider:'codex',binding:'binding',online:true,capable:true,repos:[],observedAt:new Date().toISOString(),request:null,
    snapshot:{version:1,revision:'revision',provider:'codex',model:null,modelValid:true,models:['model'],directories:[]}};
  read.mockImplementation(async()=>view);
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();});
const agent={id:'a',runnerId:'r',kind:'codex'} as AgentSummary;
const tick=async()=>{await act(async()=>{await vi.advanceTimersByTimeAsync(100);});};
it('requests an observation on opening/manual reload; changes refresh without causing an observation loop',async()=>{
  render(<RunnerProfilePanel agent={agent}/>);await tick();
  expect(read).toHaveBeenCalledTimes(1);expect(read.mock.calls[0][0].refresh).toBe(true);
  changed();await tick();expect(read).toHaveBeenCalledTimes(2);expect(read.mock.calls[1][0].refresh).toBeUndefined();
  await act(async()=>{await vi.advanceTimersByTimeAsync(130_000);});expect(read).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('status').textContent).toMatch(/Sin perfil confirmado/);
  fireEvent.click(screen.getByRole('button',{name:'Recargar perfil'}));await tick();
  expect(read).toHaveBeenCalledTimes(3);expect(read.mock.calls[2][0].refresh).toBe(true);
});
it('keeps applying until the exact request acknowledgement arrives by signal',async()=>{
  localStorage.setItem('pulse-runner-profile:a:r',JSON.stringify({agentId:'a',runnerId:'r',requestId:'request-one'}));
  view.request={id:'request-one',status:'applying'};
  render(<RunnerProfilePanel agent={agent}/>);await tick();expect(screen.getByRole('status').textContent).toMatch(/Aplicando/);
  view={...view,request:null};changed();await tick();expect(screen.getByRole('status').textContent).toMatch(/Aplicando/);
  view={...view,request:{id:'request-one',status:'applied'}};changed();await tick();
  expect(screen.getByRole('status').textContent).toMatch(/Cambio confirmado/);expect(localStorage.getItem('pulse-runner-profile:a:r')).toBeNull();
});
