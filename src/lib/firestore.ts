import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  arrayUnion,
  runTransaction,
  Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import { Workspace, Team, Issue, Project, Label, Member, MemberRole, IssuePriority, Comment } from '@/types';
import { ISSUE_WRITABLE_FIELDS } from '@/lib/constants/issue';
import { nanoid } from 'nanoid';

export interface UserDoc {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  workspaceIds: string[];
  createdAt: string;
}

export interface InvitationDoc {
  id: string;
  workspaceId: string;
  workspaceName?: string;
  email: string;
  role: MemberRole;
  inviterId: string;
  inviterName?: string;
  status: 'pending' | 'accepted';
  createdAt: string;
}

// Helper to remove any `undefined` keys before sending to Cloud Firestore.
// Deep: recurses into plain objects and arrays (mirrors
// pulse-backend/functions/src/common/utils/clean.ts — keep both in sync).
function cleanUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => cleanUndefined(item)) as unknown as T;
  }

  if (value !== null && typeof value === 'object' && value.constructor === Object) {
    const source = value as Record<string, unknown>;
    const clean: Record<string, unknown> = {};
    Object.keys(source).forEach((key) => {
      const v = source[key];
      if (v !== undefined) {
        clean[key] = cleanUndefined(v);
      }
    });
    return clean as T;
  }

  return value;
}

// ===============================================================
// PLATFORM ACTION CALLABLE WRAPPER
// ===============================================================

/**
 * Logs every time a mutation falls back from the `pulsePlatformAction`
 * Cloud Function to a direct client-side Firestore write. This fallback is
 * meant to be a safety net, not a load-bearing code path — before any
 * authorization is added to Platform Actions (which the client fallback
 * would silently bypass), we need evidence from real usage that the
 * fallback essentially never triggers. Grep browser console logs for
 * `[PlatformAction:fallback]` to check.
 */
function logPlatformActionFallback(actionCode: string, reason: 'error' | 'unsuccessful', detail: unknown) {
  console.warn(
    `[PlatformAction:fallback] '${actionCode}' fell back to a direct client write (reason: ${reason}). ` +
      `This should be rare — if it happens often, the Cloud Function path has a bug that needs fixing ` +
      `before Platform Actions can be locked down with real authorization.`,
    detail
  );
}

export async function callPlatformAction<T = any>(
  actionCode: string,
  data: Record<string, any>
): Promise<T | null> {
  try {
    const pulsePlatformAction = httpsCallable(functions, 'pulsePlatformAction');
    const result = await pulsePlatformAction({ actionCode, data });
    const payload = result.data as any;
    if (payload && payload.success) {
      return payload.data as T;
    }
    logPlatformActionFallback(actionCode, 'unsuccessful', payload);
    return null;
  } catch (error) {
    logPlatformActionFallback(actionCode, 'error', error);
    return null;
  }
}

// ===============================================================
// 1. WORKSPACE & MEMBERSHIP SERVICES
// ===============================================================

export async function createUserWorkspace(
  userId: string,
  userEmail: string,
  userName: string,
  workspaceName: string
): Promise<{ workspace: Workspace; team: Team }> {
  // Attempt Cloud Function Platform Action execution
  const actionRes = await callPlatformAction<{ workspace: Workspace; team: Team }>(
    'workspaces.create',
    { userId, userEmail, userName, name: workspaceName }
  );

  if (actionRes && actionRes.workspace && actionRes.team) {
    return actionRes;
  }

  // Direct client fallback
  const wsId = `ws-${nanoid(8)}`;
  const slug = workspaceName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

  const workspace: Workspace = {
    id: wsId,
    name: workspaceName,
    slug,
    ownerId: userId,
    createdAt: new Date().toISOString(),
  };

  await setDoc(doc(db, 'workspaces', wsId), cleanUndefined(workspace));

  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    await updateDoc(userRef, {
      workspaceIds: arrayUnion(wsId),
    });
  } else {
    await setDoc(userRef, cleanUndefined({
      uid: userId,
      email: userEmail,
      displayName: userName,
      workspaceIds: [wsId],
      createdAt: new Date().toISOString(),
    }));
  }

  const memberId = `${wsId}_${userId}`;
  const member: Member = {
    id: memberId,
    workspaceId: wsId,
    userId,
    email: userEmail,
    displayName: userName,
    role: 'owner',
    joinedAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'members', memberId), cleanUndefined(member));

  const wsKey = workspaceName.trim().substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'W') || 'PUL';

  const teamId = `team-${nanoid(8)}`;
  const team: Team = {
    id: teamId,
    workspaceId: wsId,
    name: workspaceName || 'Engineering',
    key: wsKey,
    icon: '⚡',
    issueCount: 0,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'teams', teamId), cleanUndefined(team));

  const defaultLabels = [
    { name: 'feature', color: '#5E6AD2' },
    { name: 'bug', color: '#F75555' },
    { name: 'frontend', color: '#F09436' },
    { name: 'backend', color: '#5E94E4' },
  ];
  for (const l of defaultLabels) {
    const labelId = `lbl-${nanoid(8)}`;
    await setDoc(doc(db, 'labels', labelId), cleanUndefined({
      id: labelId,
      workspaceId: wsId,
      teamId,
      name: l.name,
      color: l.color,
    }));
  }

  return { workspace, team };
}

