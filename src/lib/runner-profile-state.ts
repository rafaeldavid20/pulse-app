export interface ProfileSnapshot {
  version: 1;
  revision: string;
  provider: string;
  model: string | null;
  modelValid: boolean;
  models: string[];
  directories: Array<{ repo: string; selected: string | null; valid: boolean; candidates: Array<{ id: string; alias: string }> }>;
}
export interface ProfileView {
  workspaceId: string; agentId: string; runnerId: string; provider: string;
  binding: string; online: boolean; capable: boolean; repos: string[];
  snapshot: ProfileSnapshot | null; observedAt: string | null;
  request: { id: string; status: string } | null;
}
export type ProfilePatch = { model?: string | null; directories?: Array<{ repo: string; candidateId: string | null }> };

// A refreshed local snapshot can arrive before the durable request result (lost ACK).
// Keep connection/request metadata live, but expose values only after the exact ACK.
export function reconcileProfileView(previous: ProfileView | null, next: ProfileView, pendingId: string | null): ProfileView {
  const requestId = pendingId || (next.request?.status === 'applying' ? next.request.id : null);
  if (!requestId || (next.request?.id === requestId && next.request.status === 'applied')) return next;
  const sameTarget = previous && ['workspaceId', 'agentId', 'runnerId', 'binding'].every(
    key => previous[key as keyof ProfileView] === next[key as keyof ProfileView],
  );
  return { ...next, snapshot: sameTarget ? previous.snapshot : null, observedAt: sameTarget ? previous.observedAt : null };
}

export function profileState(view: ProfileView | null, pendingId: string | null, now = Date.now()) {
  if (!view) return 'no_data';
  if (!view.online) return 'offline';
  if (!view.capable) return 'incompatible';
  if (pendingId && (!view.request || view.request.id !== pendingId || view.request.status === 'applying')) return 'applying';
  if (view.request && ['validation_failed', 'conflict', 'expired', 'forbidden'].includes(view.request.status)) return view.request.status;
  const age = view.observedAt ? now - Date.parse(view.observedAt) : NaN;
  if (!view.snapshot || !Number.isFinite(age) || age < 0 || age > 120_000) return 'no_data';
  return view.request?.status === 'applied' ? 'applied' : 'verified';
}
export function canEditProfile(view: ProfileView | null, pendingId: string | null, now = Date.now()) {
  return !!view?.online && view.capable && !!view.snapshot && !!view.observedAt && now - Date.parse(view.observedAt) < 120_000 && profileState(view, pendingId, now) !== 'applying';
}
