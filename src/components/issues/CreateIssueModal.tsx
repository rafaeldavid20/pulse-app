'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LabelPicker } from '@/components/labels/LabelPicker';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAuth } from '@/hooks/useAuth';
import { IssueStatus, IssuePriority } from '@/types';
import { AlertCircle } from 'lucide-react';

export const CreateIssueModal: React.FC = () => {
  const { user } = useAuth();
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const activeTeam = useAppStore((s) => s.activeTeam);
  const teams = useAppStore((s) => s.teams);
  const isCreateIssueOpen = useAppStore((s) => s.isCreateIssueOpen);
  const setCreateIssueOpen = useAppStore((s) => s.setCreateIssueOpen);
  const members = useAppStore((s) => s.members);
  const projects = useProjectStore((s) => s.projects);
  const addIssue = useIssueStore((s) => s.addIssue);
  const setPeekIssueId = useIssueStore((s) => s.setPeekIssueId);
  const defaultProjectId = useIssueStore((s) => s.defaultProjectId);
  const setDefaultProjectId = useIssueStore((s) => s.setDefaultProjectId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<IssueStatus>('todo');
  const [priority, setPriority] = useState<IssuePriority>(3);
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>(['feature']);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sync defaultProjectId when modal opens
  useEffect(() => {
    if (isCreateIssueOpen && defaultProjectId) {
      setProjectId(defaultProjectId);
    }
  }, [isCreateIssueOpen, defaultProjectId]);

  const handleClose = () => {
    setErrorMsg('');
    setCreateIssueOpen(false);
    setDefaultProjectId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;

    const wsId = activeWorkspace?.id;
    const currentTeam = activeTeam || teams[0];
    const teamId = currentTeam?.id;
    const teamKey = currentTeam?.key || 'ENG';

    if (!wsId || !teamId) {
      setErrorMsg('No hay un workspace o equipo activo cargado.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const created = await addIssue({
        workspaceId: wsId,
        teamId: teamId,
        teamKey: teamKey,
        creatorId: user.uid,
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        projectId: projectId || undefined,
        assigneeId: assigneeId || undefined,
        labelIds: selectedLabels.length > 0 ? selectedLabels : ['feature'],
      });

      // Reset fields & close modal
      setTitle('');
      setDescription('');
      setSelectedLabels(['feature']);
      handleClose();
      if (created?.id) setPeekIssueId(created.id);
    } catch (err: any) {
      console.error('Error creating issue:', err);
      setErrorMsg(err?.message || 'Error al guardar el issue en Cloud Firestore.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isCreateIssueOpen}
      onClose={handleClose}
      title={`Crear nuevo issue (${activeTeam?.name || 'Engineering'})`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {errorMsg && (
          <div className="p-3 bg-[#F75555]/15 border border-[#F75555]/30 rounded-lg text-xs text-[#F75555] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Title Input */}
        <div>
          <Input
            placeholder="Título del issue..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            required
            className="text-base font-medium py-2.5"
          />
        </div>

        {/* Description Textarea */}
        <div>
          <textarea
            placeholder="Añade una descripción (Markdown soportado)..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full bg-[#0F1012] border border-[#26292F] focus:border-[#5E6AD2] rounded-md p-3 text-sm text-[#F7F8F8] placeholder-[#5B616E] outline-none transition-colors resize-none font-mono"
          />
        </div>

        {/* Properties Selector Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Status */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#8A8F98]">Estado</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as IssueStatus)}
              className="bg-[#16171A] border border-[#26292F] text-[#F7F8F8] text-xs rounded-md p-2 outline-none cursor-pointer"
            >
              <option value="backlog">Backlog</option>
              <option value="todo">Por hacer</option>
              <option value="in_progress">En progreso</option>
              <option value="in_review">En revisión</option>
              <option value="done">Completado</option>
              <option value="canceled">Cancelado</option>
            </select>
          </div>

          {/* Priority */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#8A8F98]">Prioridad</label>
            <select
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value, 10) as IssuePriority)}
              className="bg-[#16171A] border border-[#26292F] text-[#F7F8F8] text-xs rounded-md p-2 outline-none cursor-pointer"
            >
              <option value={1}>1 - Urgente</option>
              <option value={2}>2 - Alta</option>
              <option value={3}>3 - Media</option>
              <option value={4}>4 - Baja</option>
              <option value={0}>0 - Sin prioridad</option>
            </select>
          </div>

          {/* Project */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#8A8F98]">Proyecto</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="bg-[#16171A] border border-[#26292F] text-[#F7F8F8] text-xs rounded-md p-2 outline-none cursor-pointer truncate"
            >
              <option value="">Sin proyecto</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Assignee */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#8A8F98]">Asignado a</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
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

        {/* Interactive Label Picker */}
        <div className="flex flex-col gap-1 pt-1">
          <label className="text-xs font-semibold text-[#8A8F98]">Etiquetas</label>
          <LabelPicker
            selectedLabelIds={selectedLabels}
            onChange={(labels) => setSelectedLabels(labels)}
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-[#1C1E22] mt-2">
          <span className="text-xs text-[#5B616E]">
            Tip: Presiona <kbd className="bg-[#1E2024] px-1 rounded text-[#F7F8F8]">Cmd+Enter</kbd> para guardar
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={handleClose}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={!title.trim() || loading}>
              {loading ? 'Guardando...' : 'Crear Issue'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
