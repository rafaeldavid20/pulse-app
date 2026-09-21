'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { SettingsTabs } from '@/components/settings/SettingsTabs';
import { cn } from '@/lib/utils';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Agentes es la única sub-pestaña con contenido denso (filas de config por
  // agente, grillas de propiedades): el resto son formularios cortos que se
  // ven mejor angostos. Ancho por ruta, no un máximo único para todo Settings.
  const isAgentsTab = pathname?.startsWith('/settings/agentes');

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <Header
        title="Configuración del Workspace"
        showViewToggle={false}
        showSearch={false}
        showCreateButton={false}
      />
      <SettingsTabs />
      <div
        className={cn(
          'flex-1 p-4 sm:p-6 overflow-y-auto w-full flex flex-col gap-8',
          isAgentsTab ? 'max-w-4xl' : 'max-w-2xl'
        )}
      >
        {children}
      </div>
    </div>
  );
}
