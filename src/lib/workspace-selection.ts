// Persist only an ID, scoped to the signed-in user. Membership snapshots remain
// the source of truth; a saved ID must never start workspace data subscriptions.
const key = (userId: string) => `pulse:active-workspace:${userId}`;

export function readWorkspaceSelection(userId: string): string | null {
  try {
    return window.localStorage.getItem(key(userId));
  } catch {
    return null;
  }
}

export function saveWorkspaceSelection(userId: string, workspaceId: string | null): void {
  try {
    if (workspaceId) window.localStorage.setItem(key(userId), workspaceId);
    else window.localStorage.removeItem(key(userId));
  } catch {
    // Browsers may deny storage. Workspace selection still works in memory.
  }
}
