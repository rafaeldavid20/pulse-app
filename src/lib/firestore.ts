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
  FirestoreError,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import { Workspace, Team, Issue, Project, Label, Member, MemberRole, Comment, Cycle, CycleSettings, Notification, NotificationType, SnoozePreset, AgentQaMode, QaCalibrationRecord } from '@/types';
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

/** Mensaje legible para el error de una suscripción de Firestore (permiso denegado / offline / otro). */
export function describeSubscriptionError(error: FirestoreError): string {
  switch (error.code) {
    case 'permission-denied':
      return 'No tenés permiso para ver estos issues.';
    case 'unavailable':
      return 'Sin conexión — no se pudieron cargar los issues.';
    default:
      return 'No se pudieron cargar los issues.';
  }
}

export function subscribeWorkspaceIssues(
  workspaceId: string,
  callback: (issues: Issue[]) => void,
  onError?: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, 'issues'), where('workspaceId', '==', workspaceId));
  return onSnapshot(
    q,
    (snap) => {
      const issues = snap.docs.map((d) => d.data() as Issue);
      issues.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(issues);
    },
    onError
  );
}

export async function createRealIssue(
  data: Partial<Issue> & { workspaceId: string; teamId: string; creatorId: string }
): Promise<Issue> {
  const actionRes = await callPlatformAction<Issue>('issues.create', data);
  if (!actionRes?.id) throw new Error('No se pudo crear el issue.');
  return actionRes;
}

/**
 * `repoFullName` no es un campo de `Issue`: viaja plano y el backend lo guarda
 * en `git.repoFullName` (la whitelist de campos escribibles solo maneja campos
 * de primer nivel). Va en el tipo para no tener que castear en cada llamada.
 */
export async function updateRealIssue(
  id: string,
  updates: Partial<Issue> & { repoFullName?: string }
) {
  const actionRes = await callPlatformAction('issues.update', { id, ...updates });
  if (!actionRes) throw new Error('No se pudo actualizar el issue.');
}

export async function deleteRealIssue(id: string) {
  const actionRes = await callPlatformAction('issues.delete', { id });
  if (!actionRes) throw new Error('No se pudo eliminar el issue.');
}

/**
 * Mueve un issue bajo otro padre (o lo saca de su padre con `parentId: null`).
 *
 * Es una acción propia y no un `issues.update` con `parentId` porque el backend
 * hace bastante más que escribir un campo: reescribe el `epicId` de todos los
 * descendientes y mueve los contadores de los dos padres involucrados.
 */
export async function reparentIssue(id: string, parentId: string | null): Promise<void> {
  const actionRes = await callPlatformAction('issues.reparent', { id, parentId });
  if (!actionRes) throw new Error('No se pudo mover el issue.');
}

/**
 * Copia un issue (título, descripción, tipo, prioridad, labels, proyecto,
 * estimate, dueDate, ciclo, repo y padre) en uno nuevo, sin asignado y en
 * `todo` — la acción "Duplicar" de la cola de triage (F2).
 */
export async function duplicateIssue(id: string): Promise<Issue> {
  const actionRes = await callPlatformAction<Issue>('issues.duplicate', { id });
  if (!actionRes?.id) throw new Error('No se pudo duplicar el issue.');
  return actionRes;
}

/**
 * Cola de triage (F2): issues huérfanos del workspace — sin proyecto o sin
 * asignar (creados por webhook de GitHub, por un agente vía MCP sin
 * `projectId`, o simplemente sueltos). Firestore no tiene OR entre igualdades
 * de campos distintos, así que son dos queries — cada una golpea su propio
 * índice compuesto (`workspaceId, projectId, createdAt` /
 * `workspaceId, assigneeId, createdAt`) — mergeadas y deduplicadas acá, no en
 * cada consumidor.
 */
