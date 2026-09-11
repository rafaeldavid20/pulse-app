'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LabelPicker } from '@/components/labels/LabelPicker';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAuth } from '@/hooks/useAuth';
import { IssueStatus, IssuePriority, IssueType } from '@/types';
import { ISSUE_PRIORITIES, ISSUE_STATUSES, ISSUE_TYPES } from '@/lib/constants/issue';
import { validParentsFor } from '@/lib/hierarchy';
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
  const defaultIssueType = useIssueStore((s) => s.defaultIssueType);
  const setDefaultIssueType = useIssueStore((s) => s.setDefaultIssueType);
  const allIssues = useIssueStore((s) => s.issues);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<IssueStatus>('todo');
  const [priority, setPriority] = useState<IssuePriority>(3);
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [type, setType] = useState<IssueType>('task');
  const [parentId, setParentId] = useState<string>('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>(['feature']);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [titleError, setTitleError] = useState(false);

  // Sync defaultProjectId when modal opens
  useEffect(() => {
    if (isCreateIssueOpen && defaultProjectId) {
      setProjectId(defaultProjectId);
    }
    if (isCreateIssueOpen) {
      setType(defaultIssueType);
    }
    setTitleError(false);
  }, [isCreateIssueOpen, defaultProjectId, defaultIssueType]);

  // Los padres válidos dependen del tipo elegido (tabla `ALLOWED_PARENT_TYPES`),
  // así que cambiar el tipo puede invalidar el padre ya seleccionado.
  const parentOptions = useMemo(
    () => validParentsFor(allIssues, type),
    [allIssues, type]
  );

  // Se deriva en render en vez de resetear `parentId` desde un efecto: cambiar
  // el tipo puede invalidar el padre elegido, y un efecto que corrige estado
  // dispara un render en cascada por cada cambio de tipo.
  const effectiveParentId = parentOptions.some((p) => p.id === parentId) ? parentId : '';

  // Si la épica elegida define un agente por defecto y todavía no elegiste
  // asignado, se preselecciona. Es preselección, no imposición: cambiar el
  // selector la pisa, y dejarlo en "Sin asignar" es una elección respetada.
  const parentIssue = parentOptions.find((p) => p.id === effectiveParentId);
  const effectiveAssigneeId = assigneeId || parentIssue?.defaultAssigneeId || '';

  const handleClose = () => {
    setErrorMsg('');
    setTitleError(false);
    setCreateIssueOpen(false);
    setDefaultProjectId(null);
    setDefaultIssueType('task');
    setParentId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setTitleError(true);
      return;
    }

    setTitleError(false);

    if (!user) {
      setErrorMsg('No hay una sesión activa de usuario.');
      return;
    }

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
        assigneeId: effectiveAssigneeId || undefined,
        type,
        parentId: effectiveParentId || undefined,
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
          <div className="p-3 bg-priority-urgent/15 border border-priority-urgent/30 rounded-lg text-xs text-priority-urgent flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Title Input */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-secondary">
            Título del issue <span className="text-priority-urgent">*</span>
          </label>
          <Input
            placeholder="Título del issue..."
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (e.target.value.trim()) setTitleError(false);
            }}
            autoFocus
            className={`text-base font-medium py-2.5 ${
              titleError ? 'border-priority-urgent focus:border-priority-urgent' : ''
            }`}
          />
          {titleError && (
            <div className="flex items-center gap-1.5 text-[11px] text-priority-urgent font-medium mt-0.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>El título del issue es obligatorio.</span>
            </div>
          )}
        </div>

        {/* Description Textarea */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-secondary">Descripción</label>
          <textarea
            placeholder="Añade una descripción (Markdown soportado)..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full bg-surface border border-default focus:border-accent rounded-md p-3 text-sm text-primary placeholder-tertiary outline-none transition-colors resize-none font-mono"
          />
        </div>

        {/* Hierarchy: tipo y padre */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-secondary">Tipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as IssueType)}
              className="bg-elevated border border-default text-primary text-xs rounded-md p-2 outline-none cursor-pointer"
            >
              {ISSUE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-secondary">
              {type === 'subtask' ? 'Historia padre' : 'Épica'}
            </label>
            <select
              value={effectiveParentId}
              onChange={(e) => setParentId(e.target.value)}
              disabled={parentOptions.length === 0}
              className="bg-elevated border border-default text-primary text-xs rounded-md p-2 outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {type === 'epic'
                  ? 'Una épica no puede tener padre'
                  : parentOptions.length === 0
                    ? 'No hay padres disponibles'
                    : 'Sin asignar'}
              </option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.identifier} · {p.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Properties Selector Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Status */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-secondary">Estado</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as IssueStatus)}
              className="bg-elevated border border-default text-primary text-xs rounded-md p-2 outline-none cursor-pointer"
            >
              {ISSUE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-secondary">Prioridad</label>
            <select
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value, 10) as IssuePriority)}
              className="bg-elevated border border-default text-primary text-xs rounded-md p-2 outline-none cursor-pointer"
            >
              {ISSUE_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.value} - {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Project */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-secondary">Proyecto (Opcional)</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="bg-elevated border border-default text-primary text-xs rounded-md p-2 outline-none cursor-pointer truncate"
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
            <label className="text-xs font-semibold text-secondary">Asignado a</label>
            <select
              value={effectiveAssigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="bg-elevated border border-default text-primary text-xs rounded-md p-2 outline-none cursor-pointer truncate"
            >
              <option value="">Sin asignar</option>
              <optgroup label="Humanos">
                {members
                  .filter((m) => !m.isAgent)
                  .map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.displayName}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Agentes">
                {members
                  .filter((m) => m.isAgent)
                  .map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.displayName}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>
        </div>

        {/* Interactive Label Picker */}
        <div className="flex flex-col gap-1 pt-1">
          <label className="text-xs font-semibold text-secondary">Etiquetas</label>
          <LabelPicker
            selectedLabelIds={selectedLabels}
            onChange={(labels) => setSelectedLabels(labels)}
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-subtle mt-2">
          <span className="text-xs text-tertiary">
            Tip: Presiona <kbd className="bg-hover px-1 rounded text-primary">Cmd+Enter</kbd> para guardar
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={handleClose}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Crear Issue'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
