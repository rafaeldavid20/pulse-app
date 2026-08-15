'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layers, FolderKanban, Inbox, UserCheck, Menu } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { cn } from '@/lib/utils';
import { MobileDrawer } from './MobileDrawer';

export const MobileTabBar: React.FC = () => {
  const pathname = usePathname();
  const activeTeam = useAppStore((s) => s.activeTeam);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const teamId = activeTeam?.id || 'eng';

  const tabs = [
    {
      label: 'Issues',
      icon: Layers,
      href: `/team/${teamId}/issues`,
    },
    {
      label: 'Proyectos',
      icon: FolderKanban,
      href: `/team/${teamId}/projects`,
    },
    {
      label: 'Inbox',
      icon: Inbox,
      href: '/inbox',
    },
    {
      label: 'Mis Issues',
      icon: UserCheck,
      href: '/my-issues',
    },
  ];

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#08090A]/95 backdrop-blur-xl border-t border-[#1C1E22] px-2 py-1.5 flex items-center justify-around select-none">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-xl transition-all min-w-[56px] text-[10px] font-medium',
                isActive
                  ? 'text-[#5E6AD2] bg-[#5E6AD2]/10 scale-105'
                  : 'text-[#8A8F98] hover:text-[#F7F8F8]'
              )}
            >
              <Icon className={cn('w-5 h-5 transition-transform', isActive && 'stroke-[2.5px]')} />
              <span>{tab.label}</span>
            </Link>
          );
        })}

        {/* More / Menu Drawer Trigger */}
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-[#8A8F98] hover:text-[#F7F8F8] transition-all min-w-[56px] text-[10px] font-medium"
        >
          <Menu className="w-5 h-5" />
          <span>Más</span>
        </button>
      </nav>

      {/* Slide-Up Mobile Drawer */}
      <MobileDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </>
  );
};