export function subscribeTriageIssues(
  workspaceId: string,
  callback: (issues: Issue[]) => void,
  onError?: (error: FirestoreError) => void
): Unsubscribe {
  const noProject = new Map<string, Issue>();
  const noAssignee = new Map<string, Issue>();

  const emit = () => {
    const merged = new Map<string, Issue>();
    noProject.forEach((issue, id) => merged.set(id, issue));
    noAssignee.forEach((issue, id) => merged.set(id, issue));
    const issues = Array.from(merged.values());
    issues.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    callback(issues);
  };

  const qNoProject = query(
    collection(db, 'issues'),
    where('workspaceId', '==', workspaceId),
    where('projectId', '==', null),
    orderBy('createdAt', 'desc')
  );
  const qNoAssignee = query(
    collection(db, 'issues'),
    where('workspaceId', '==', workspaceId),
    where('assigneeId', '==', null),
    orderBy('createdAt', 'desc')
  );

  const unsubProject = onSnapshot(
    qNoProject,
    (snap) => {
      noProject.clear();
      snap.docs.forEach((d) => noProject.set(d.id, d.data() as Issue));
      emit();
    },
    onError
  );
  const unsubAssignee = onSnapshot(
    qNoAssignee,
    (snap) => {
      noAssignee.clear();
      snap.docs.forEach((d) => noAssignee.set(d.id, d.data() as Issue));
      emit();
    },
    onError
  );

  return () => {
    unsubProject();
    unsubAssignee();
  };
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
// 4b. CYCLES SERVICES
// ===============================================================

export function subscribeWorkspaceCycles(
  workspaceId: string,
  callback: (cycles: Cycle[]) => void
): Unsubscribe {
  const q = query(collection(db, 'cycles'), where('workspaceId', '==', workspaceId));
  return onSnapshot(q, (snap) => {
    const cycles = snap.docs.map((d) => d.data() as Cycle);
    callback(cycles);
  });
}

export async function createRealCycle(
  data: Partial<Cycle> & { workspaceId: string; teamId: string; startsAt: string; endsAt: string }
): Promise<Cycle> {
  const actionRes = await callPlatformAction<Cycle>('cycles.create', data);
  if (!actionRes?.id) throw new Error('No se pudo crear el ciclo.');
  return actionRes;
}

export async function updateRealCycle(id: string, updates: Partial<Cycle>) {
  const actionRes = await callPlatformAction('cycles.update', { id, ...updates });
  if (!actionRes) throw new Error('No se pudo actualizar el ciclo.');
}

/** Actualiza `Team.cycleSettings` (E4: config de ciclos y auto-creación). */
export async function updateCycleSettings(
  teamId: string,
  updates: Partial<CycleSettings>
): Promise<CycleSettings> {
  const actionRes = await callPlatformAction<{ cycleSettings: CycleSettings }>('cycles.updateSettings', {
    teamId,
    ...updates,
  });
  if (!actionRes?.cycleSettings) throw new Error('No se pudo actualizar la configuración de ciclos.');
  return actionRes.cycleSettings;
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
  agentId?: string | null,
  scopes?: string[]
): Promise<CreatedApiKey> {
  const actionRes = await callPlatformAction<CreatedApiKey>('apikeys.create', {
    workspaceId,
    name,
    agentId: agentId || undefined,
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
  /** Default `'dev'` — determina qué workflow/secret escribe `agents.connectRepo` (D12/TES-208). */
  role?: string;
  displayName: string;
  defaultRepo?: string;
  defaultTeamId?: string;
  maxConcurrentIssues: number;
  /** Tope de intentos de revisión de QA (D3) antes de cerrar en `needs_human`. Solo agentes `role: 'qa'`. */
  maxReviewAttempts?: number;
  enabled: boolean;
  autonomousMode: boolean;
  connectedRepos?: ConnectedRepo[];
  /** Solo relevante para `role: 'qa'` (D17). Ausente se trata como `'shadow'`. */
  qaMode?: AgentQaMode;
}

export async function listAgents(workspaceId: string): Promise<AgentSummary[]> {
  const actionRes = await callPlatformAction<{ agents: AgentSummary[] }>('agents.list', { workspaceId });
  if (!actionRes) throw new Error('No se pudieron cargar los agentes.');
  return actionRes.agents;
}

export async function updateAgent(
  agentId: string,
  data: Partial<
    Pick<AgentSummary, 'autonomousMode' | 'enabled' | 'maxConcurrentIssues' | 'defaultRepo' | 'defaultTeamId' | 'qaMode'>
  >
): Promise<AgentSummary> {
  const actionRes = await callPlatformAction<{ agent: AgentSummary }>('agents.update', {
    agentId,
    ...data,
  });
  if (!actionRes) throw new Error('No se pudo actualizar el agente.');
  return actionRes.agent;
}

export async function createAgent(
  workspaceId: string,
  data: {
    agentId: string;
    kind: string;
    displayName: string;
    defaultRepo?: string;
    defaultTeamId?: string;
    maxConcurrentIssues?: number;
  }
): Promise<AgentSummary> {
  const actionRes = await callPlatformAction<{ agent: AgentSummary }>('agents.create', {
    workspaceId,
    ...data,
  });
  if (!actionRes) throw new Error('No se pudo crear el agente.');
  return actionRes.agent;
}

export interface QaCalibrationSummary {
  agentId: string;
  qaMode: AgentQaMode;
  sampleSize: number;
  agreed: number;
  disagreed: number;
  /** `null` sin muestras todavía (`sampleSize === 0`). */
  agreementRate: number | null;
  records: QaCalibrationRecord[];
}

/**
 * Tasa de acuerdo humano/QA de las últimas N revisiones (D17), para la vista
 * del agente QA en Settings. `qa_calibration_records` es Admin-SDK-only, así
 * que pasa por Platform Action igual que `agents.list`.
 */
export async function getQaCalibration(agentId: string, limit?: number): Promise<QaCalibrationSummary> {
  const actionRes = await callPlatformAction<QaCalibrationSummary>('agents.getQaCalibration', {
    agentId,
    ...(limit ? { limit } : {}),
  });
  if (!actionRes) throw new Error('No se pudo cargar la tasa de acuerdo del QA.');
  return actionRes;
}

// ===============================================================
// 6b. WORKSPACE AGENT GUARDRAILS (D8/TES-153)
// ===============================================================
// `agent_dispatch_counters` y `agent_runs` son Admin-SDK-only, así que el
// resumen de hoy y el kill switch pasan por Platform Actions, no por lectura
// directa de Firestore.

export interface AgentBudgetRoleSummary {
  dispatches: number;
  costUsd: number;
}

export interface AgentBudgetSummary {
  agentsPaused: boolean;
  dispatchesToday: number;
  dailyDispatchLimit: number;
  costUsdToday: number;
  dailyCostCapUsd: number | null;
  byRole: Record<string, AgentBudgetRoleSummary>;
}

export async function getWorkspaceAgentBudget(workspaceId: string): Promise<AgentBudgetSummary> {
  const actionRes = await callPlatformAction<AgentBudgetSummary>('workspaces.getAgentBudget', {
    workspaceId,
  });
  if (!actionRes) throw new Error('No se pudo cargar el presupuesto de agentes.');
  return actionRes;
}

export type WorkspaceGuardrails = Pick<
  Workspace,
  'agentsPaused' | 'dailyDispatchLimit' | 'dailyCostCapUsd' | 'issueCostCapUsd' | 'maxRunsPerIssue'
>;

export async function updateWorkspaceGuardrails(
  workspaceId: string,
  data: Partial<WorkspaceGuardrails>
): Promise<Workspace> {
  const actionRes = await callPlatformAction<{ workspace: Workspace }>('workspaces.update', {
    workspaceId,
    ...data,
  });
  if (!actionRes) throw new Error('No se pudo actualizar el workspace.');
  return actionRes.workspace;
}

// ===============================================================
// 7. COMMENTS SERVICES
// ===============================================================
// No client-side fallback for creating comments: `comments.create`
// authorizes against the issue's real workspaceId (see the backend action),
// and a silent client fallback would let that check be bypassed entirely.

/**
 * El filtro por `workspaceId` no es redundante con el de `issueId`: es lo que
 * hace que la query pase las security rules.
 *
 * La regla de `comments` es `allow read: if isMember(resource.data.workspaceId)`.
 * En una operación `list`, Firestore no evalúa la regla documento por documento
 * — exige que la *query* garantice que todo lo que puede devolver la cumple. Con
 * solo `where issueId == X`, no puede garantizarlo y rechaza la query entera con
 * permission-denied. Por eso las de issues/projects/labels, que filtran por
 * `workspaceId`, sí funcionaban y esta no.
 *
 * El síntoma era engañoso: la sección de comentarios mostraba "Todavía no hay
 * comentarios" en vez de un error, así que todo lo que escribían los agentes y
 * el sync de GitHub era invisible.
 */
export function subscribeIssueComments(
  workspaceId: string,
  issueId: string,
  callback: (comments: Comment[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'comments'),
    where('workspaceId', '==', workspaceId),
    where('issueId', '==', issueId),
    orderBy('createdAt', 'asc')
  );
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
// 7b. NOTIFICATIONS SERVICES
// ===============================================================
// No client-side fallback: `notifications` es `allow write: if false` en las
// reglas de Firestore, solo la genera el Admin SDK (triggers de pulse-backend).

/**
 * Un snooze futuro oculta la notificación del inbox (F4) — sin cron, la
 * notificación simplemente deja de matchear este filtro client-side una vez
 * que `snoozedUntil` queda en el pasado.
 */
function isSnoozed(notification: Notification): boolean {
  return !!notification.snoozedUntil && new Date(notification.snoozedUntil) > new Date();
}

/**
 * Notificaciones no leídas del usuario, para el badge de contador (F1). Filtra
 * `read == false` a propósito y no solo `userId`: es lo que hace que la query
 * calce con el único índice compuesto que existe para esta colección
 * (`userId asc, read asc, createdAt desc`) — sin el filtro de `read`,
 * Firestore la rechaza por faltarle índice. La lista completa del inbox
 * (F3) necesitará su propio índice cuando exista.
 */
export function subscribeUserNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as Notification).filter((n) => !isSnoozed(n)));
  });
}

