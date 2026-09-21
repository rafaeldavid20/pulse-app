'use client';

import React from 'react';
import { Header } from '@/components/layout/Header';
import { SettingsTabs } from '@/components/settings/SettingsTabs';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <Header
        title="Configuración del Workspace"
        showViewToggle={false}
        showSearch={false}
        showCreateButton={false}
      />
      <SettingsTabs />
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto max-w-2xl w-full flex flex-col gap-8">
        {children}
      </div>
    </div>
  );
}
