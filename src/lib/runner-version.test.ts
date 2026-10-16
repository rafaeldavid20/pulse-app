import { describe, expect, it } from 'vitest';
import type { RunnerSummary } from './firestore';
import { runnerReportIsCurrent, runnerVersionLabel, runnerUpdateCommands } from './runner-version';
const now = Date.parse('2026-10-15T12:00:00Z');
const runner: RunnerSummary = {id:'one',workspaceId:'ws',ownerMemberId:'owner',displayName:'Runner',status:'online',maxConcurrentJobs:1,lastHeartbeatAt:new Date(now).toISOString(),processVersion:'0.1.17',updateStatus:'update_available'};
describe('Runner report freshness and update guidance', () => {
  it('distinguishes online, busy, stale, future and revoked reports', () => {
    expect(runnerReportIsCurrent(runner,now)).toBe(true);
    expect(runnerReportIsCurrent({...runner,status:'busy'},now)).toBe(true);
    for (const r of [{...runner,status:'offline' as const},{...runner,lastHeartbeatAt:undefined},{...runner,revokedAt:'now'},{...runner,lastHeartbeatAt:new Date(now+1).toISOString()}]) expect(runnerReportIsCurrent(r,now)).toBe(false);
    expect(runnerReportIsCurrent(runner,now+120001)).toBe(false);
  });
  it('keeps independent statuses for multiple Runners and subsequent heartbeat', () => {
    expect(runnerVersionLabel(runner)).toBe('Actualización disponible');
    expect(runnerVersionLabel({...runner,id:'two',processVersion:'0.1.19',updateStatus:'current'})).toBe('En versión actual');
    expect(runnerVersionLabel({...runner,updateStatus:'unavailable'})).toBe('No se pudo comprobar');
    expect(runnerVersionLabel({...runner,processVersion:null,updateStatus:'unknown'})).toBe('Versión desconocida');
  });
  it('selects the same home on every local operation and uses supported service commands', () => {
    const commands=runnerUpdateCommands();
    expect(commands.split('\n')[0]).toContain('service stop');
    expect(commands).toContain('service install'); expect(commands).toContain('service start'); expect(commands).toContain('diagnose');
    expect(commands.split('\n').filter(line=>line.startsWith('pulse-runner')).every(line=>line.endsWith('--home "<DIRECTORIO_ACTUAL_DEL_RUNNER>"'))).toBe(true);
    expect(commands).not.toMatch(/sudo|pair|credential/);
    expect(runnerUpdateCommands(false)).not.toContain('service');
    expect(runnerUpdateCommands(false)).toContain('pulse-runner start --home');
  });
});
