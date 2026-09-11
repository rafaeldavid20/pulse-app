'use client';

import React, { useState } from 'react';
import { ChevronDown, Plus, UserPlus, Check, Building2 } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { cn } from '@/lib/utils';
import { CreateWorkspaceModal } from './CreateWorkspaceModal';

export const WorkspaceSelector: React.FC = () => {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const userWorkspaces = useAppStore((s) => s.userWorkspaces);
  const setActiveWorkspace = useAppStore((s) => s.setActiveWorkspace);
  const setInviteMemberOpen = useAppStore((s) => s.setInviteMemberOpen);

  const [isOpen, setIsOpen] = useState(false);
  const [isCreateWsOpen, setIsCreateWsOpen] = useState(false);

  return (
    <div className="relative w-full">
      {/* Workspace Header Button */}
      <div className="flex items-center justify-between p-3 border-b border-subtle select-none">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2.5 min-w-0 hover:bg-elevated p-1 -ml-1 rounded-md transition-colors text-left"
        >
          <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
            🫀
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-semibold text-sm text-primary tracking-tight truncate max-w-[110px]">
              {activeWorkspace?.name || 'Pulse'}
            </span>
            <ChevronDown className={cn('w-3.5 h-3.5 text-tertiary transition-transform', isOpen && 'rotate-180')} />
          </div>
        </button>

        <button
          onClick={() => setInviteMemberOpen(true)}
          className="p-1 text-secondary hover:text-accent hover:bg-accent/15 rounded-md transition-colors flex items-center gap-1 text-xs"
          title="Invitar miembros a este workspace"
        >
          <UserPlus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-12 left-2 right-2 z-50 bg-surface border border-default rounded-xl p-2 shadow-2xl flex flex-col gap-1 animate-fade-in-scale">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[10px] font-semibold text-tertiary uppercase tracking-wider">
              Tus Workspaces ({userWorkspaces.length})
            </span>
          </div>

          <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5">
            {userWorkspaces.map((ws) => {
              const isSelected = activeWorkspace?.id === ws.id;
              return (
                <button
                  key={ws.id}
                  onClick={() => {
                    setActiveWorkspace(ws);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'flex items-center justify-between px-2.5 py-2 rounded-md text-xs transition-colors text-left',
                    isSelected ? 'bg-accent/15 text-primary' : 'hover:bg-hover text-secondary'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Building2 className="w-4 h-4 text-accent shrink-0" />
                    <span className="font-medium truncate">{ws.name}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
                </button>
              );
            })}
          </div>

          <hr className="border-subtle my-1" />

          {/* Action Buttons */}
          <button
            onClick={() => {
              setIsOpen(false);
              setIsCreateWsOpen(true);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-accent hover:bg-accent/15 transition-colors font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Crear nuevo workspace</span>
          </button>

          <button
            onClick={() => {
              setIsOpen(false);
              setInviteMemberOpen(true);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-secondary hover:text-primary hover:bg-hover transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Invitar miembros a este workspace</span>
          </button>
        </div>
      )}

      {/* Create Workspace Modal */}
      <CreateWorkspaceModal isOpen={isCreateWsOpen} onClose={() => setIsCreateWsOpen(false)} />
    </div>
  );
};
