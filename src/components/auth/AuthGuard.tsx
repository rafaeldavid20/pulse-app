'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
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
} from '@/lib/firestore';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { ShortcutHelp } from '@/components/layout/ShortcutHelp';
import { CreateIssueModal } from '@/components/issues/CreateIssueModal';
import { IssuePeekPanel } from '@/components/issues/IssuePeekPanel';
import { InviteMemberModal } from '@/components/workspace/InviteMemberModal';

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
  const setProjects = useProjectStore((s) => s.setProjects);
  const setLabels = useLabelStore((s) => s.setLabels);

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

    const unsub = subscribeUserWorkspaces(user.uid, user.email, (workspaces) => {
      setUserWorkspaces(workspaces);
    });

    return () => unsub();
  }, [user, setUserWorkspaces]);

  // 3. Subscribe to Active Workspace Data (Members, Teams, Issues, Projects, Labels)
  useEffect(() => {
    if (!activeWorkspace) return;

    const unsubMembers = subscribeWorkspaceMembers(activeWorkspace.id, setMembers);
    const unsubTeams = subscribeWorkspaceTeams(activeWorkspace.id, setTeams);
    const unsubIssues = subscribeWorkspaceIssues(activeWorkspace.id, setIssues);
    const unsubProjects = subscribeWorkspaceProjects(activeWorkspace.id, setProjects);
    const unsubLabels = subscribeWorkspaceLabels(activeWorkspace.id, setLabels);

    return () => {
      unsubMembers();
      unsubTeams();
      unsubIssues();
      unsubProjects();
      unsubLabels();
    };
  }, [activeWorkspace, setMembers, setTeams, setIssues, setProjects, setLabels]);

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
      <CreateIssueModal />
      <IssuePeekPanel />
      <InviteMemberModal />
    </>
  );
};
