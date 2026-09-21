'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { NotificationPreferencesSection } from '@/components/settings/NotificationPreferencesSection';

export default function AccountSettingsPage() {
  const { user } = useAuth();

  return (
    <>
      <div className="flex flex-col gap-4 p-5 bg-surface border border-default rounded-xl">
        <h3 className="text-base font-semibold text-primary">Mi Perfil</h3>

        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-xs font-semibold text-secondary">Nombre</span>
          <span className="text-sm text-primary truncate">{user?.displayName || 'Rafael Rodriguez'}</span>
        </div>

        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-xs font-semibold text-secondary">Email</span>
          <span className="text-sm text-secondary truncate">
            {user?.email || 'rafaeldavidrodriguez.93@gmail.com'}
          </span>
        </div>
      </div>

      <NotificationPreferencesSection />
    </>
  );
}
