'use client';

import React from 'react';
import { LayoutList, LayoutGrid, Plus, Search } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { Button } from '@/components/ui/Button';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showViewToggle?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showViewToggle = true,
}) => {
  const activeView = useAppStore((s) => s.activeView);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const setCreateMenuOpen = useAppStore((s) => s.setCreateMenuOpen);
  const filterState = useAppStore((s) => s.filterState);
  const setFilterState = useAppStore((s) => s.setFilterState);

  return (
    <header className="h-14 border-b border-[#1C1E22] bg-[#08090A] px-4 sm:px-6 flex items-center justify-between shrink-0 select-none">
      {/* Left: Title & Subtitle */}
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-base font-semibold text-[#F7F8F8] tracking-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <span className="text-xs text-[#5B616E] font-medium hidden sm:inline truncate">
            {subtitle}
          </span>
        )}
      </div>

      {/* Right: Controls & View Toggle */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Search Input */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-[#5B616E]" />
          <input
            type="text"
            placeholder="Filtrar..."
            value={filterState.search}
            onChange={(e) => setFilterState({ search: e.target.value })}
            className="w-28 sm:w-48 bg-[#0F1012] border border-[#26292F] focus:border-[#5E6AD2] rounded-md pl-8 pr-2.5 py-1 text-xs text-[#F7F8F8] placeholder-[#5B616E] outline-none transition-colors"
          />
        </div>

        {/* View Toggle (List vs Board) */}
        {showViewToggle && (
          <div className="flex items-center bg-[#0F1012] border border-[#26292F] p-0.5 rounded-md">
            <button
              onClick={() => setActiveView('list')}
              className={`p-1.5 rounded text-xs flex items-center gap-1.5 transition-colors ${
                activeView === 'list'
                  ? 'bg-[#1E2024] text-[#F7F8F8]'
                  : 'text-[#8A8F98] hover:text-[#F7F8F8]'
              }`}
              title="Vista Lista"
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span className="hidden md:inline font-medium">Lista</span>
            </button>
            <button
              onClick={() => setActiveView('board')}
              className={`p-1.5 rounded text-xs flex items-center gap-1.5 transition-colors ${
                activeView === 'board'
                  ? 'bg-[#1E2024] text-[#F7F8F8]'
                  : 'text-[#8A8F98] hover:text-[#F7F8F8]'
              }`}
              title="Vista Board (Kanban)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden md:inline font-medium">Board</span>
            </button>
          </div>
        )}

        {/* Create Dialog Trigger Button */}
        <Button
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setCreateMenuOpen(true)}
        >
          <span className="hidden sm:inline">+ Nuevo</span>
          <span className="sm:hidden">+</span>
        </Button>
      </div>
    </header>
  );
};
