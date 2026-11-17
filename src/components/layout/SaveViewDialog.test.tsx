import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SaveViewDialog } from './SaveViewDialog';
import { useAppStore } from '@/stores/appStore';
import type { Workspace } from '@/types';

const action = vi.fn(), push = vi.fn();
vi.mock('next/navigation', () => ({ usePathname: () => '/team/team-a/projects/project-a', useRouter: () => ({ push }) }));
vi.mock('@/lib/saved-views', () => ({ viewAction: (...args: unknown[]) => action(...args) }));
beforeEach(() => { action.mockReset(); push.mockReset(); useAppStore.getState().resetView(); useAppStore.setState({ activeWorkspace: { id: 'ws' } as Workspace }); });
afterEach(cleanup);
it('saves private by default with the route scope and preserves the draft after failure', async () => {
  action.mockRejectedValueOnce(new Error('Sin permiso')).mockResolvedValueOnce({ id: 'view-1' });
  render(<SaveViewDialog close={() => {}} />);
  const name = screen.getByLabelText('Nombre') as HTMLInputElement;
  fireEvent.change(name, { target: { value: 'Vista' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Sin permiso');
  expect(name.value).toBe('Vista');
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(push).toHaveBeenCalledWith('/views/view-1'));
  expect(action).toHaveBeenLastCalledWith('create', expect.objectContaining({ workspaceId: 'ws', teamId: 'team-a', shared: false, query: 'project = "project-a"' }));
});
