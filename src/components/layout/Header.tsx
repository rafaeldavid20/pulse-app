'use client';

import React from 'react';
import { LayoutList, LayoutGrid, Plus, Search, Rows3, Zap } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useViewPersistence } from '@/hooks/useViewPersistence';
import { Button } from '@/components/ui/Button';
import { FilterBar } from './FilterBar';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showViewToggle?: boolean;
  /** Fila de filtros (status/priority/assignee/label/project/epic + agrupar/ordenar) bajo el header. */
  showFilterBar?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showViewToggle = true,
  showFilterBar = false,
}) => {
  const activeView = useAppStore((s) => s.activeView);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const boardGroupBy = useAppStore((s) => s.boardGroupBy);
  const setBoardGroupBy = useAppStore((s) => s.setBoardGroupBy);
  const setCreateMenuOpen = useAppStore((s) => s.setCreateMenuOpen);
  const filterState = useAppStore((s) => s.filterState);
  const setFilterState = useAppStore((s) => s.setFilterState);

  useViewPersistence(showFilterBar);

  return (
    <>
    <header className="h-14 border-b border-subtle bg-base px-4 sm:px-6 flex items-center justify-between shrink-0 select-none">
      {/* Left: Title & Subtitle */}
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-base font-semibold text-primary tracking-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <span className="text-xs text-tertiary font-medium hidden sm:inline truncate">
            {subtitle}
          </span>
        )}
      </div>

      {/* Right: Controls & View Toggle */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Search Input */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-tertiary" />
          <input
            type="text"
            placeholder="Filtrar..."
            value={filterState.search}
            onChange={(e) => setFilterState({ search: e.target.value })}
            className="w-28 sm:w-48 bg-surface border border-default focus:border-accent rounded-md pl-8 pr-2.5 py-1 text-xs text-primary placeholder-tertiary outline-none transition-colors"
          />
        </div>

        {/* View Toggle (List vs Board) */}
        {showViewToggle && (
          <div className="flex items-center bg-surface border border-default p-0.5 rounded-md">
            <button
              onClick={() => setActiveView('list')}
              className={`p-1.5 rounded text-xs flex items-center gap-1.5 transition-colors ${
                activeView === 'list'
                  ? 'bg-hover text-primary'
                  : 'text-secondary hover:text-primary'
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
                  ? 'bg-hover text-primary'
                  : 'text-secondary hover:text-primary'
              }`}
              title="Vista Board (Kanban)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden md:inline font-medium">Board</span>
            </button>
          </div>
        )}

        {/* Agrupamiento del board — solo tiene sentido en vista board, así que
            no se muestra ocupando lugar en la lista. */}
        {showViewToggle && activeView === 'board' && (
          <div className="hidden sm:flex items-center bg-surface border border-default p-0.5 rounded-md">
            <button
              onClick={() => setBoardGroupBy('status')}
              className={`p-1.5 rounded text-xs flex items-center gap-1.5 transition-colors ${
                boardGroupBy === 'status'
                  ? 'bg-hover text-primary'
                  : 'text-secondary hover:text-primary'
              }`}
              title="Agrupar por estado"
            >
              <Rows3 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline font-medium">Estado</span>
            </button>
            <button
              onClick={() => setBoardGroupBy('epic')}
              className={`p-1.5 rounded text-xs flex items-center gap-1.5 transition-colors ${
                boardGroupBy === 'epic'
                  ? 'bg-hover text-type-epic'
                  : 'text-secondary hover:text-primary'
              }`}
              title="Agrupar por épica (swimlanes)"
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden lg:inline font-medium">Épica</span>
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

    {showFilterBar && <FilterBar />}
    </>
  );
};
