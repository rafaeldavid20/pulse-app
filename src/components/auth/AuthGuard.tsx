'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useKeyboard } from '@/hooks/useKeyboard';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { ShortcutHelp } from '@/components/layout/ShortcutHelp';
import { CreateIssueModal } from '@/components/issues/CreateIssueModal';
import { IssuePeekPanel } from '@/components/issues/IssuePeekPanel';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Initialize global keyboard listener
  useKeyboard();

  useEffect(() => {
    if (loading) return;

    const isAuthPage = pathname === '/login' || pathname === '/signup';

    if (!user && !isAuthPage) {
      router.push('/login');
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08090A] flex items-center justify-center text-[#5E6AD2]">
        <div className="w-8 h-8 border-2 border-[#5E6AD2] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {children}
      <CommandPalette />
      <ShortcutHelp />
      <CreateIssueModal />
      <IssuePeekPanel />
    </>
  );
};
