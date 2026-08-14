'use client';

import React, { useEffect } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  Inbox,
  UserCheck,
  Layers,
  FolderKanban,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';
import { StatusBadge } from '@/components/issues/StatusBadge';
import { PriorityBadge } from '@/components/issues/PriorityBadge';

export const CommandPalette: React.FC = () => {
  const router = useRouter();
  const isCmdKOpen = useAppStore((s) => s.isCmdKOpen);
  const setCmdKOpen = useAppStore((s) => s.setCmdKOpen);
  const setCreateIssueOpen = useAppStore((s) => s.setCreateIssueOpen);

  const issues = useIssueStore((s) => s.issues);
  const setPeekIssueId = useIssueStore((s) => s.setPeekIssueId);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdKOpen(!isCmdKOpen);
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [isCmdKOpen, setCmdKOpen]);

  if (!isCmdKOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-black/70 backdrop-blur-sm animate-fade-in-scale"
      onClick={() => setCmdKOpen(false)}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl">
        <Command label="Command Menu" className="w-full bg-[#0F1012] border border-[#26292F] rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center px-4 border-b border-[#1C1E22]">
            <Search className="w-4 h-4 text-[#5B616E] shrink-0 mr-2" />
            <Command.Input
              placeholder="Escribe un comando o busca un issue..."
              autoFocus
            />
          </div>

          <Command.List className="max-h-96 overflow-y-auto p-2">
            <Command.Empty className="p-4 text-center text-xs text-[#5B616E]">
              No se encontraron resultados.
            </Command.Empty>

            {/* Quick Actions Group */}
            <Command.Group heading="Acciones rápidas">
              <Command.Item
                onSelect={() => {
                  setCmdKOpen(false);
                  setCreateIssueOpen(true);
                }}
              >
                <Plus className="w-4 h-4 text-[#5E6AD2]" />
                <span>Crear nuevo issue...</span>
                <kbd className="ml-auto font-mono text-[10px] text-[#5B616E] bg-[#1E2024] px-1 rounded">
                  C
                </kbd>
              </Command.Item>
            </Command.Group>

            {/* Navigation Group */}
            <Command.Group heading="Navegación">
              <Command.Item
                onSelect={() => {
                  setCmdKOpen(false);
                  router.push('/inbox');
                }}
              >
                <Inbox className="w-4 h-4 text-[#8A8F98]" />
                <span>Ir a Inbox</span>
                <kbd className="ml-auto font-mono text-[10px] text-[#5B616E]">
                  G I
                </kbd>
              </Command.Item>

              <Command.Item
                onSelect={() => {
                  setCmdKOpen(false);
                  router.push('/my-issues');
                }}
              >
                <UserCheck className="w-4 h-4 text-[#8A8F98]" />
                <span>Ir a Mis Issues</span>
                <kbd className="ml-auto font-mono text-[10px] text-[#5B616E]">
                  G M
                </kbd>
              </Command.Item>

              <Command.Item
                onSelect={() => {
                  setCmdKOpen(false);
                  router.push('/team/eng/issues');
                }}
              >
                <Layers className="w-4 h-4 text-[#8A8F98]" />
                <span>Ir a Engineering Issues</span>
                <kbd className="ml-auto font-mono text-[10px] text-[#5B616E]">
                  G B
                </kbd>
              </Command.Item>

              <Command.Item
                onSelect={() => {
                  setCmdKOpen(false);
                  router.push('/team/eng/projects');
                }}
              >
                <FolderKanban className="w-4 h-4 text-[#8A8F98]" />
                <span>Ir a Proyectos</span>
                <kbd className="ml-auto font-mono text-[10px] text-[#5B616E]">
                  G P
                </kbd>
              </Command.Item>
            </Command.Group>

            {/* Issues Group */}
            <Command.Group heading="Issues recientes">
              {issues.map((issue) => (
                <Command.Item
                  key={issue.id}
                  onSelect={() => {
                    setCmdKOpen(false);
                    setPeekIssueId(issue.id);
                  }}
                >
                  <span className="font-mono text-xs text-[#5B616E] shrink-0">
                    {issue.identifier}
                  </span>
                  <StatusBadge status={issue.status} />
                  <span className="truncate text-xs font-normal text-[#F7F8F8]">
                    {issue.title}
                  </span>
                  <PriorityBadge priority={issue.priority} className="ml-auto shrink-0" />
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
};
