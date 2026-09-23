'use client';

import React, { useState} from 'react';
import { nanoid } from 'nanoid';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/stores/appStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceInfra } from '@/hooks/useWorkspaceInfra';
import { Project, ProjectStatus, ProjectKind, PROJECT_KINDS, DefinitionOfDoneCriterion } from '@/types';
import { PROJECT_KIND_LABEL, projectKind } from '@/lib/projectKind';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { SWATCH_COLORS, DEFAULT_SWATCH_COLOR } from '@/lib/constants/colors';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectToEdit?: Project | null;
}

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
  const { repos: infraRepos, connected: infraConnected } = useWorkspaceInfra();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('in_progress');
  const [kind, setKind] = useState<ProjectKind>('generic');
  const [color, setColor] = useState(DEFAULT_SWATCH_COLOR);
  const [leadId, setLeadId] = useState<string>('');
  const [targetDate, setTargetDate] = useState('');
  const [repoFullNames, setRepoFullNames] = useState<string[]>([]);
  const [definitionOfDone, setDefinitionOfDone] = useState<DefinitionOfDoneCriterion[]>([]);
  const [newDodText, setNewDodText] = useState('');
  const [newDodSeverity, setNewDodSeverity] = useState<'blocker' | 'major'>('blocker');
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState(false);

  // El formulario se sincroniza con el proyecto a editar (o se limpia para uno
  // nuevo) durante el render, no en un efecto: en un efecto, abrir el modal
  // sobre el proyecto B después de haber editado el A mostraba por un frame los
  // datos de A. Es el render en cascada que marca el lint, y acá además se veía.
  const [syncedWith, setSyncedWith] = useState({ projectToEdit, isOpen });
  if (syncedWith.projectToEdit !== projectToEdit || syncedWith.isOpen !== isOpen) {
    setSyncedWith({ projectToEdit, isOpen });
    if (projectToEdit) {
      setName(projectToEdit.name || '');
      setDescription(projectToEdit.description || '');
      setStatus(projectToEdit.status || 'in_progress');
      setKind(projectKind(projectToEdit));
      setColor(projectToEdit.color || DEFAULT_SWATCH_COLOR);
      setLeadId(projectToEdit.leadId || '');
      setTargetDate(projectToEdit.targetDate ? projectToEdit.targetDate.split('T')[0] : '');
      setRepoFullNames(projectToEdit.repoFullNames || []);
      setDefinitionOfDone(projectToEdit.definitionOfDone || []);
    } else {
      setName('');
      setDescription('');
      setStatus('in_progress');
      setKind('generic');
      setColor(DEFAULT_SWATCH_COLOR);
      setLeadId('');
      setTargetDate('');
      setRepoFullNames([]);
      setDefinitionOfDone([]);
    }
    setNewDodText('');
    setNewDodSeverity('blocker');
    setNameError(false);
  }

  const handleAddDodCriterion = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newDodText.trim();
    if (!text) return;
    setDefinitionOfDone((prev) => [...prev, { id: nanoid(8), text, severity: newDodSeverity }]);
    setNewDodText('');
  };

  const handleRemoveDodCriterion = (id: string) =>
    setDefinitionOfDone((prev) => prev.filter((c) => c.id !== id));

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
          kind,
          color,
          leadId: leadId || undefined,
          targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
          repoFullNames,
          definitionOfDone,
        });
      } else {
        if (!activeWorkspace || !activeTeam) return;
        await addProject({
          workspaceId: activeWorkspace.id,
          teamId: activeTeam.id,
          name: name.trim(),
          description: description.trim(),
          status,
          kind,
          color,
          leadId: leadId || user?.uid || undefined,
          targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
          repoFullNames,
          definitionOfDone,
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
          <label className="text-xs font-semibold text-secondary">
            Nombre del proyecto <span className="text-priority-urgent">*</span>
          </label>
          <Input
            placeholder="e.g. Rediseño App Móvil, API v2, Onboarding SaaS"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value.trim()) setNameError(false);
            }}
            autoFocus
            className={nameError ? 'border-priority-urgent focus:border-priority-urgent' : ''}
          />
          {nameError && (
            <div className="flex items-center gap-1.5 text-[11px] text-priority-urgent font-medium mt-0.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>El nombre del proyecto es obligatorio.</span>
            </div>
          )}
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
          {/* Tipo — decide qué superficie específica aparece (TES-270) */}
          <div className="flex flex-col gap-1 col-span-2">
            <label className="text-xs font-semibold text-secondary">Tipo de proyecto</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ProjectKind)}
              className="bg-elevated border border-default text-primary text-xs rounded-md p-2 outline-none cursor-pointer"
            >
              {PROJECT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {PROJECT_KIND_LABEL[k]}
                </option>
              ))}
            </select>
            {kind === 'salesforce' && (
              <p className="text-[10px] text-tertiary">
                Habilita la conexión de orgs y los entornos en Configuración → Salesforce.
              </p>
            )}
          </div>

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

        {/* Target Date (Optional) */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-secondary">
            Fecha objetivo <span className="text-[10px] text-tertiary font-normal">(Opcional)</span>
          </label>
          <Input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="text-xs"
          />
        </div>

        {/* Repos permitidos — el límite dentro del cual se eligen las ramas */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-secondary">
            Repositorios del proyecto{' '}
            <span className="text-[10px] text-tertiary font-normal">(Opcional)</span>
          </label>
          {!infraConnected ? (
            <p className="text-[11px] text-tertiary">
              Conectá GitHub en Configuración para poder limitar los repos.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto p-2 bg-surface border border-default rounded-md">
                {infraRepos.map((r) => (
                  <label
                    key={r}
                    className="flex items-center gap-2 text-xs text-primary cursor-pointer py-0.5"
                  >
                    <input
                      type="checkbox"
                      checked={repoFullNames.includes(r)}
                      onChange={(e) =>
                        setRepoFullNames((prev) =>
                          e.target.checked ? [...prev, r] : prev.filter((x) => x !== r)
                        )
                      }
                      className="w-3.5 h-3.5 accent-accent"
                    />
                    <span className="font-mono truncate">{r}</span>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-tertiary">
                Sus issues solo pueden abrir ramas en estos repos. Sin ninguno marcado, vale
                cualquiera de los conectados.
              </p>
            </>
          )}
        </div>

        {/* Definition of Done — reglas que valen para todos los issues del proyecto (D14) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-secondary">
            Definition of Done{' '}
            <span className="text-[10px] text-tertiary font-normal">(Opcional)</span>
          </label>
          {definitionOfDone.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {definitionOfDone.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 bg-elevated border border-default rounded-lg text-xs group"
                >
                  <span
                    className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                      c.severity === 'blocker'
                        ? 'bg-priority-urgent/15 text-priority-urgent'
                        : 'bg-priority-high/15 text-priority-high'
                    }`}
                  >
                    {c.severity === 'blocker' ? 'Blocker' : 'Major'}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-primary">{c.text}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDodCriterion(c.id)}
                    aria-label="Eliminar regla"
                    className="opacity-0 group-hover:opacity-100 text-tertiary hover:text-priority-urgent shrink-0 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <select
              value={newDodSeverity}
              onChange={(e) => setNewDodSeverity(e.target.value as 'blocker' | 'major')}
              className="bg-elevated border border-default text-primary text-xs rounded-md p-2 outline-none cursor-pointer shrink-0"
            >
              <option value="blocker">Blocker</option>
              <option value="major">Major</option>
            </select>
            <form onSubmit={handleAddDodCriterion} className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={newDodText}
                onChange={(e) => setNewDodText(e.target.value)}
                placeholder="Añadir regla, ej. 'no editar domain.generated.ts a mano'…"
                className="flex-1 min-w-0 bg-surface border border-default focus:border-accent rounded-md p-2 text-xs text-primary placeholder-tertiary outline-none"
              />
              {newDodText.trim() && (
                <button
                  type="submit"
                  className="px-2.5 py-2 text-[11px] rounded-md bg-accent hover:bg-accent-hover text-white transition-colors shrink-0 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Añadir
                </button>
              )}
            </form>
          </div>
          <p className="text-[10px] text-tertiary">
            Se verifican en todos los issues del proyecto, además de los criterios de aceptación
            de cada uno.
          </p>
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
          <Button variant="primary" size="sm" type="submit" disabled={loading}>
            {loading ? 'Guardando...' : projectToEdit ? 'Guardar Cambios' : 'Crear Proyecto'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