export function subscribeUserWorkspaces(
  userId: string,
  userEmail: string,
  callback: (workspaces: Workspace[]) => void
): Unsubscribe {
  const q = query(collection(db, 'members'), where('userId', '==', userId));

  return onSnapshot(q, async (snap) => {
    const wsIds = snap.docs.map((d) => d.data().workspaceId);

    if (wsIds.length === 0) {
      callback([]);
      return;
    }

    const workspaces: Workspace[] = [];
    for (const wsId of wsIds) {
      try {
        const wsSnap = await getDoc(doc(db, 'workspaces', wsId));
        if (wsSnap.exists()) {
          workspaces.push(wsSnap.data() as Workspace);
        }
      } catch (e) {
        // Fallback
      }
    }
    callback(workspaces);
  });
}

export function subscribeWorkspaceMembers(
  workspaceId: string,
  callback: (members: Member[]) => void
): Unsubscribe {
  const q = query(collection(db, 'members'), where('workspaceId', '==', workspaceId));
  return onSnapshot(q, (snap) => {
    const members = snap.docs.map((d) => d.data() as Member);
    callback(members);
  });
}

export async function inviteUserToWorkspace(
  workspaceId: string,
  workspaceName: string,
  email: string,
  role: MemberRole,
  inviterId: string,
  inviterName: string
) {
  // Attempt Cloud Function Platform Action
  const actionRes = await callPlatformAction('workspaces.inviteMember', {
    workspaceId,
    workspaceName,
    email,
    role,
    inviterId,
    inviterName,
  });

  if (actionRes) return actionRes;

  const cleanEmail = email.trim().toLowerCase();
  const invId = `inv-${nanoid(8)}`;
  const invitation: InvitationDoc = {
    id: invId,
    workspaceId,
    workspaceName: workspaceName || 'Workspace',
    email: cleanEmail,
    role,
    inviterId,
    inviterName: inviterName || 'Un miembro',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  await setDoc(doc(db, 'invitations', invId), cleanUndefined(invitation));

  try {
    const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const userDoc = snap.docs[0].data() as UserDoc;
      const memberId = `${workspaceId}_${userDoc.uid}`;
      await setDoc(doc(db, 'members', memberId), cleanUndefined({
        id: memberId,
        workspaceId,
        userId: userDoc.uid,
        email: userDoc.email,
        displayName: userDoc.displayName || cleanEmail,
        role,
        joinedAt: new Date().toISOString(),
      }));

      await updateDoc(doc(db, 'users', userDoc.uid), {
        workspaceIds: arrayUnion(workspaceId),
      });

      await updateDoc(doc(db, 'invitations', invId), { status: 'accepted' });
    }
  } catch (err) {
    console.warn('Non-fatal warning when querying existing users for invitation:', err);
  }
}

export async function processPendingInvitations(userId: string, email: string, displayName: string) {
  const q = query(
    collection(db, 'invitations'),
    where('email', '==', email.trim().toLowerCase()),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);

  for (const d of snap.docs) {
    const inv = d.data() as InvitationDoc;
    const memberId = `${inv.workspaceId}_${userId}`;

    await setDoc(doc(db, 'members', memberId), cleanUndefined({
      id: memberId,
      workspaceId: inv.workspaceId,
      userId,
      email: email.trim().toLowerCase(),
      displayName,
      role: inv.role,
      joinedAt: new Date().toISOString(),
    }));

    await updateDoc(doc(db, 'users', userId), {
      workspaceIds: arrayUnion(inv.workspaceId),
    });

    await updateDoc(doc(db, 'invitations', inv.id), { status: 'accepted' });
  }
}

// ===============================================================
// 2. TEAMS SERVICES
// ===============================================================

export function subscribeWorkspaceTeams(
  workspaceId: string,
  callback: (teams: Team[]) => void
): Unsubscribe {
  const q = query(collection(db, 'teams'), where('workspaceId', '==', workspaceId));
  return onSnapshot(q, (snap) => {
    const teams = snap.docs.map((d) => d.data() as Team);
    callback(teams);
  });
}

