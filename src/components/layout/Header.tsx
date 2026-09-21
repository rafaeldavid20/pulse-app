'use client';

import React from 'react';
import { LayoutList, LayoutGrid, GanttChartSquare, CalendarDays, Plus, Search, Rows3, Zap } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useViewPersistence } from '@/hooks/useViewPersistence';
import { useListPreferences } from '@/hooks/useListPreferences';
import { Button } from '@/components/ui/Button';
import { FilterBar } from './FilterBar';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showViewToggle?: boolean;
  /** El botón "Board" no aplica a páginas sin tablero (p.ej. Épicas). Default `true`. */
  showBoardOption?: boolean;
  /** Vista Timeline (E6): solo la entienden Issues y Épicas, así que es opt-in. Default `false`. */
  showTimelineOption?: boolean;
  /** Vista Calendar (E7): solo la entiende Issues, así que es opt-in. Default `false`. */
  showCalendarOption?: boolean;
  /** Fila de filtros (status/priority/assignee/label/project/epic + agrupar/ordenar) bajo el header. */
  showFilterBar?: boolean;
  /** Campo "Filtrar...": solo tiene sentido en pantallas con una lista de issues a la que aplicarlo. Default `true`. */
  showSearch?: boolean;
  /** Botón "+ Nuevo" (crea un issue): solo tiene sentido en pantallas de issues. Default `true`. */
  showCreateButton?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showViewToggle = true,
  showBoardOption = true,
  showTimelineOption = false,
  showCalendarOption = false,
  showFilterBar = false,
  showSearch = true,
  showCreateButton = true,
}) => {
  const activeView = useAppStore((s) => s.activeView);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const boardGroupBy = useAppStore((s) => s.boardGroupBy);
  const setBoardGroupBy = useAppStore((s) => s.setBoardGroupBy);
  const setCreateMenuOpen = useAppStore((s) => s.setCreateMenuOpen);
  const filterState = useAppStore((s) => s.filterState);
  const setFilterState = useAppStore((s) => s.setFilterState);

  useViewPersistence(showFilterBar);
  useListPreferences();

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
        {showSearch && (
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
        )}

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
            {showBoardOption && (
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
            )}
            {showTimelineOption && (
              <button
                onClick={() => setActiveView('timeline')}
                className={`p-1.5 rounded text-xs flex items-center gap-1.5 transition-colors ${
                  activeView === 'timeline'
                    ? 'bg-hover text-primary'
                    : 'text-secondary hover:text-primary'
                }`}
                title="Vista Timeline (épicas x fechas)"
              >
                <GanttChartSquare className="w-3.5 h-3.5" />
                <span className="hidden md:inline font-medium">Timeline</span>
              </button>
            )}
            {showCalendarOption && (
              <button
                onClick={() => setActiveView('calendar')}
                className={`p-1.5 rounded text-xs flex items-center gap-1.5 transition-colors ${
                  activeView === 'calendar'
                    ? 'bg-hover text-primary'
                    : 'text-secondary hover:text-primary'
                }`}
                title="Vista Calendar (issues x dueDate)"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span className="hidden md:inline font-medium">Calendar</span>
              </button>
            )}
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
        {showCreateButton && (
          <Button
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setCreateMenuOpen(true)}
          >
            <span className="hidden sm:inline">+ Nuevo</span>
            <span className="sm:hidden">+</span>
          </Button>
        )}
      </div>
    </header>

    {showFilterBar && <FilterBar />}
    </>
  );
};
