import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  arrayUnion,
  Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import { Workspace, Team, Issue, Project, Label, Member, MemberRole, Comment } from '@/types';
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

export async function createRealIssue(
  data: Partial<Issue> & { workspaceId: string; teamId: string; creatorId: string }
): Promise<Issue> {
  const actionRes = await callPlatformAction<Issue>('issues.create', data);
  if (!actionRes?.id) throw new Error('No se pudo crear el issue.');
  return actionRes;
}

export async function updateRealIssue(id: string, updates: Partial<Issue>) {
  const actionRes = await callPlatformAction('issues.update', { id, ...updates });
  if (!actionRes) throw new Error('No se pudo actualizar el issue.');
}

export async function deleteRealIssue(id: string) {
  const actionRes = await callPlatformAction('issues.delete', { id });
  if (!actionRes) throw new Error('No se pudo eliminar el issue.');
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
  if (!actionRes?.id) throw new Error('No se pudo crear el proyecto.');
  return actionRes;
}

export async function updateRealProject(id: string, updates: Partial<Project>) {
  const actionRes = await callPlatformAction('projects.update', { id, ...updates });
  if (!actionRes) throw new Error('No se pudo actualizar el proyecto.');
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
  const actionRes = await callPlatformAction<Label>('labels.create', { workspaceId, teamId, name, color });
  if (!actionRes?.id) throw new Error('No se pudo crear la etiqueta.');
  return actionRes;
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
// 6b. AGENTS SERVICES
// ===============================================================
// No client-side fallback for these either: `agents` is `allow read, write:
// if false` in Firestore rules — Admin SDK only, via Platform Actions.

export interface AgentSummary {
  id: string;
  workspaceId: string;
  kind: string;
  displayName: string;
  defaultRepo?: string;
  defaultTeamId?: string;
  maxConcurrentIssues: number;
  enabled: boolean;
  autonomousMode: boolean;
}

export async function listAgents(workspaceId: string): Promise<AgentSummary[]> {
  const actionRes = await callPlatformAction<{ agents: AgentSummary[] }>('agents.list', { workspaceId });
  if (!actionRes) throw new Error('No se pudieron cargar los agentes.');
  return actionRes.agents;
}

export async function updateAgent(
  agentId: string,
  data: Partial<Pick<AgentSummary, 'autonomousMode' | 'enabled' | 'maxConcurrentIssues' | 'defaultRepo' | 'defaultTeamId'>>
): Promise<AgentSummary> {
  const actionRes = await callPlatformAction<{ agent: AgentSummary }>('agents.update', {
    agentId,
    ...data,
  });
  if (!actionRes) throw new Error('No se pudo actualizar el agente.');
  return actionRes.agent;
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

// ===============================================================
// 8. GITHUB SERVICES
// ===============================================================
// No client-side fallback: `github_installations` is Admin-SDK-only, these
// all go through Platform Actions.

export interface GithubStatus {
  connected: boolean;
  accountLogin?: string;
  repositories?: string[];
  connectedAt?: string;
}

export async function getGithubStatus(workspaceId: string): Promise<GithubStatus> {
  const actionRes = await callPlatformAction<GithubStatus>('github.status', { workspaceId });
  if (!actionRes) throw new Error('No se pudo consultar el estado de GitHub.');
  return actionRes;
}

export async function getGithubInstallUrl(workspaceId: string): Promise<string> {
  const actionRes = await callPlatformAction<{ installUrl: string }>('github.createInstallUrl', { workspaceId });
  if (!actionRes) throw new Error('No se pudo generar el link de instalación de GitHub.');
  return actionRes.installUrl;
}

export async function createIssueBranch(issueId: string, repoFullName?: string): Promise<Issue['git']> {
  const actionRes = await callPlatformAction<Issue['git']>('github.createBranch', { issueId, repoFullName });
  if (!actionRes) throw new Error('No se pudo crear la rama en GitHub.');
  return actionRes;
}
