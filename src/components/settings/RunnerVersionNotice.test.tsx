import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RunnerVersionNotice } from './RunnerVersionNotice';
import type { RunnerSummary } from '@/lib/firestore';
const runner: RunnerSummary = {id:'one',workspaceId:'ws',ownerMemberId:'owner',displayName:'Mac',status:'online',maxConcurrentJobs:1,lastHeartbeatAt:new Date().toISOString(),versionReportedAt:'2026-10-15T12:00:00Z',processVersion:'0.1.17',updateStatus:'update_available',release:{status:'available',version:'0.1.19',checkedAt:'2026-10-15T12:00:00Z',nextCheckAt:0}};
afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe('Runner version notice',()=>{
  it('shows effective vs published version, then clears the notice on refreshed heartbeat',()=>{
    const {rerender}=render(<RunnerVersionNotice runner={runner}/>);
    expect(screen.getByText(/Versión efectiva/).textContent).toContain('0.1.17');
    expect(screen.getByText(/Actualización disponible/).textContent).toContain('0.1.19');
    rerender(<RunnerVersionNotice runner={{...runner,processVersion:'0.1.19',updateStatus:'current'}}/>);
    expect(screen.queryByText(/Actualización disponible/)).toBeNull();
    expect(screen.getByText(/En versión actual/)).toBeTruthy();
  });
  it('labels offline metadata as last report; unknown and registry outage are separate',()=>{
    const {rerender}=render(<RunnerVersionNotice runner={{...runner,status:'offline'}}/>);
    expect(screen.getByText(/Última versión reportada/).textContent).toContain('0.1.17');
    expect(screen.getByText(/comparación del último reporte/)).toBeTruthy();
    rerender(<RunnerVersionNotice runner={{...runner,processVersion:null,updateStatus:'unknown'}}/>);
    expect(screen.getByText(/Versión desconocida/)).toBeTruthy();
    rerender(<RunnerVersionNotice runner={{...runner,updateStatus:'unavailable',release:{status:'unavailable',checkedAt:runner.versionReportedAt!,nextCheckAt:0}}}/>);
    expect(screen.getByText('No se pudo comprobar')).toBeTruthy();
    expect(screen.getByText(/Reintentaremos automáticamente/)).toBeTruthy();
  });
  it('opens local guidance, warns about an active job and copies commands without pairing',async()=>{
    const writeText=vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}});
    render(<RunnerVersionNotice runner={runner} activeJob/>);
    fireEvent.click(screen.getByText('Ver cómo actualizar'));
    expect(screen.getByRole('alert').textContent).toContain('Esperá a que termine');
    expect(screen.getByText(/Los contadores históricos/)).toBeTruthy();
    fireEvent.click(screen.getByText('Copiar comandos'));
    await waitFor(()=>expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0][0]).toContain('service stop --home');
    expect(writeText.mock.calls[0][0]).not.toContain('pair');
  });
});
