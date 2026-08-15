'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Project } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { useIssueStore } from '@/stores/issueStore';
import { formatDate, cn } from '@/lib/utils';
import { Calendar, CheckCircle2, Edit3 } from 'lucide-react';
import { ProjectModal } from './ProjectModal';

interface ProjectCardProps {
  project: Project;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  const issues = useIssueStore((s) => s.issues);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Calculate REAL task counts for this project
  const projectIssues = issues.filter((i) => i.projectId === project.id);
  const totalCount = projectIssues.length;
  const completedCount = projectIssues.filter((i) => i.status === 'done').length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <>
      <div className="group flex flex-col justify-between p-5 bg-[#0F1012] hover:bg-[#16171A] border border-[#26292F] hover:border-[#32363F] rounded-xl transition-all shadow-sm relative overflow-hidden">
        {/* Accent Color Strip */}
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: project.color || '#5E6AD2' }}
        />

        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/team/${project.teamId || 'eng'}/projects/${project.id}`}
              className="text-base font-semibold text-[#F7F8F8] group-hover:text-[#5E6AD2] transition-colors truncate hover:underline"
            >
              {project.name}
            </Link>

            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant="subtle"
                className={cn(
                  'capitalize text-xs font-medium',
                  project.status === 'in_progress' && 'bg-[#5E6AD2]/15 text-[#707CE6]',
                  project.status === 'completed' && 'bg-[#4ADE80]/15 text-[#4ADE80]',
                  project.status === 'planned' && 'bg-[#8A8F98]/15 text-[#8A8F98]'
                )}
              >
                {project.status.replace('_', ' ')}
              </Badge>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsEditOpen(true);
                }}
                className="p-1 text-[#5B616E] hover:text-[#F7F8F8] hover:bg-[#26292F] rounded-md transition-colors"
                title="Editar proyecto"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <p className="text-xs text-[#8A8F98] line-clamp-2 leading-relaxed min-h-[32px]">
            {project.description || 'Sin descripción'}
          </p>
        </div>

        {/* Real Progress Bar */}
        <div className="flex flex-col gap-1.5 mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#5B616E] font-medium">Progreso</span>
            <span className="text-[#F7F8F8] font-mono font-medium">{percent}%</span>
          </div>
          <div className="w-full bg-[#1E2024] h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-300 rounded-full"
              style={{
                width: `${percent}%`,
                backgroundColor: project.color || '#5E6AD2',
              }}
            />
          </div>
        </div>

        {/* Footer Info */}
        <div className="flex items-center justify-between pt-3 border-t border-[#1C1E22] text-xs">
          <div className="flex items-center gap-1.5 text-[#5B616E]">
            <Calendar className="w-3.5 h-3.5" />
            <span>{project.targetDate ? formatDate(project.targetDate) : 'Sin fecha'}</span>
          </div>

          <div className="flex items-center gap-1.5 text-[#8A8F98]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#4ADE80]" />
            <span>
              {completedCount}/{totalCount} tasks
            </span>
          </div>
        </div>
      </div>

      <ProjectModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        projectToEdit={project}
      />
    </>
  );
};
