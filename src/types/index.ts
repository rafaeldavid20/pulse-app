export type IssueStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'canceled';

export type IssuePriority = 0 | 1 | 2 | 3 | 4;
// 0: None, 1: Urgent (Red), 2: High (Orange), 3: Medium (Yellow), 4: Low (Blue)

export type ProjectStatus = 'planned' | 'in_progress' | 'paused' | 'completed' | 'canceled';

export type MemberRole = 'owner' | 'admin' | 'member';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
}

export interface Team {
  id: string;
  workspaceId: string;
  name: string;
  key: string; // e.g. "ENG", "DES", "MKT"
  icon?: string;
  issueCount: number;
  createdAt: string;
}

export interface Label {
  id: string;
  teamId: string;
  name: string;
  color: string;
}

export interface Project {
  id: string;
  teamId: string;
  name: string;
  description: string;
  status: ProjectStatus;
  leadId?: string;
  color?: string;
  targetDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  id: string;
  workspaceId: string;
  userId: string;
  role: MemberRole;
  displayName: string;
  email: string;
  photoURL?: string;
  joinedAt: string;
}

export interface Issue {
  id: string;
  teamId: string;
  projectId?: string;
  identifier: string; // e.g. "ENG-142"
  number: number;
  title: string;
  description?: string;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeId?: string;
  creatorId: string;
  labelIds: string[];
  parentId?: string;
  dueDate?: string;
  estimate?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  issueId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  issueId: string;
  actorId: string;
  type: 'status_change' | 'assignment' | 'label' | 'comment' | 'created' | 'priority_change';
  changes?: {
    fromValue?: string;
    toValue?: string;
  };
  createdAt: string;
}

export interface FilterState {
  search: string;
  status: IssueStatus[];
  priority: IssuePriority[];
  assigneeId?: string;
  projectId?: string;
  labelIds: string[];
}