/**
 * Todas las notificaciones del usuario (leídas y no leídas), para el inbox
 * completo (F3). A propósito sin `orderBy`: combinado con el filtro de
 * `userId` pediría su propio índice compuesto (distinto del de arriba, que
 * incluye `read`), así que se ordena en el cliente en su lugar.
 */
export function subscribeAllUserNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void,
  onError?: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, 'notifications'), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const notifications = snap.docs.map((d) => d.data() as Notification).filter((n) => !isSnoozed(n));
      notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(notifications);
    },
    onError
  );
}

/**
 * Marca una notificación como leída. Pasa por Platform Action porque
 * `notifications` es de solo lectura para el cliente (ver arriba) — la acción
 * todavía no tiene handler en pulse-backend (TES-193).
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  const actionRes = await callPlatformAction('notifications.markRead', { notificationId });
  if (!actionRes) throw new Error('No se pudo marcar la notificación como leída.');
}

/** Marca todas las notificaciones no leídas del usuario como leídas. */
export async function markAllNotificationsRead(): Promise<void> {
  const actionRes = await callPlatformAction('notifications.markAllRead', {});
  if (!actionRes) throw new Error('No se pudieron marcar las notificaciones como leídas.');
}

/** Silencia las notificaciones futuras de un issue para el usuario actual. */
export async function muteIssueNotifications(issueId: string): Promise<void> {
  const actionRes = await callPlatformAction('notifications.muteIssue', { issueId });
  if (!actionRes) throw new Error('No se pudo silenciar el issue.');
}

