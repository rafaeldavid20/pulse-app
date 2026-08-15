'use client';

import React from 'react';
import { Search, Plus } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

export const MobileHeader: React.FC = () => {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const setCmdKOpen = useAppStore((s) => s.setCmdKOpen);
  const setCreateIssueOpen = useAppStore((s) => s.setCreateIssueOpen);

  return (
    <header className="flex md:hidden items-center justify-between px-4 py-2.5 bg-[#08090A] border-b border-[#1C1E22] sticky top-0 z-30 select-none">
      {/* Workspace Brand */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-[#5E6AD2] flex items-center justify-center text-white font-bold text-xs shadow-sm">
          🫀
        </div>
        <span className="font-bold text-sm text-[#F7F8F8] tracking-tight truncate max-w-[140px]">
          {activeWorkspace?.name || 'Pulse'}
        </span>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCmdKOpen(true)}
          className="p-2 text-[#8A8F98] hover:text-[#F7F8F8] bg-[#0F1012] border border-[#26292F] rounded-lg transition-colors"
          title="Buscar..."
        >
          <Search className="w-4 h-4" />
        </button>

        <button
          onClick={() => setCreateIssueOpen(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-[#5E6AD2] hover:bg-[#4E5AC0] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Issue</span>
        </button>
      </div>
    </header>
  );
};
