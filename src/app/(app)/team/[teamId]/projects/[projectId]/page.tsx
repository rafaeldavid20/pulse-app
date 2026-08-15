'use client';

import React, { use } from 'react';
import { Header } from '@/components/layout/Header';
import { IssueList } from '@/components/issues/IssueList';
import { IssueBoard } from '@/components/issues/IssueBoard';
import { useProjectStore } from '@/stores/projectStore';
import { useIssueStore } from '@/stores/issueStore';
import { useAppStore } from '@/stores/appStore';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import { Calendar, ArrowLeft, Plus, FolderKanban } from 'lucide-react';
import Link from 'next/link';

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ teamId: string; projectId: string }>;
}) {
  const resolvedParams = use(params);
  const projects = useProjectStore((s) => s.projects);
  const updateProject = useProjectStore((s) => s.updateProject);
  const issues = useIssueStore((s) => s.issues);
  const activeView = useAppStore((s) => s.activeView);
  const setCreateIssueOpen = useAppStore((s) => s.setCreateIssueOpen);
  const setDefaultProjectId = useIssueStore((s) => s.setDefaultProjectId);
  const members = useAppStore((s) => s.members);

  const project = projects.find((p) => p.id === resolvedParams.projectId);

  if (!project) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#8A8F98] gap-4">
        <FolderKanban className="w-10 h-10 text-[#5E6AD2]" />
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-[#F7F8F8]">Proyecto no encontrado</h2>
          <p className="text-xs text-[#8A8F98]">El proyecto solicitado no existe o fue eliminado.</p>
        </div>
        <Link
          href={`/team/${resolvedParams.teamId}/projects`}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#5E6AD2] text-white text-xs font-semibold rounded-md hover:bg-[#4E5AC0] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver a la lista de proyectos</span>
        </Link>
      </div>
    );
  }

  // Filter issues belonging strictly to this project
  const projectIssues = issues.filter((i) => i.projectId === project.id);
  const completedCount = projectIssues.filter((i) => i.status === 'done').length;
  const totalCount = projectIssues.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const lead = members.find((m) => m.userId === project.leadId);

  const handleCreateIssueInProject = () => {
    setDefaultProjectId(project.id);
    setCreateIssueOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <Header
        title={project.name}
        subtitle={`Proyecto (${percent}% completado)`}
        showViewToggle
      />

      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
        {/* Back Link */}
        <Link
          href={`/team/${resolvedParams.teamId}/projects`}
          className="inline-flex items-center gap-1.5 text-xs text-[#8A8F98] hover:text-[#F7F8F8] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver a la lista de proyectos</span>
        </Link>

        {/* Project Detail Header Card */}
        <div className="flex flex-col gap-5 p-6 bg-[#0F1012] border border-[#26292F] rounded-2xl relative overflow-hidden shadow-xl">
          {/* Top Color Strip */}
          <div
            className="absolute top-0 left-0 right-0 h-1.5"
            style={{ backgroundColor: project.color || '#5E6AD2' }}
          />

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-[#F7F8F8] tracking-tight">
                  {project.name}
                </h1>
                <select
                  value={project.status}
                  onChange={(e) =>
                    updateProject(project.id, { status: e.target.value as any })
                  }
                  className="bg-[#16171A] border border-[#26292F] text-[#F7F8F8] text-xs font-semibold rounded-md px-2.5 py-1 outline-none cursor-pointer capitalize"
                >
                  <option value="planned">Planificado</option>
                  <option value="in_progress">En Progreso</option>
                  <option value="paused">Pausado</option>
                  <option value="completed">Completado</option>
                  <option value="canceled">Cancelado</option>
                </select>
              </div>

              {project.description && (
                <p className="text-sm text-[#8A8F98] leading-relaxed max-w-2xl">
                  {project.description}
                </p>
              )}
            </div>

            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={handleCreateIssueInProject}
            >
              Nuevo Issue en este Proyecto
            </Button>
          </div>

          {/* Progress Bar & Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-[#1C1E22] text-xs">
            {/* Progress */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[#8A8F98]">
                <span>Progreso del Proyecto</span>
                <span className="text-[#F7F8F8] font-mono font-semibold">{percent}%</span>
              </div>
              <div className="w-full bg-[#1E2024] h-2 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-300 rounded-full"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: project.color || '#5E6AD2',
                  }}
                />
              </div>
            </div>

            {/* Target Date */}
            <div className="flex items-center gap-2 text-[#8A8F98]">
              <Calendar className="w-4 h-4 text-[#5E6AD2]" />
              <div>
                <span className="block text-[10px] uppercase text-[#5B616E]">Fecha objetivo</span>
                <span className="text-[#F7F8F8] font-medium">
                  {project.targetDate ? formatDate(project.targetDate) : 'Sin fecha definida'}
                </span>
              </div>
            </div>

            {/* Project Lead */}
            <div className="flex items-center gap-2 text-[#8A8F98]">
              <Avatar name={lead?.displayName} src={lead?.photoURL} size="md" />
              <div>
                <span className="block text-[10px] uppercase text-[#5B616E]">Líder de Proyecto</span>
                <span className="text-[#F7F8F8] font-medium">{lead?.displayName || 'Sin asignar'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Project Issues Section */}
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[#F7F8F8]">
              Issues del Proyecto ({totalCount})
            </h3>
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={handleCreateIssueInProject}
            >
              Crear Issue
            </Button>
          </div>

          {activeView === 'list' ? (
            <IssueList issues={projectIssues} />
          ) : (
            <IssueBoard />
          )}
        </div>
      </div>
    </div>
  );
}
