'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/stores/projectStore';
import { hasSalesforceProject } from '@/lib/projectKind';

const SETTINGS_TABS = [
  { href: '/settings/workspace', label: 'Workspace' },
  { href: '/settings/cuenta', label: 'Mi cuenta' },
  { href: '/settings/integraciones', label: 'Integraciones' },
  { href: '/settings/agentes', label: 'Agentes' },
  { href: '/settings/salesforce', label: 'Salesforce', salesforceOnly: true },
] as const;

export function SettingsTabs() {
  const pathname = usePathname();
  // La pestaña de Salesforce sólo existe si algún proyecto del workspace lo es
  // (TES-270). Es para no mostrar una superficie que no aplica, no un permiso.
  const showSalesforce = useProjectStore((s) => hasSalesforceProject(s.projects));
  const tabs = SETTINGS_TABS.filter((tab) => !('salesforceOnly' in tab) || showSalesforce);

  return (
    <nav
      aria-label="Secciones de configuración"
      className="flex items-center gap-1 px-4 sm:px-6 border-b border-subtle overflow-x-auto shrink-0"
    >
      {tabs.map((tab) => {
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
