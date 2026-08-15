'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Inbox,
  UserCheck,
  Layers,
  FolderKanban,
  Settings,
  Search,
  HelpCircle,
  LogOut,
  ChevronUp,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useAuth } from '@/hooks/useAuth';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { logoutUser } from '@/lib/auth';
import { WorkspaceSelector } from '@/components/workspace/WorkspaceSelector';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();

  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const activeTeam = useAppStore((s) => s.activeTeam);
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen);
  const setCmdKOpen = useAppStore((s) => s.setCmdKOpen);
  const setShortcutHelpOpen = useAppStore((s) => s.setShortcutHelpOpen);
  const { user } = useAuth();

  const [isUserMenuOpen, setUserMenuOpen] = useState(false);

  if (!isSidebarOpen) return null;

  const defaultKey = activeWorkspace?.name ? activeWorkspace.name.trim().substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'W') : 'PUL';
  const teamName = activeTeam?.name || activeWorkspace?.name || 'Orden y Progreso';
  const teamKey = activeTeam?.key || defaultKey;
  const teamId = activeTeam?.id || 'eng';

  const navItems = [
    { label: 'Inbox', icon: Inbox, href: '/inbox', shortcut: 'G I' },
    { label: 'Mis Issues', icon: UserCheck, href: '/my-issues', shortcut: 'G M' },
  ];

  const teamNavItems = [
    { label: 'Issues', icon: Layers, href: `/team/${teamId}/issues`, shortcut: 'G B' },
    { label: 'Proyectos', icon: FolderKanban, href: `/team/${teamId}/projects`, shortcut: 'G P' },
    { label: 'Configuración', icon: Settings, href: '/settings', shortcut: '' },
  ];

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logoutUser();
    router.push('/login');
  };

  return (
    <aside className="hidden md:flex w-60 bg-[#08090A] border-r border-[#1C1E22] flex-col justify-between shrink-0 h-screen select-none font-sans relative">
      {/* Top Header & Search */}
      <div className="flex flex-col">
        {/* Real Workspace Selector Dropdown */}
        <WorkspaceSelector />

        {/* Quick Search Button */}
        <div className="px-3 pt-3">
          <button
            onClick={() => setCmdKOpen(true)}
            className="w-full flex items-center justify-between px-3 py-1.5 bg-[#0F1012] hover:bg-[#16171A] border border-[#26292F] rounded-md text-xs text-[#8A8F98] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-[#5B616E]" />
              <span>Buscar...</span>
            </div>
            <kbd className="font-mono text-[10px] text-[#5B616E] bg-[#1E2024] px-1 py-0.2 rounded border border-[#26292F]">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Main Navigation Links */}
        <div className="flex flex-col gap-0.5 px-2 pt-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-[#1E2024] text-[#F7F8F8]'
                    : 'text-[#8A8F98] hover:text-[#F7F8F8] hover:bg-[#16171A]'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-[#8A8F98]" />
                  <span>{item.label}</span>
                </div>
                <span className="font-mono text-[10px] text-[#5B616E]">
                  {item.shortcut}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Team Section */}
        <div className="flex flex-col px-2 pt-6">
          <div className="flex items-center justify-between px-2.5 pb-2 text-[11px] font-semibold text-[#5B616E] uppercase tracking-wider">
            <span className="truncate max-w-[120px]">{teamName}</span>
            <span className="text-[10px] font-mono font-normal text-[#424651] shrink-0">
              {teamKey}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            {teamNavItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-[#1E2024] text-[#F7F8F8]'
                      : 'text-[#8A8F98] hover:text-[#F7F8F8] hover:bg-[#16171A]'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-[#8A8F98]" />
                    <span>{item.label}</span>
                  </div>
                  {item.shortcut && (
                    <span className="font-mono text-[10px] text-[#5B616E]">
                      {item.shortcut}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* User Logout Popup Menu */}
      {isUserMenuOpen && (
        <div className="absolute bottom-16 left-2 right-2 z-50 bg-[#0F1012] border border-[#26292F] rounded-xl p-2 shadow-2xl flex flex-col gap-1 animate-fade-in-scale">
          <div className="px-2 py-1 flex flex-col">
            <span className="text-xs font-semibold text-[#F7F8F8]">
              {user?.displayName || 'Usuario'}
            </span>
            <span className="text-[10px] text-[#5B616E] truncate">{user?.email}</span>
          </div>

          <hr className="border-[#1C1E22] my-1" />

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-[#F75555] hover:bg-[#F75555]/15 transition-colors font-medium"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      )}

      {/* Footer Profile & Keyboard Help */}
      <div className="flex flex-col p-2 border-t border-[#1C1E22] gap-1">
        <button
          onClick={() => setShortcutHelpOpen(true)}
          className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs text-[#8A8F98] hover:text-[#F7F8F8] hover:bg-[#16171A] transition-colors"
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4" />
            <span>Shortcuts teclado</span>
          </div>
          <kbd className="font-mono text-[10px] text-[#5B616E] bg-[#1E2024] px-1 rounded border border-[#26292F]">
            ?
          </kbd>
        </button>

        {/* User Card Trigger */}
        <div
          onClick={() => setUserMenuOpen(!isUserMenuOpen)}
          className="flex items-center justify-between px-2.5 py-2 mt-1 rounded-md bg-[#0F1012] hover:bg-[#16171A] border border-[#1C1E22] cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar name={user?.displayName} src={user?.photoURL} size="sm" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-[#F7F8F8] truncate">
                {user?.displayName || 'Usuario'}
              </span>
              <span className="text-[10px] text-[#5B616E] truncate">
                {user?.email}
              </span>
            </div>
          </div>

          <ChevronUp className={cn('w-3.5 h-3.5 text-[#5B616E] transition-transform', isUserMenuOpen && 'rotate-180')} />
        </div>
      </div>
    </aside>
  );
};