/**
 * Pospone (o le saca el snooze a, con `preset: 'clear'`) una notificación
 * puntual (F4). Mientras el snooze esté vigente, `subscribeUserNotifications`
 * / `subscribeAllUserNotifications` la ocultan del inbox.
 */
export async function snoozeNotification(notificationId: string, preset: SnoozePreset): Promise<void> {
  const actionRes = await callPlatformAction('notifications.snooze', { notificationId, preset });
  if (!actionRes) throw new Error('No se pudo posponer la notificación.');
}

/**
 * Prende/apaga una categoría entera de notificación para el miembro actual
 * en `workspaceId` (F4) — a diferencia de `muteIssueNotifications`, no
 * depende de un issue puntual.
 */
export async function updateNotificationPreference(
  workspaceId: string,
  type: NotificationType,
  enabled: boolean
): Promise<void> {
  const actionRes = await callPlatformAction('notifications.updatePreferences', { workspaceId, type, enabled });
  if (!actionRes) throw new Error('No se pudo actualizar la preferencia de notificación.');
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
  /** Permisos que le faltan a la instalación para poder conectar repos. */
  missingPermissions?: string[];
  canConnectRepos?: boolean;
}

export interface ConnectedRepo {
  repoFullName: string;
  apiKeyId: string;
  /** Ausente en conexiones de antes de D12/TES-208. */
  workflowPath?: string;
  workflowSha?: string;
  workflowVersion?: number;
  /** Ausente en conexiones de antes de D12/TES-208. */
  secretName?: string;
  connectedAt: string;
}

export interface ConnectRepoResult {
  repoFullName: string;
  workflowPath: string;
  workflowCreated: boolean;
  workflowVersion: number;
  mcpSecretName: string;
  anthropicSecretPresent: boolean;
  anthropicSecretName: string;
  /** Comando a copiar para el secret que Pulse deliberadamente no gestiona. */
  manualStep: string | null;
}

