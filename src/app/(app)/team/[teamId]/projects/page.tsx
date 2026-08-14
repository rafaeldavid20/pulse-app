'use client';

import React from 'react';
import { Header } from '@/components/layout/Header';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { useProjectStore } from '@/stores/projectStore';
import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';

export default function TeamProjectsPage() {
  const projects = useProjectStore((s) => s.projects);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <Header
        title="Proyectos de Engineering"
        subtitle={`${projects.length} iniciativas activas`}
        showViewToggle={false}
      />

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </div>
  );
}
