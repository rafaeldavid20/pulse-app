'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const SETTINGS_TABS = [
  { href: '/settings/workspace', label: 'Workspace' },
  { href: '/settings/cuenta', label: 'Mi cuenta' },
  { href: '/settings/integraciones', label: 'Integraciones' },
  { href: '/settings/agentes', label: 'Agentes' },
] as const;

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones de configuración"
      className="flex items-center gap-1 px-4 sm:px-6 border-b border-subtle overflow-x-auto shrink-0"
    >
      {SETTINGS_TABS.map((tab) => {
        const isActive = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'shrink-0 whitespace-nowrap px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              isActive
                ? 'border-accent text-primary'
                : 'border-transparent text-secondary hover:text-primary'
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
