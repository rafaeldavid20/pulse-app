'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  X,
  Building2,
  Plus,
  UserPlus,
  Settings,
  LogOut,
  HelpCircle,
  Layers,
  Check,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useAuth } from '@/hooks/useAuth';
import { Avatar } from '@/components/ui/Avatar';
import { logoutUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const { user } = useAuth();

  const userWorkspaces = useAppStore((s) => s.userWorkspaces);
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const setActiveWorkspace = useAppStore((s) => s.setActiveWorkspace);

  const teams = useAppStore((s) => s.teams);
  const activeTeam = useAppStore((s) => s.activeTeam);
  const setActiveTeam = useAppStore((s) => s.setActiveTeam);

  const setInviteMemberOpen = useAppStore((s) => s.setInviteMemberOpen);
  const setCreateWorkspaceOpen = useAppStore((s) => s.setCreateWorkspaceOpen);
  const setShortcutHelpOpen = useAppStore((s) => s.setShortcutHelpOpen);

  if (!isOpen) return null;

  const handleLogout = async () => {
    onClose();
    await logoutUser();
    router.push('/login');
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
      {/* Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Slide-Up Drawer */}
      <div className="relative z-10 w-full bg-surface border-t border-default rounded-t-2xl p-5 shadow-2xl flex flex-col gap-5 max-h-[85vh] overflow-y-auto animate-slide-up">
        {/* Top Handle & Close */}
        <div className="flex items-center justify-between pb-2 border-b border-subtle">
          <div className="w-10 h-1 bg-default rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2.5" />
          <div className="flex items-center gap-2.5 pt-2">
            <Avatar name={user?.displayName} src={user?.photoURL} size="sm" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-primary truncate">
                {user?.displayName || 'Usuario'}
              </span>
              <span className="text-[10px] text-tertiary truncate">{user?.email}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-secondary hover:text-white bg-elevated rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Workspaces Section */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-tertiary uppercase tracking-wider">
              Workspaces ({userWorkspaces.length})
            </span>
            <button
              onClick={() => {
                onClose();
                setCreateWorkspaceOpen(true);
              }}
              className="text-xs text-accent font-medium flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo</span>
            </button>
          </div>

          <div className="flex flex-col gap-1">
            {userWorkspaces.map((ws) => {
              const isSelected = activeWorkspace?.id === ws.id;
              return (
                <button
                  key={ws.id}
                  onClick={() => {
                    setActiveWorkspace(ws);
                    onClose();
                  }}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-xl text-xs transition-colors text-left border',
                    isSelected
                      ? 'bg-accent/15 border-accent/30 text-primary'
                      : 'bg-elevated border-default text-secondary'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Building2 className="w-4 h-4 text-accent shrink-0" />
                    <span className="font-semibold truncate">{ws.name}</span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-accent shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Teams Section */}
        {teams.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-tertiary uppercase tracking-wider">
              Equipos en Workspace
            </span>
            <div className="grid grid-cols-2 gap-2">
              {teams.map((team) => {
                const isSelected = activeTeam?.id === team.id;
                return (
                  <button
                    key={team.id}
                    onClick={() => {
                      setActiveTeam(team);
                      onClose();
                      router.push(`/team/${team.id}/issues`);
                    }}
                    className={cn(
                      'flex items-center justify-between p-2.5 rounded-xl text-xs transition-colors border',
                      isSelected
                        ? 'bg-hover border-accent/40 text-primary'
                        : 'bg-elevated border-default text-secondary'
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Layers className="w-3.5 h-3.5 text-accent" />
                      <span className="font-medium truncate">{team.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Links */}
        <div className="flex flex-col gap-1 pt-2 border-t border-subtle">
          <button
            onClick={() => {
              onClose();
              setInviteMemberOpen(true);
            }}
            className="flex items-center gap-3 p-3 rounded-xl text-xs text-secondary hover:text-primary bg-elevated border border-default transition-colors"
          >
            <UserPlus className="w-4 h-4 text-accent" />
            <span>Invitar miembros a este workspace</span>
          </button>

          <Link
            href="/settings"
            onClick={onClose}
            className="flex items-center gap-3 p-3 rounded-xl text-xs text-secondary hover:text-primary bg-elevated border border-default transition-colors"
          >
            <Settings className="w-4 h-4 text-secondary" />
            <span>Configuración de cuenta</span>
          </Link>

          <button
            onClick={() => {
              onClose();
              setShortcutHelpOpen(true);
            }}
            className="flex items-center gap-3 p-3 rounded-xl text-xs text-secondary hover:text-primary bg-elevated border border-default transition-colors"
          >
            <HelpCircle className="w-4 h-4 text-secondary" />
            <span>Shortcuts de teclado</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 p-3 rounded-xl text-xs text-priority-urgent bg-priority-urgent/10 border border-priority-urgent/20 font-medium transition-colors mt-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>
    </div>
  );
};
