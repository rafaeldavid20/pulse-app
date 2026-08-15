'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { useAppStore } from '@/stores/appStore';
import { Layers, FolderKanban, Building2, UserPlus } from 'lucide-react';

interface CreateMenuModalProps {
  isProjectModalOpen?: boolean;
  onOpenProjectModal?: () => void;
}

export const CreateMenuModal: React.FC<CreateMenuModalProps> = ({ onOpenProjectModal }) => {
  const isCreateMenuOpen = useAppStore((s) => s.isCreateMenuOpen);
  const setCreateMenuOpen = useAppStore((s) => s.setCreateMenuOpen);
  const setCreateIssueOpen = useAppStore((s) => s.setCreateIssueOpen);
  const setCreateWorkspaceOpen = useAppStore((s) => s.setCreateWorkspaceOpen);
  const setInviteMemberOpen = useAppStore((s) => s.setInviteMemberOpen);

  if (!isCreateMenuOpen) return null;

  const handleSelect = (action: () => void) => {
    setCreateMenuOpen(false);
    action();
  };

  const options = [
    {
      title: 'Nuevo Issue',
      description: 'Crea un nuevo issue o tarea en tu equipo',
      icon: Layers,
      color: 'text-[#5E6AD2] bg-[#5E6AD2]/15 border-[#5E6AD2]/30',
      action: () => setCreateIssueOpen(true),
    },
    {
      title: 'Nuevo Proyecto',
      description: 'Crea una iniciativa o proyecto con fecha objetivo',
      icon: FolderKanban,
      color: 'text-[#F09436] bg-[#F09436]/15 border-[#F09436]/30',
      action: () => {
        if (onOpenProjectModal) onOpenProjectModal();
      },
    },
    {
      title: 'Nuevo Workspace',
      description: 'Crea una nueva organización o espacio de trabajo',
      icon: Building2,
      color: 'text-[#10B981] bg-[#10B981]/15 border-[#10B981]/30',
      action: () => setCreateWorkspaceOpen(true),
    },
    {
      title: 'Invitar Miembro',
      description: 'Invita a un colaborador a unirse a este workspace',
      icon: UserPlus,
      color: 'text-[#EC4899] bg-[#EC4899]/15 border-[#EC4899]/30',
      action: () => setInviteMemberOpen(true),
    },
  ];

  return (
    <Modal
      isOpen={isCreateMenuOpen}
      onClose={() => setCreateMenuOpen(false)}
      title="¿Qué deseas crear?"
      maxWidth="md"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
        {options.map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.title}
              onClick={() => handleSelect(opt.action)}
              className="flex items-start gap-3 p-3.5 bg-[#16171A] hover:bg-[#1E2024] border border-[#26292F] hover:border-[#5E6AD2]/50 rounded-xl text-left transition-all group"
            >
              <div className={`p-2.5 rounded-lg border shrink-0 ${opt.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-[#F7F8F8] group-hover:text-[#5E6AD2] transition-colors">
                  {opt.title}
                </span>
                <span className="text-[11px] text-[#8A8F98] leading-tight">
                  {opt.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
};
