'use client';

import React from 'react';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/stores/appStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function SettingsPage() {
  const { user } = useAuth();
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <Header title="Configuración del Workspace" showViewToggle={false} />

      <div className="flex-1 p-6 overflow-y-auto max-w-2xl flex flex-col gap-8">
        {/* Workspace Info */}
        <div className="flex flex-col gap-4 p-5 bg-[#0F1012] border border-[#26292F] rounded-xl">
          <h3 className="text-base font-semibold text-[#F7F8F8]">General</h3>
          
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#8A8F98]">Nombre del Workspace</label>
            <Input defaultValue={activeWorkspace?.name || 'Pulse Workspace'} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#8A8F98]">URL Slug</label>
            <Input defaultValue={activeWorkspace?.slug || 'pulse'} disabled />
          </div>

          <div className="flex justify-end pt-2">
            <Button size="sm">Guardar Cambios</Button>
          </div>
        </div>

        {/* User Profile */}
        <div className="flex flex-col gap-4 p-5 bg-[#0F1012] border border-[#26292F] rounded-xl">
          <h3 className="text-base font-semibold text-[#F7F8F8]">Mi Perfil</h3>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#8A8F98]">Nombre</label>
            <Input defaultValue={user?.displayName || 'Rafael Rodriguez'} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#8A8F98]">Email</label>
            <Input defaultValue={user?.email || 'rafaeldavidrodriguez.93@gmail.com'} disabled />
          </div>

          <div className="flex justify-end pt-2">
            <Button size="sm">Actualizar Perfil</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
