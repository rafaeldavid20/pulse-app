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
      <div className="group flex flex-col justify-between p-5 bg-surface hover:bg-elevated border border-default hover:border-strong rounded-xl transition-all shadow-sm relative overflow-hidden">
        {/* Accent Color Strip */}
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: project.color || 'var(--color-accent)' }}
        />

        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/team/${project.teamId || 'eng'}/projects/${project.id}`}
              className="text-base font-semibold text-primary group-hover:text-accent transition-colors truncate hover:underline"
            >
              {project.name}
            </Link>

            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant="subtle"
                className={cn(
                  'capitalize text-xs font-medium',
                  project.status === 'in_progress' && 'bg-accent/15 text-accent-hover',
                  project.status === 'completed' && 'bg-status-done/15 text-status-done',
                  project.status === 'planned' && 'bg-secondary/15 text-secondary'
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
                className="p-1 text-tertiary hover:text-primary hover:bg-default rounded-md transition-colors"
                title="Editar proyecto"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <p className="text-xs text-secondary line-clamp-2 leading-relaxed min-h-[32px]">
            {project.description || 'Sin descripción'}
          </p>
        </div>

        {/* Real Progress Bar */}
        <div className="flex flex-col gap-1.5 mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-tertiary font-medium">Progreso</span>
            <span className="text-primary font-mono font-medium">{percent}%</span>
          </div>
          <div className="w-full bg-hover h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-300 rounded-full"
              style={{
                width: `${percent}%`,
                backgroundColor: project.color || 'var(--color-accent)',
              }}
            />
          </div>
        </div>

        {/* Footer Info */}
        <div className="flex items-center justify-between pt-3 border-t border-subtle text-xs">
          <div className="flex items-center gap-1.5 text-tertiary">
            <Calendar className="w-3.5 h-3.5" />
            <span>{project.targetDate ? formatDate(project.targetDate) : 'Sin fecha'}</span>
          </div>

          <div className="flex items-center gap-1.5 text-secondary">
            <CheckCircle2 className="w-3.5 h-3.5 text-status-done" />
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
