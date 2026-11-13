import { afterEach, describe, expect, it, vi } from 'vitest';
import { budgetReason, withBudgetConfirmation } from './manual-budget';

afterEach(() => vi.restoreAllMocks());
describe('manual budget authorization', () => {
  it('describes the actual limit and stops without dispatch when canceled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const request = vi.fn();
    expect(await withBudgetConfirmation(request, 'PULSE_BUDGET:issue-run-limit:6')).toBeUndefined();
    expect(request).not.toHaveBeenCalled();
    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/incidencia \(6\).*una sola ejecución/));
  });
  it('asks for each reached limit and only sends explicitly confirmed exceptions', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const request = vi.fn().mockRejectedValueOnce(new Error('PULSE_BUDGET:issue-run-limit:6')).mockRejectedValueOnce(new Error('PULSE_BUDGET:daily-cost-cap:2')).mockResolvedValueOnce('job');
    expect(await withBudgetConfirmation(request)).toBe('job');
    expect(request.mock.calls.map(([reasons]) => [...reasons])).toEqual([[], ['issue-run-limit'], ['issue-run-limit', 'daily-cost-cap']]);
    expect(window.confirm).toHaveBeenCalledTimes(2);
    expect(budgetReason('PULSE_BUDGET:paused:')).toBeNull();
  });
});
