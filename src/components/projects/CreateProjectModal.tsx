'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/stores/appStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAuth } from '@/hooks/useAuth';
import { ProjectStatus } from '@/types';
import { SWATCH_COLORS, DEFAULT_SWATCH_COLOR } from '@/lib/constants/colors';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const activeTeam = useAppStore((s) => s.activeTeam);
  const members = useAppStore((s) => s.members);
  const addProject = useProjectStore((s) => s.addProject);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('in_progress');
  const [color, setColor] = useState(DEFAULT_SWATCH_COLOR);
  const [leadId, setLeadId] = useState<string>('');
  const [targetDate, setTargetDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !activeWorkspace || !activeTeam) return;

    setLoading(true);
    try {
      await addProject({
        workspaceId: activeWorkspace.id,
        teamId: activeTeam.id,
        name: name.trim(),
        description: description.trim(),
        status,
        color,
        leadId: leadId || user?.uid || undefined,
        targetDate: targetDate || undefined,
      });

      setName('');
      setDescription('');
      setTargetDate('');
      onClose();
    } catch (err) {
      console.error('Error creating project:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Crear nuevo proyecto" maxWidth="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Name */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-secondary">Nombre del proyecto</label>
          <Input
            placeholder="e.g. Rediseño App Móvil, API v2, Onboarding SaaS"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-secondary">Descripción</label>
          <textarea
            placeholder="Resumen del objetivo, entregables y alcance..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full bg-surface border border-default focus:border-accent rounded-md p-2.5 text-xs text-primary placeholder-tertiary outline-none resize-none font-mono"
          />
        </div>

        {/* Properties Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Status */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-secondary">Estado</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className="bg-elevated border border-default text-primary text-xs rounded-md p-2 outline-none cursor-pointer"
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
            <label className="text-xs font-semibold text-secondary">Líder del proyecto</label>
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="bg-elevated border border-default text-primary text-xs rounded-md p-2 outline-none cursor-pointer truncate"
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

        {/* Target Date */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-secondary">Fecha objetivo</label>
          <Input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="text-xs"
          />
        </div>

        {/* Color Palette */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-secondary">Color distintivo</label>
          <div className="flex items-center gap-2">
            {SWATCH_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full transition-transform ${
                  color === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-surface' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-subtle mt-2">
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" type="submit" disabled={!name.trim() || loading}>
            {loading ? 'Creando...' : 'Crear Proyecto'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
