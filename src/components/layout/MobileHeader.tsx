'use client';

import React from 'react';
import { Search, Plus } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

export const MobileHeader: React.FC = () => {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const setCmdKOpen = useAppStore((s) => s.setCmdKOpen);
  const setCreateMenuOpen = useAppStore((s) => s.setCreateMenuOpen);

  return (
    <header className="flex md:hidden items-center justify-between px-4 py-2.5 bg-base border-b border-subtle sticky top-0 z-30 select-none">
      {/* Workspace Brand */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center text-white font-bold text-xs shadow-sm">
          🫀
        </div>
        <span className="font-bold text-sm text-primary tracking-tight truncate max-w-[140px]">
          {activeWorkspace?.name || 'Pulse'}
        </span>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCmdKOpen(true)}
          className="p-2 text-secondary hover:text-primary bg-surface border border-default rounded-lg transition-colors"
          title="Buscar..."
        >
          <Search className="w-4 h-4" />
        </button>

        <button
          onClick={() => setCreateMenuOpen(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo</span>
        </button>
      </div>
    </header>
  );
};
