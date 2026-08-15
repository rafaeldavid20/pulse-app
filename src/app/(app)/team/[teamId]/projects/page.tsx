'use client';

import React, { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { useProjectStore } from '@/stores/projectStore';
import { useAppStore } from '@/stores/appStore';
import { Button } from '@/components/ui/Button';
import { Plus, FolderKanban } from 'lucide-react';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';

export default function TeamProjectsPage() {
  const projects = useProjectStore((s) => s.projects);
  const activeTeam = useAppStore((s) => s.activeTeam);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <Header
        title={`Proyectos de ${activeTeam?.name || 'Engineering'}`}
        subtitle={`${projects.length} iniciativas activas`}
        showViewToggle={false}
      />

      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
        {/* Top Header Action Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-[#5E6AD2]" />
            <h2 className="text-base font-semibold text-[#F7F8F8]">
              Iniciativas y Proyectos
            </h2>
          </div>

          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setIsCreateOpen(true)}
          >
            Nuevo Proyecto
          </Button>
        </div>

        {/* Project Grid or Empty State */}
        {projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 bg-[#0F1012] border border-[#26292F] rounded-2xl text-center gap-4 my-8">
            <div className="w-12 h-12 rounded-xl bg-[#5E6AD2]/15 flex items-center justify-center text-[#5E6AD2]">
              <FolderKanban className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-1 max-w-sm">
              <h3 className="text-base font-bold text-[#F7F8F8]">No hay proyectos creados aún</h3>
              <p className="text-xs text-[#8A8F98]">
                Crea tu primer proyecto para agrupar tus issues, hacer seguimiento a la fecha objetivo y medir el porcentaje de avance.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setIsCreateOpen(true)}
              className="mt-2"
            >
              Crear Primer Proyecto
            </Button>
          </div>
        )}
      </div>

      <CreateProjectModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
}
