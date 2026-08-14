import React from 'react';
import Link from 'next/link';
import { Project } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { formatDate, cn } from '@/lib/utils';
import { Calendar, CheckCircle2 } from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  issueCount?: number;
  completedCount?: number;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  issueCount = 8,
  completedCount = 5,
}) => {
  const percent = issueCount > 0 ? Math.round((completedCount / issueCount) * 100) : 0;

  return (
    <Link
      href={`/team/${project.teamId || 'eng'}/projects/${project.id}`}
      className="group flex flex-col justify-between p-5 bg-[#0F1012] hover:bg-[#16171A] border border-[#26292F] hover:border-[#32363F] rounded-xl transition-all shadow-sm cursor-pointer relative overflow-hidden block"
    >
      {/* Accent Color Strip */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: project.color || '#5E6AD2' }}
      />

      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-[#F7F8F8] group-hover:text-[#5E6AD2] transition-colors">
            {project.name}
          </h3>
          <Badge
            variant="subtle"
            className={cn(
              'capitalize text-xs',
              project.status === 'in_progress' && 'bg-[#5E6AD2]/15 text-[#707CE6]',
              project.status === 'completed' && 'bg-[#4ADE80]/15 text-[#4ADE80]'
            )}
          >
            {project.status.replace('_', ' ')}
          </Badge>
        </div>

        <p className="text-xs text-[#8A8F98] line-clamp-2 leading-relaxed">
          {project.description}
        </p>
      </div>

      {/* Progress Bar */}
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
            {completedCount}/{issueCount} tasks
          </span>
        </div>
      </div>
    </Link>
  );
};
