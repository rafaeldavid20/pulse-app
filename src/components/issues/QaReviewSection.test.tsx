import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QaReviewSection } from './QaReviewSection';
import { Issue } from '@/types';

const { rerunReview } = vi.hoisted(() => ({ rerunReview: vi.fn() }));
vi.mock('@/lib/firestore', () => ({
  overrideReview: vi.fn(),
  dismissFinding: vi.fn(),
  rerunReview,
  returnReviewToAgent: vi.fn(),
}));
vi.mock('@/hooks/useWorkspaceInfra', () => ({ useWorkspaceInfra: () => ({ agents: [] }) }));

const issue = {
  id: 'issue-test',
  review: { state: 'approved', attempt: 1, findings: [] },
  acceptanceCriteria: [],
} as unknown as Issue;

afterEach(() => { cleanup(); vi.restoreAllMocks(); rerunReview.mockReset(); });

describe('manual QA request confirmation', () => {
  it('does not request QA when the user cancels', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<QaReviewSection issue={issue} />);

    fireEvent.click(screen.getByRole('button', { name: 'Solicitar revisión QA manual' }));

    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/incompleta o incluir PRs en borrador/));
    expect(rerunReview).not.toHaveBeenCalled();
  });

  it('sends the partial delivery acknowledgement after confirmation and shows success', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    rerunReview.mockResolvedValue(undefined);
    render(<QaReviewSection issue={issue} />);

    fireEvent.click(screen.getByRole('button', { name: 'Solicitar revisión QA manual' }));

    await waitFor(() => expect(rerunReview).toHaveBeenCalledWith('issue-test', true));
    expect(await screen.findByText(/Revisión manual solicitada/)).toBeTruthy();
  });

  it('keeps manual QA requests available for a completed delivery', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    rerunReview.mockResolvedValue(undefined);
    render(<QaReviewSection issue={issue} />);

    fireEvent.click(screen.getByRole('button', { name: 'Solicitar revisión QA manual' }));

    await waitFor(() => expect(rerunReview).toHaveBeenCalledTimes(1));
    expect(rerunReview).toHaveBeenCalledWith('issue-test', true);
  });

  it('prevents duplicate requests while one is pending and reports errors in the UI', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    let reject!: (error: Error) => void;
    rerunReview.mockImplementation(() => new Promise((_, rejectPromise) => { reject = rejectPromise; }));
    render(<QaReviewSection issue={issue} />);
    const button = screen.getByRole('button', { name: 'Solicitar revisión QA manual' });

    fireEvent.click(button);
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(button);
    expect(rerunReview).toHaveBeenCalledTimes(1);
    reject(new Error('No se pudo solicitar QA.'));

    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo solicitar QA.');
  });
});
