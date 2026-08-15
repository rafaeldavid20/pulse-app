import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  arrayUnion,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { Workspace, Team, Issue, Project, Label, Member, MemberRole, IssueStatus, IssuePriority } from '@/types';
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

// ===============================================================
// 1. WORKSPACE & MEMBERSHIP SERVICES
// ===============================================================

export async function createUserWorkspace(
  userId: string,
  userEmail: string,
  userName: string,
  workspaceName: string
): Promise<{ workspace: Workspace; team: Team }> {
  const wsId = `ws-${nanoid(8)}`;
  const slug = workspaceName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

  const workspace: Workspace = {
    id: wsId,
    name: workspaceName,
    slug,
    ownerId: userId,
    createdAt: new Date().toISOString(),
  };

  // Create Workspace document
  await setDoc(doc(db, 'workspaces', wsId), workspace);

  // Add workspaceId to User document
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    await updateDoc(userRef, {
      workspaceIds: arrayUnion(wsId),
    });
  } else {
    await setDoc(userRef, {
      uid: userId,
      email: userEmail,
      displayName: userName,
      workspaceIds: [wsId],
      createdAt: new Date().toISOString(),
    });
  }

  // Create Owner Membership
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
  await setDoc(doc(db, 'members', memberId), member);

  // Create Default Team ("Engineering", key: "ENG")
  const teamId = `team-${nanoid(8)}`;
  const team: Team = {
    id: teamId,
    workspaceId: wsId,
    name: 'Engineering',
    key: 'ENG',
    icon: '⚡',
    issueCount: 0,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'teams', teamId), team);

  // Create Default Labels
  const defaultLabels = [
    { name: 'feature', color: '#5E6AD2' },
    { name: 'bug', color: '#F75555' },
    { name: 'frontend', color: '#F09436' },
    { name: 'backend', color: '#5E94E4' },
  ];
  for (const l of defaultLabels) {
    const labelId = `lbl-${nanoid(8)}`;
    await setDoc(doc(db, 'labels', labelId), {
      id: labelId,
      workspaceId: wsId,
      teamId,
      name: l.name,
      color: l.color,
    });
  }

  return { workspace, team };
}

export function subscribeUserWorkspaces(
  userId: string,
  userEmail: string,
  callback: (workspaces: Workspace[]) => void
): Unsubscribe {
  // Query members collection where userId == userId or email == userEmail
  const q = query(collection(db, 'members'), where('userId', '==', userId));

  return onSnapshot(q, async (snap) => {
    const wsIds = snap.docs.map((d) => d.data().workspaceId);

    if (wsIds.length === 0) {
      callback([]);
      return;
    }

    // Fetch workspaces docs
    const workspaces: Workspace[] = [];
    for (const wsId of wsIds) {
      const wsSnap = await getDoc(doc(db, 'workspaces', wsId));
      if (wsSnap.exists()) {
        workspaces.push(wsSnap.data() as Workspace);
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

  // 1. Save Invitation document to /invitations
  await setDoc(doc(db, 'invitations', invId), invitation);

  // 2. Check if a user with this email already exists in /users
  try {
    const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const userDoc = snap.docs[0].data() as UserDoc;
      const memberId = `${workspaceId}_${userDoc.uid}`;
      await setDoc(doc(db, 'members', memberId), {
        id: memberId,
        workspaceId,
        userId: userDoc.uid,
        email: userDoc.email,
        displayName: userDoc.displayName || cleanEmail,
        role,
        joinedAt: new Date().toISOString(),
      });

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

    await setDoc(doc(db, 'members', memberId), {
      id: memberId,
      workspaceId: inv.workspaceId,
      userId,
      email: email.trim().toLowerCase(),
      displayName,
      role: inv.role,
      joinedAt: new Date().toISOString(),
    });

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
  await setDoc(doc(db, 'teams', teamId), team);
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
    // Sort by createdAt desc
    issues.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    callback(issues);
  });
}

export async function createRealIssue(
  data: Partial<Issue> & { workspaceId: string; teamId: string; creatorId: string }
): Promise<Issue> {
  const issueId = `issue-${nanoid(8)}`;
  
  // Count existing issues for identifier calculation
  const q = query(
    collection(db, 'issues'),
    where('workspaceId', '==', data.workspaceId),
    where('teamId', '==', data.teamId)
  );
  const snap = await getDocs(q);
  const nextNum = snap.size + 101;
  const teamKey = (data as any).teamKey || 'ENG';

  const issue: Issue = {
    id: issueId,
    workspaceId: data.workspaceId,
    teamId: data.teamId,
    projectId: data.projectId || undefined,
    identifier: `${teamKey}-${nextNum}`,
    number: nextNum,
    title: data.title || 'Nuevo Issue',
    description: data.description || '',
    status: data.status || 'todo',
    priority: (data.priority !== undefined ? data.priority : 3) as IssuePriority,
    assigneeId: data.assigneeId || undefined,
    creatorId: data.creatorId,
    labelIds: data.labelIds || ['feature'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any;

  await setDoc(doc(db, 'issues', issueId), issue);
  return issue;
}

export async function updateRealIssue(id: string, updates: Partial<Issue>) {
  const issueRef = doc(db, 'issues', id);
  await updateDoc(issueRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteRealIssue(id: string) {
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
  const projId = `proj-${nanoid(8)}`;
  const project: Project = {
    id: projId,
    workspaceId: data.workspaceId,
    teamId: data.teamId,
    name: data.name,
    description: data.description || '',
    status: data.status || 'in_progress',
    leadId: data.leadId || undefined,
    color: data.color || '#5E6AD2',
    targetDate: data.targetDate || undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any;

  await setDoc(doc(db, 'projects', projId), project);
  return project;
}

export async function updateRealProject(id: string, updates: Partial<Project>) {
  await updateDoc(doc(db, 'projects', id), {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
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
  await setDoc(doc(db, 'labels', labelId), { ...label, workspaceId });
  return label;
}
