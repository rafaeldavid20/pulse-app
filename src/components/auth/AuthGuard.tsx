'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/firebase';
import { waitForWorkspaceAccess, waitForWorkspaceAccessForAll } from '@/lib/workspace-access';
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
  const setWorkspaceUser = useAppStore((s) => s.setWorkspaceUser);
  const workspaceUserId = useAppStore((s) => s.workspaceUserId);
  const workspacesLoaded = useAppStore((s) => s.workspacesLoaded);
  const workspaceDataScope = useAppStore((s) => s.workspaceDataScope);
  const setWorkspaceDataScope = useAppStore((s) => s.setWorkspaceDataScope);
  const setMembers = useAppStore((s) => s.setMembers);
  const setTeams = useAppStore((s) => s.setTeams);
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const activeTeam = useAppStore((s) => s.activeTeam);
  const userWorkspaces = useAppStore((s) => s.userWorkspaces);

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
  const userId = user?.uid;
  const userEmail = user?.email;
  useEffect(() => {
    if (loading) return;
    setWorkspaceUser(userId ?? null);
    if (!userId) return;
    let alive = true;
    const unsubscribe = subscribeUserWorkspaces(userId, userEmail ?? '', (workspaces) => {
      if (alive) setUserWorkspaces(workspaces, userId);
    });
    return () => { alive = false; unsubscribe(); };
  }, [loading, userId, userEmail, setWorkspaceUser, setUserWorkspaces]);

  // 3. Subscribe to Unread Notifications (badge de contador en sidebar / tab bar)
  //
  // Por `userId`, no por workspace: el inbox es una vista del usuario a través
  // de todos sus workspaces, igual que `subscribeUserWorkspaces`.
  useEffect(() => {
    if (!user) {
      setUnreadNotifications([]);
      return;
    }
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || firebaseUser.uid !== user.uid) return;
    const controller = new AbortController();
    const workspaceIds = userWorkspaces.map((workspace) => workspace.id);
    const unsubscribers: Array<() => void> = [];
    let retryAttempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let opening = false;
    let subscribed = false;
    const open = () => {
      if (opening || subscribed || controller.signal.aborted) return;
      if (retryTimer) clearTimeout(retryTimer);
      opening = true;
      void waitForWorkspaceAccessForAll(firebaseUser, workspaceIds, controller.signal)
        .then(() => {
          if (controller.signal.aborted || auth.currentUser?.uid !== user.uid) return;
          subscribed = true;
          unsubscribers.push(subscribeUserNotifications(user.uid, workspaceIds, setUnreadNotifications, (error) => {
            if (controller.signal.aborted) return;
            console.error('subscribeUserNotifications', error);
            setUnreadNotifications([]);
            unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
            subscribed = false;
            if (error.code !== 'permission-denied') return;
            const delay = [1000, 2000, 4000, 8000][retryAttempt++];
            if (delay !== undefined) retryTimer = setTimeout(open, delay);
          }));
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          console.error('Unable to confirm notification workspace access', error);
          setUnreadNotifications([]);
          const delay = [1000, 2000, 4000, 8000][retryAttempt++];
          if (delay !== undefined) retryTimer = setTimeout(open, delay);
        })
        .finally(() => { opening = false; });
    };
    open();
    window.addEventListener('online', open);
    window.addEventListener('focus', open);
    return () => {
      controller.abort();
      window.removeEventListener('online', open);
      window.removeEventListener('focus', open);
      if (retryTimer) clearTimeout(retryTimer);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [user, userWorkspaces, setUnreadNotifications]);

  // 4. Subscribe to Active Workspace Data (Members, Teams, Issues, Projects, Labels)
  const workspaceId = activeWorkspace?.id;
  const teamId = activeTeam?.id;
  const dataScope = userId && workspaceUserId === userId && workspacesLoaded
    ? JSON.stringify([userId, workspaceId ?? null, teamId ?? null]) : null;
  useEffect(() => {
    resetIssuesSubscription();
    useProjectStore.getState().resetProjects();
    setMembers([]);
    setTeams([]);
    setLabels([]);
    setCycles([]);
    useIssueStore.getState().clearSelection();
    useIssueStore.getState().setPeekIssueId(null);
    useIssueStore.getState().setSelectedIssueId(null);
    useIssueStore.getState().setDefaultProjectId(null);
    setWorkspaceDataScope(dataScope);
    if (!dataScope || !workspaceId || !userId) return;

    const controller = new AbortController();
    const unsubscribers: Array<() => void> = [];
    let retryAttempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || firebaseUser.uid !== userId) return;

    // Membership documents arrive before the backend updates custom claims.
    // Starting a listener too early terminates it with permission-denied;
    // refreshing the token afterwards does not restart that listener.
    let starting = false;
    let subscribed = false;
    const handleListenerError = (error: { code?: string }) => {
      if (controller.signal.aborted || error.code !== 'permission-denied') return;
      console.error('Workspace subscription permission denied; refreshing access and reopening listeners.', error);
      setIssues([]);
      setProjects([]);
      setMembers([]);
      setTeams([]);
      setLabels([]);
      setCycles([]);
      setIssuesError('Esperando la sincronización de permisos del workspace…');
      unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
      subscribed = false;
      const delays = [1000, 2000, 4000, 8000];
      const delay = delays[retryAttempt++];
      if (delay === undefined) {
        setIssuesError('No se pudo confirmar tu acceso al workspace. Comprueba tu conexión o vuelve a intentarlo al cambiar de workspace.');
        return;
      }
      retryTimer = setTimeout(start, delay);
    };
    const clearOnError = (clear: () => void) => (error: { code?: string }) => {
      if (controller.signal.aborted) return;
      clear();
      handleListenerError(error);
    };
    const start = () => {
      if (starting || subscribed || controller.signal.aborted) return;
      starting = true;
      void waitForWorkspaceAccess(firebaseUser, workspaceId, controller.signal)
      .then(() => {
        if (controller.signal.aborted || auth.currentUser?.uid !== userId) return;
        subscribed = true;
        unsubscribers.push(
          subscribeWorkspaceMembers(workspaceId, setMembers, clearOnError(() => setMembers([]))),
          subscribeWorkspaceTeams(workspaceId, setTeams, clearOnError(() => setTeams([]))),
          ...(teamId ? [subscribeWorkspaceIssues(teamId, setIssues, (error) => {
            if (controller.signal.aborted) return;
            console.error('subscribeWorkspaceIssues', error);
            setIssues([]);
            setIssuesError(describeSubscriptionError(error));
            handleListenerError(error);
          })] : []),
          subscribeWorkspaceProjects(workspaceId, setProjects, clearOnError(() => setProjects([]))),
          subscribeWorkspaceLabels(workspaceId, setLabels, clearOnError(() => setLabels([]))),
          subscribeWorkspaceCycles(workspaceId, setCycles, clearOnError(() => setCycles([]))),
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || auth.currentUser?.uid !== userId) return;
        setIssuesError(error instanceof Error ? error.message : 'No se pudo comprobar el acceso al workspace.');
      }).finally(() => { starting = false; });
    };
    start();
    window.addEventListener('online', start);
    window.addEventListener('focus', start);

    return () => {
      controller.abort();
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener('online', start);
      window.removeEventListener('focus', start);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [dataScope, workspaceId, teamId, userId, setWorkspaceDataScope, setMembers, setTeams, setIssues, setIssuesError, resetIssuesSubscription, setProjects, setLabels, setCycles]);

  if (loading || (user && (!dataScope || workspaceDataScope !== dataScope))) {
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
  if (!user) return null;

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
