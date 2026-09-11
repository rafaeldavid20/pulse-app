'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useLabelStore } from '@/stores/labelStore';
import { useAppStore } from '@/stores/appStore';
import { Tag } from 'lucide-react';
import { SWATCH_COLORS, DEFAULT_SWATCH_COLOR } from '@/lib/constants/colors';

interface CreateLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (labelName: string) => void;
}

export const CreateLabelModal: React.FC<CreateLabelModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const activeTeam = useAppStore((s) => s.activeTeam);
  const addLabel = useLabelStore((s) => s.addLabel);

  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_SWATCH_COLOR);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !activeWorkspace || !activeTeam) return;

    setLoading(true);
    try {
      const created = await addLabel({
        workspaceId: activeWorkspace.id,
        teamId: activeTeam.id,
        name: name.trim(),
        color,
      });

      setName('');
      onClose();
      if (onCreated && created?.name) onCreated(created.name);
    } catch (err) {
      console.error('Error creating label:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Crear nueva etiqueta" maxWidth="sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-secondary">Nombre de la etiqueta</label>
          <Input
            placeholder="e.g. refactor, security, mobile"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-secondary">Color</label>
          <div className="flex items-center gap-2 flex-wrap">
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

        {/* Preview */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-secondary">Vista previa</label>
          <div className="flex items-center">
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border"
              style={{
                backgroundColor: `${color}20`,
                color: color,
                borderColor: `${color}40`,
              }}
            >
              <Tag className="w-3 h-3" />
              {name.trim() || 'nombre-etiqueta'}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-subtle mt-2">
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" type="submit" disabled={!name.trim() || loading}>
            {loading ? 'Creando...' : 'Crear Etiqueta'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
