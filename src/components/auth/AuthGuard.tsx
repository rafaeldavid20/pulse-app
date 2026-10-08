'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/firebase';
import { waitForWorkspaceAccess } from '@/lib/workspace-access';
import { useKeyboard } from '@/hooks/useKeyboard';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';
import { useProjectStore } from '@/stores/projectStore';
import { useLabelStore } from '@/stores/labelStore';
import { useCycleStore } from '@/stores/cycleStore';
import { useNotificationStore } from '@/stores/notificationStore';
import {
  subscribeUserWorkspaces,
  subscribeWorkspaceMembers,
  subscribeWorkspaceTeams,
  subscribeWorkspaceIssues,
  subscribeWorkspaceProjects,
  subscribeWorkspaceLabels,
  subscribeWorkspaceCycles,
  subscribeUserNotifications,
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
  const setCycles = useCycleStore((s) => s.setCycles);
  const setUnreadNotifications = useNotificationStore((s) => s.setUnreadNotifications);

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
  useEffect(() => {
    if (!user) return;
    return subscribeUserWorkspaces(user.uid, user.email, setUserWorkspaces);
  }, [user, setUserWorkspaces]);

  // 3. Subscribe to Unread Notifications (badge de contador en sidebar / tab bar)
  //
  // Por `userId`, no por workspace: el inbox es una vista del usuario a través
  // de todos sus workspaces, igual que `subscribeUserWorkspaces`.
  useEffect(() => {
    if (!user) {
      setUnreadNotifications([]);
      return;
    }

    const unsub = subscribeUserNotifications(user.uid, setUnreadNotifications);
    return () => unsub();
  }, [user, setUnreadNotifications]);

  // 4. Subscribe to Active Workspace Data (Members, Teams, Issues, Projects, Labels)
  const workspaceId = activeWorkspace?.id;
  const userId = user?.uid;
  useEffect(() => {
    resetIssuesSubscription();
    useProjectStore.getState().resetProjects();
    setMembers([]);
    setTeams([]);
    setLabels([]);
    setCycles([]);
    if (!workspaceId || !userId) return;

    const controller = new AbortController();
    const unsubscribers: Array<() => void> = [];
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || firebaseUser.uid !== userId) return;

    // Membership documents arrive before the backend updates custom claims.
    // Starting a listener too early terminates it with permission-denied;
    // refreshing the token afterwards does not restart that listener.
    void waitForWorkspaceAccess(firebaseUser, workspaceId, controller.signal)
      .then(() => {
        if (controller.signal.aborted || auth.currentUser?.uid !== userId) return;
        unsubscribers.push(
          subscribeWorkspaceMembers(workspaceId, setMembers),
          subscribeWorkspaceTeams(workspaceId, setTeams),
          subscribeWorkspaceIssues(workspaceId, setIssues, (error) => {
            if (controller.signal.aborted) return;
            console.error('subscribeWorkspaceIssues', error);
            setIssuesError(describeSubscriptionError(error));
          }),
          subscribeWorkspaceProjects(workspaceId, setProjects),
          subscribeWorkspaceLabels(workspaceId, setLabels),
          subscribeWorkspaceCycles(workspaceId, setCycles),
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || auth.currentUser?.uid !== userId) return;
        setIssuesError(error instanceof Error ? error.message : 'No se pudo comprobar el acceso al workspace. Recarga la página para reintentar.');
      });

    return () => {
      controller.abort();
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [workspaceId, userId, setMembers, setTeams, setIssues, setIssuesError, resetIssuesSubscription, setProjects, setLabels, setCycles]);

  if (loading) {
    return (
      <div className="min-h-screen bg-base flex flex-col items-center justify-center gap-3 text-accent">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium text-secondary">Cargando sesión...</span>
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