/**
 * Última versión de cada plantilla de workflow (`WORKFLOW_VERSION`/
 * `QA_WORKFLOW_VERSION` en `pulse-backend/functions/src/github/templates/`),
 * para que Settings pueda marcar como atrasado un repo cuyo
 * `ConnectedRepo.workflowVersion` quedó por debajo. `agents.connectRepo` no
 * expone esto por lectura (D12/TES-208 no agregó ese endpoint), así que se
 * duplica a mano acá — mismo patrón de copia manual entre repos que
 * `domain.generated.ts` en pulse-backend, y con el mismo riesgo: si sube la
 * versión del lado del backend y nadie actualiza esto, un repo desactualizado
 * deja de detectarse como tal hasta que se bumpee a mano.
 */
export const LATEST_AGENT_WORKFLOW_VERSION: Record<'dev' | 'qa', number> = {
  dev: 6,
  qa: 1,
};

/**
 * Deja un repo listo para recibir dispatches: crea una key de MCP dedicada, la
 * escribe como secret y commitea el workflow en la rama por defecto.
 *
 * No toca el token de Anthropic — es del usuario y Pulse no lo guarda ni lo
 * transporta. El resultado dice si ya está puesto y, si no, con qué comando.
 */
export async function connectAgentRepo(
  workspaceId: string,
  agentId: string,
  repoFullName: string
): Promise<ConnectRepoResult> {
  const res = await callPlatformAction<ConnectRepoResult>('agents.connectRepo', {
    workspaceId,
    agentId,
    repoFullName,
  });
  if (!res) throw new Error('No se pudo conectar el repo.');
  return res;
}

export async function disconnectAgentRepo(
  workspaceId: string,
  agentId: string,
  repoFullName: string,
  removeWorkflow = false
): Promise<void> {
  const res = await callPlatformAction('agents.disconnectRepo', {
    workspaceId,
    agentId,
    repoFullName,
    removeWorkflow,
  });
  if (!res) throw new Error('No se pudo desconectar el repo.');
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

// ===============================================================
// 9. REVIEWS SERVICES (D5, D7 — panel de revisión de QA)
// ===============================================================

/** "Aprobar igual" / forzar cambios (D7): un humano pisa el veredicto del QA. Implementado en pulse-backend (`reviews.override`). */
export async function overrideReview(
  issueId: string,
  decision: 'approved' | 'changes_requested',
  reason?: string
): Promise<void> {
  const actionRes = await callPlatformAction('reviews.override', { issueId, decision, reason });
  if (!actionRes) throw new Error('No se pudo forzar el veredicto de la revisión.');
}

/**
 * "Descartar finding" (D7): un humano lo da por no-válido desde la UI, sin que
 * medie un push del dev (a diferencia de `reviews.resolveFinding`, que es del
 * dev y solo admite `fixed`/`disputed`). Todavía no tiene handler en
 * pulse-backend — ver TES-152 y el pedido de trabajo registrado para ese repo.
 */
export async function dismissFinding(issueId: string, findingId: string, note?: string): Promise<void> {
  const actionRes = await callPlatformAction('reviews.dismissFinding', { issueId, findingId, note });
  if (!actionRes) throw new Error('No se pudo descartar el finding.');
}

/**
 * "Re-ejecutar QA" (D7): vuelve a despachar el intento de revisión en curso.
 * Todavía no tiene handler en pulse-backend — ver TES-152.
 */
export async function rerunReview(issueId: string): Promise<void> {
  const actionRes = await callPlatformAction('reviews.rerun', { issueId });
  if (!actionRes) throw new Error('No se pudo re-ejecutar la revisión de QA.');
}

/**
 * "Devolver al agente" (D7): desde `needs_human`, reasigna al dev original
 * (`review.previousAssigneeId`) con el comentario del humano y resetea
 * `review.attempt` para darle una nueva tanda de intentos. Todavía no tiene
 * handler en pulse-backend — ver TES-152.
 */
export async function returnReviewToAgent(issueId: string, comment: string): Promise<void> {
  const actionRes = await callPlatformAction('reviews.returnToAgent', { issueId, comment });
  if (!actionRes) throw new Error('No se pudo devolver el issue al agente.');
}