export async function createTeamInWorkspace(workspaceId: string, name: string, key: string): Promise<Team> {
  const teamId = `team-${nanoid(8)}`;
  const team: Team = {
    id: teamId,
    workspaceId,
    name,
    key: key.toUpperCase(),
    icon: '⚡',
    issueCount: 0,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'teams', teamId), cleanUndefined(team));
  return team;
}

// ===============================================================
// 3. ISSUES SERVICES (REAL-TIME SNAPSHOT PER WORKSPACE)
// ===============================================================

export function subscribeWorkspaceIssues(
  workspaceId: string,
  callback: (issues: Issue[]) => void
): Unsubscribe {
  const q = query(collection(db, 'issues'), where('workspaceId', '==', workspaceId));
  return onSnapshot(q, (snap) => {
    const issues = snap.docs.map((d) => d.data() as Issue);
    issues.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    callback(issues);
  });
}

/**
 * Atomically reserves the next sequential issue number for a
 * workspace/team, mirroring the Cloud Function's counter logic
 * (`pulse-backend/functions/src/common/utils/counters.ts`) so both write
 * paths share the same `counters/{workspaceId}_{teamId}` doc and never mint
 * duplicate identifiers, even if one create goes through the callable and a
 * concurrent one falls back to this client path.
 */
async function nextIssueNumber(workspaceId: string, teamId: string): Promise<number> {
  const counterRef = doc(db, 'counters', `${workspaceId}_${teamId}`);

  // Firestore transactions require all reads before any writes, so the
  // backfill query (only needed the first time this team's counter is
  // created) runs outside the transaction. There's a small race window if
  // two clients hit an uninitialized counter simultaneously — acceptable
  // for the client-side fallback path, whose main job is not colliding
  // with the Cloud Function's own (transactional) counter reservations.
  const counterSnapBeforeTx = await getDoc(counterRef);
  let seed = 101;
  if (!counterSnapBeforeTx.exists()) {
    const existing = await getDocs(
      query(collection(db, 'issues'), where('workspaceId', '==', workspaceId), where('teamId', '==', teamId))
    );
    let maxNumber = 100;
    existing.forEach((d) => {
      const n = (d.data() as Issue).number;
      if (typeof n === 'number' && n > maxNumber) maxNumber = n;
    });
    seed = maxNumber + 1;
  }

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    if (!snap.exists()) {
      tx.set(counterRef, { workspaceId, teamId, value: seed, updatedAt: new Date().toISOString() });
      return seed;
    }
    const next = (snap.data().value ?? 100) + 1;
    tx.update(counterRef, { value: next, updatedAt: new Date().toISOString() });
    return next;
  });
}

