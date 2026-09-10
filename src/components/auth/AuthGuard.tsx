'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/firebase';
import { useKeyboard } from '@/hooks/useKeyboard';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';
import { useProjectStore } from '@/stores/projectStore';
import { useLabelStore } from '@/stores/labelStore';
import {
  subscribeUserWorkspaces,
  subscribeWorkspaceMembers,
  subscribeWorkspaceTeams,
  subscribeWorkspaceIssues,
  subscribeWorkspaceProjects,
  subscribeWorkspaceLabels,
  describeSubscriptionError,
} from '@/lib/firestore';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { ShortcutHelp } from '@/components/layout/ShortcutHelp';
import { CreateIssueModal } from '@/components/issues/CreateIssueModal';
import { IssuePeekPanel } from '@/components/issues/IssuePeekPanel';
import { InviteMemberModal } from '@/components/workspace/InviteMemberModal';
import { CreateMenuModal } from '@/components/layout/CreateMenuModal';
import { ProjectModal } from '@/components/projects/ProjectModal';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const setUserWorkspaces = useAppStore((s) => s.setUserWorkspaces);
  const setMembers = useAppStore((s) => s.setMembers);
  const setTeams = useAppStore((s) => s.setTeams);
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);

  const setIssues = useIssueStore((s) => s.setIssues);
  const setIssuesError = useIssueStore((s) => s.setIssuesError);
  const resetIssuesSubscription = useIssueStore((s) => s.resetIssuesSubscription);
  const setProjects = useProjectStore((s) => s.setProjects);
  const setLabels = useLabelStore((s) => s.setLabels);

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  // Initialize global keyboard listener
  useKeyboard();

  // 1. Auth check & redirection
  useEffect(() => {
    if (loading) return;

    const isAuthPage = pathname === '/login' || pathname === '/signup';

    if (!user && !isAuthPage) {
      router.push('/login');
    } else if (user && isAuthPage) {
      router.push('/team/eng/issues');
    }
  }, [user, loading, pathname, router]);

  // 2. Subscribe to User Workspaces
  const seenWorkspaceIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user) return;

    const unsub = subscribeUserWorkspaces(user.uid, user.email, (workspaces) => {
      setUserWorkspaces(workspaces);

      // A workspace id we haven't seen before means a `members` doc was just
      // created for this user — syncMemberClaimsTrigger needs a moment to
      // run before the custom claim actually reflects it, so this is
      // best-effort: worst case the user reloads or the token refreshes on
      // its own within ~1h (Firebase's normal cadence).
      const newIds = workspaces.map((w) => w.id).filter((id) => !seenWorkspaceIds.current.has(id));
      workspaces.forEach((w) => seenWorkspaceIds.current.add(w.id));
      if (newIds.length > 0) {
        setTimeout(() => {
          auth.currentUser?.getIdToken(true).catch(() => {});
        }, 2000);
      }
    });

    return () => unsub();
  }, [user, setUserWorkspaces]);

  // 3. Subscribe to Active Workspace Data (Members, Teams, Issues, Projects, Labels)
  useEffect(() => {
    if (!activeWorkspace) return;

    // Volver a "cargando" al cambiar de workspace: sin este reset, los issues
    // del workspace anterior siguen mostrándose (o la lista queda vacía) hasta
    // que llega la primera snapshot del nuevo, en vez de ver el skeleton.
    resetIssuesSubscription();

    const unsubMembers = subscribeWorkspaceMembers(activeWorkspace.id, setMembers);
    const unsubTeams = subscribeWorkspaceTeams(activeWorkspace.id, setTeams);
    const unsubIssues = subscribeWorkspaceIssues(activeWorkspace.id, setIssues, (error) => {
      console.error('subscribeWorkspaceIssues', error);
      setIssuesError(describeSubscriptionError(error));
    });
    const unsubProjects = subscribeWorkspaceProjects(activeWorkspace.id, setProjects);
    const unsubLabels = subscribeWorkspaceLabels(activeWorkspace.id, setLabels);

    return () => {
      unsubMembers();
      unsubTeams();
      unsubIssues();
      unsubProjects();
      unsubLabels();
    };
  }, [activeWorkspace, setMembers, setTeams, setIssues, setIssuesError, resetIssuesSubscription, setProjects, setLabels]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08090A] flex flex-col items-center justify-center gap-3 text-[#5E6AD2]">
        <div className="w-8 h-8 border-2 border-[#5E6AD2] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium text-[#8A8F98]">Cargando sesión...</span>
      </div>
    );
  }

  const isAuthPage = pathname === '/login' || pathname === '/signup';
  if (!user && isAuthPage) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <CommandPalette />
      <ShortcutHelp />
      <CreateMenuModal onOpenProjectModal={() => setIsProjectModalOpen(true)} />
      <CreateIssueModal />
      <ProjectModal isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)} />
      <IssuePeekPanel />
      <InviteMemberModal />
    </>
  );
};
