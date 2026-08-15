'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/stores/appStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAuth } from '@/hooks/useAuth';
import { Project, ProjectStatus } from '@/types';
import { AlertCircle } from 'lucide-react';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectToEdit?: Project | null;
}

const PRESET_COLORS = [
  '#5E6AD2', // Linear Indigo
  '#F09436', // Amber
  '#F75555', // Red
  '#10B981', // Emerald
  '#5E94E4', // Blue
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#64748B', // Slate
];

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  projectToEdit,
}) => {
  const { user } = useAuth();
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const activeTeam = useAppStore((s) => s.activeTeam);
  const members = useAppStore((s) => s.members);
  const addProject = useProjectStore((s) => s.addProject);
  const updateProject = useProjectStore((s) => s.updateProject);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('in_progress');
  const [color, setColor] = useState('#5E6AD2');
  const [leadId, setLeadId] = useState<string>('');
  const [targetDate, setTargetDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    if (projectToEdit) {
      setName(projectToEdit.name || '');
      setDescription(projectToEdit.description || '');
      setStatus(projectToEdit.status || 'in_progress');
      setColor(projectToEdit.color || '#5E6AD2');
      setLeadId(projectToEdit.leadId || '');
      setTargetDate(projectToEdit.targetDate ? projectToEdit.targetDate.split('T')[0] : '');
    } else {
      setName('');
      setDescription('');
      setStatus('in_progress');
      setColor('#5E6AD2');
      setLeadId('');
      setTargetDate('');
    }
    setNameError(false);
  }, [projectToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setNameError(true);
      return;
    }

    setNameError(false);
    setLoading(true);

    try {
      if (projectToEdit) {
        await updateProject(projectToEdit.id, {
          name: name.trim(),
          description: description.trim(),
          status,
          color,
          leadId: leadId || undefined,
          targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
        });
      } else {
        if (!activeWorkspace || !activeTeam) return;
        await addProject({
          workspaceId: activeWorkspace.id,
          teamId: activeTeam.id,
          name: name.trim(),
          description: description.trim(),
          status,
          color,
          leadId: leadId || user?.uid || undefined,
          targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
        });
      }

      onClose();
    } catch (err) {
      console.error('Error saving project:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={projectToEdit ? 'Editar Proyecto' : 'Crear Nuevo Proyecto'}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Name */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[#8A8F98]">
            Nombre del proyecto <span className="text-[#F75555]">*</span>
          </label>
          <Input
            placeholder="e.g. Rediseño App Móvil, API v2, Onboarding SaaS"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value.trim()) setNameError(false);
            }}
            autoFocus
            className={nameError ? 'border-[#F75555] focus:border-[#F75555]' : ''}
          />
          {nameError && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#F75555] font-medium mt-0.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>El nombre del proyecto es obligatorio.</span>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[#8A8F98]">Descripción</label>
          <textarea
            placeholder="Resumen del objetivo, entregables y alcance..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full bg-[#0F1012] border border-[#26292F] focus:border-[#5E6AD2] rounded-md p-2.5 text-xs text-[#F7F8F8] placeholder-[#5B616E] outline-none resize-none font-mono"
          />
        </div>

        {/* Properties Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Status */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#8A8F98]">Estado</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className="bg-[#16171A] border border-[#26292F] text-[#F7F8F8] text-xs rounded-md p-2 outline-none cursor-pointer"
            >
              <option value="planned">Planificado</option>
              <option value="in_progress">En Progreso</option>
              <option value="paused">Pausado</option>
              <option value="completed">Completado</option>
              <option value="canceled">Cancelado</option>
            </select>
          </div>

          {/* Lead */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#8A8F98]">Líder del proyecto</label>
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="bg-[#16171A] border border-[#26292F] text-[#F7F8F8] text-xs rounded-md p-2 outline-none cursor-pointer truncate"
            >
              <option value="">Sin asignar</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Target Date (Optional) */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[#8A8F98]">
            Fecha objetivo <span className="text-[10px] text-[#5B616E] font-normal">(Opcional)</span>
          </label>
          <Input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="text-xs"
          />
        </div>

        {/* Color Palette */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#8A8F98]">Color distintivo</label>
          <div className="flex items-center gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full transition-transform ${
                  color === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#0F1012]' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-[#1C1E22] mt-2">
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" type="submit" disabled={loading}>
            {loading ? 'Guardando...' : projectToEdit ? 'Guardar Cambios' : 'Crear Proyecto'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
