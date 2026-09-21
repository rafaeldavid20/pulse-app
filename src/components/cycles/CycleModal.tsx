'use client';

import React, { useState} from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/stores/appStore';
import { useCycleStore } from '@/stores/cycleStore';
import { AlertCircle } from 'lucide-react';

interface CycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Si ya hay un ciclo activo para el equipo, no se ofrece crear otro activo. */
  hasActiveCycle: boolean;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusTwoWeeksIso(from: string): string {
  const d = new Date(from);
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

export const CycleModal: React.FC<CycleModalProps> = ({ isOpen, onClose, hasActiveCycle }) => {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const activeTeam = useAppStore((s) => s.activeTeam);
  const addCycle = useCycleStore((s) => s.addCycle);

  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState(todayIso());
  const [endsAt, setEndsAt] = useState(plusTwoWeeksIso(todayIso()));
  const [markActive, setMarkActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El formulario se limpia al abrirse, ajustando el estado durante el render
  // en vez de en un efecto: así el primer frame del modal ya muestra los
  // valores por defecto, en lugar de pintar los de la vez anterior y
  // corregirlos después (el render en cascada que marca el lint).
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setName('');
      setStartsAt(todayIso());
      setEndsAt(plusTwoWeeksIso(todayIso()));
      setMarkActive(false);
      setError(null);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !activeTeam) return;

    if (new Date(startsAt) >= new Date(endsAt)) {
      setError('La fecha de inicio debe ser anterior a la de fin.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await addCycle({
        workspaceId: activeWorkspace.id,
        teamId: activeTeam.id,
        name: name.trim() || undefined,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        status: markActive ? 'active' : 'upcoming',
      });
      onClose();
    } catch (err) {
      console.error('Error creating cycle:', err);
      setError('No se pudo crear el ciclo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nuevo ciclo" maxWidth="sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-secondary">
            Nombre <span className="text-[10px] text-tertiary font-normal">(Opcional)</span>
          </label>
          <Input
            placeholder="Se autogenera como &quot;Ciclo N&quot; si lo dejás vacío"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-secondary">Inicio</label>
            <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="text-xs" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-secondary">Fin</label>
            <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="text-xs" />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-1.5 text-[11px] text-priority-urgent font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{error}</span>
          </div>
        )}

        {!hasActiveCycle && (
          <label className="flex items-center gap-2 text-xs text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={markActive}
              onChange={(e) => setMarkActive(e.target.checked)}
              className="w-3.5 h-3.5 accent-accent"
            />
            Marcar como ciclo activo
          </label>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-subtle mt-2">
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" type="submit" disabled={loading}>
            {loading ? 'Creando...' : 'Crear ciclo'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