export async function createRealIssue(
  data: Partial<Issue> & { workspaceId: string; teamId: string; creatorId: string }
): Promise<Issue> {
  // Attempt Platform Action execution
  const actionRes = await callPlatformAction<Issue>('issues.create', data);
  if (actionRes && actionRes.id) return actionRes;

  const issueId = `issue-${nanoid(8)}`;
  const nextNum = await nextIssueNumber(data.workspaceId, data.teamId);
  const teamKey = (data as any).teamKey || 'ORD';

  // Whitelist, not a spread of `data`: fields not in ISSUE_WRITABLE_FIELDS
  // (e.g. estimate, dueDate, parentId) used to be silently dropped here
  // because this object only listed a hardcoded subset of Issue's fields.
  const writable: Record<string, unknown> = {};
  const dataRecord = data as Record<string, unknown>;
  for (const field of ISSUE_WRITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(dataRecord, field)) {
      writable[field] = dataRecord[field];
    }
  }

  const rawIssueData = {
    ...writable,
    id: issueId,
    workspaceId: data.workspaceId,
    teamId: data.teamId,
    projectId: data.projectId || null,
    identifier: `${teamKey}-${nextNum}`,
    number: nextNum,
    title: data.title || 'Nuevo Issue',
    description: data.description || '',
    status: data.status || 'todo',
    priority: (data.priority !== undefined ? data.priority : 3) as IssuePriority,
    assigneeId: data.assigneeId || null,
    creatorId: data.creatorId,
    labelIds: data.labelIds || ['feature'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const issue = cleanUndefined(rawIssueData) as unknown as Issue;

  await setDoc(doc(db, 'issues', issueId), issue);
  return issue;
}

export async function updateRealIssue(id: string, updates: Partial<Issue>) {
  const actionRes = await callPlatformAction('issues.update', { id, ...updates });
  if (actionRes) return;

  const issueRef = doc(db, 'issues', id);
  await updateDoc(issueRef, cleanUndefined({
    ...updates,
    updatedAt: new Date().toISOString(),
  }));
}

export async function deleteRealIssue(id: string) {
  const actionRes = await callPlatformAction('issues.delete', { id });
  if (actionRes) return;

  await deleteDoc(doc(db, 'issues', id));
}

// ===============================================================
// 4. PROJECTS SERVICES
// ===============================================================

export function subscribeWorkspaceProjects(
  workspaceId: string,
  callback: (projects: Project[]) => void
): Unsubscribe {
  const q = query(collection(db, 'projects'), where('workspaceId', '==', workspaceId));
  return onSnapshot(q, (snap) => {
    const projects = snap.docs.map((d) => d.data() as Project);
    callback(projects);
  });
}

export async function createRealProject(
  data: Partial<Project> & { workspaceId: string; teamId: string; name: string }
): Promise<Project> {
  const actionRes = await callPlatformAction<Project>('projects.create', data);
  if (actionRes && actionRes.id) return actionRes;

  const projId = `proj-${nanoid(8)}`;
  const rawProject = {
    id: projId,
    workspaceId: data.workspaceId,
    teamId: data.teamId,
    name: data.name,
    description: data.description || '',
    status: data.status || 'in_progress',
    leadId: data.leadId || null,
    color: data.color || '#5E6AD2',
    targetDate: data.targetDate || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const project = cleanUndefined(rawProject) as unknown as Project;
  await setDoc(doc(db, 'projects', projId), project);
  return project;
}

export async function updateRealProject(id: string, updates: Partial<Project>) {
  const actionRes = await callPlatformAction('projects.update', { id, ...updates });
  if (actionRes) return;

  await updateDoc(doc(db, 'projects', id), cleanUndefined({
    ...updates,
    updatedAt: new Date().toISOString(),
  }));
}

// ===============================================================
// 5. LABELS SERVICES
// ===============================================================

export function subscribeWorkspaceLabels(
  workspaceId: string,
  callback: (labels: Label[]) => void
): Unsubscribe {
  const q = query(collection(db, 'labels'), where('workspaceId', '==', workspaceId));
  return onSnapshot(q, (snap) => {
    const labels = snap.docs.map((d) => d.data() as Label);
    callback(labels);
  });
}

export async function createRealLabel(
  workspaceId: string,
  teamId: string,
  name: string,
  color: string
): Promise<Label> {
  const labelId = `lbl-${nanoid(8)}`;
  const label: Label = {
    id: labelId,
    teamId,
    name: name.trim().toLowerCase(),
    color,
  };
  await setDoc(doc(db, 'labels', labelId), cleanUndefined({ ...label, workspaceId }));
  return label;
}

// ===============================================================
// 6. API KEYS SERVICES (MCP)
// ===============================================================
// No client-side fallback for these: `api_keys` is `allow read, write: if false`
// in Firestore rules on purpose — Admin SDK only, via Platform Actions.

export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  agentId: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface CreatedApiKey extends Omit<ApiKeySummary, 'agentId' | 'lastUsedAt' | 'revokedAt'> {
  fullKey: string;
}

export async function listApiKeys(workspaceId: string): Promise<ApiKeySummary[]> {
  const actionRes = await callPlatformAction<{ keys: ApiKeySummary[] }>('apikeys.list', { workspaceId });
  if (!actionRes) throw new Error('No se pudieron cargar las claves de API.');
  return actionRes.keys;
}

export async function createApiKey(
  workspaceId: string,
  name: string,
  scopes?: string[]
): Promise<CreatedApiKey> {
  const actionRes = await callPlatformAction<CreatedApiKey>('apikeys.create', {
    workspaceId,
    name,
    scopes,
  });
  if (!actionRes) throw new Error('No se pudo crear la clave de API.');
  return actionRes;
}

export async function revokeApiKey(id: string): Promise<void> {
  const actionRes = await callPlatformAction('apikeys.revoke', { id });
  if (!actionRes) throw new Error('No se pudo revocar la clave de API.');
}

// ===============================================================
// 7. COMMENTS SERVICES
// ===============================================================
// No client-side fallback for creating comments: `comments.create`
// authorizes against the issue's real workspaceId (see the backend action),
// and a silent client fallback would let that check be bypassed entirely.

export function subscribeIssueComments(
  issueId: string,
  callback: (comments: Comment[]) => void
): Unsubscribe {
  const q = query(collection(db, 'comments'), where('issueId', '==', issueId), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as Comment));
  });
}

export async function createComment(issueId: string, body: string): Promise<Comment> {
  const actionRes = await callPlatformAction<Comment>('comments.create', { issueId, body, source: 'web' });
  if (!actionRes) throw new Error('No se pudo publicar el comentario.');
  return actionRes;
}
