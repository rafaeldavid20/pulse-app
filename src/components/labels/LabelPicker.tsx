'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { useLabelStore } from '@/stores/labelStore';
import { Badge } from '@/components/ui/Badge';
import { buildLabelIndex, resolveLabel } from '@/lib/labels';
import { Label } from '@/types';
import { CreateLabelModal } from './CreateLabelModal';

interface LabelPickerProps {
  selectedLabelIds: string[];
  onChange: (labelIds: string[]) => void;
}

export const LabelPicker: React.FC<LabelPickerProps> = ({
  selectedLabelIds,
  onChange,
}) => {
  const labels = useLabelStore((s) => s.labels);
  const labelIndex = useMemo(() => buildLabelIndex(labels), [labels]);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const removeValue = (rawValue: string) => {
    onChange(selectedLabelIds.filter((v) => v !== rawValue));
  };

  // Hasta que corra la migración, `selectedLabelIds` puede traer un nombre
  // legado en vez de un id. Tocar la etiqueta siempre escribe el id — así el
  // dato se normaliza solo con el uso — pero para destildarla hay que borrar
  // el valor crudo que esté guardado, sea id o nombre.
  const toggleLabel = (label: Label) => {
    const existingValue = selectedLabelIds.find((v) => v === label.id || v === label.name);
    if (existingValue !== undefined) {
      removeValue(existingValue);
    } else {
      onChange([...selectedLabelIds, label.id]);
    }
  };

  return (
    <div className="flex flex-col gap-2 relative">
      <div className="flex items-center gap-1.5 flex-wrap">
        {selectedLabelIds.map((rawValue) => {
          const matched = resolveLabel(labelIndex, rawValue);
          return (
            <Badge
              key={rawValue}
              variant="accent"
              color={matched?.color}
              className="cursor-pointer hover:opacity-80"
              onClick={() => removeValue(rawValue)}
            >
              {matched?.name ?? rawValue} ×
            </Badge>
          );
        })}

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-secondary hover:text-primary bg-hover hover:bg-active border border-default transition-colors"
        >
          <Plus className="w-3 h-3" />
          <span>Añadir etiqueta</span>
        </button>
      </div>

      {/* Label Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-8 left-0 z-30 w-56 bg-surface border border-default rounded-xl p-2 shadow-2xl flex flex-col gap-1 animate-fade-in-scale">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[10px] font-semibold text-tertiary uppercase tracking-wider">
              Etiquetas
            </span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsCreateModalOpen(true);
              }}
              className="text-[10px] text-accent hover:underline font-medium flex items-center gap-0.5"
            >
              <Plus className="w-2.5 h-2.5" /> Nueva
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5">
            {labels.map((l) => {
              const isChecked = selectedLabelIds.includes(l.id) || selectedLabelIds.includes(l.name);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggleLabel(l)}
                  className={`flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors ${
                    isChecked ? 'bg-accent/15 text-primary' : 'hover:bg-hover text-secondary'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                    <span>{l.name}</span>
                  </div>
                  {isChecked && <Check className="w-3.5 h-3.5 text-accent" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Label Modal */}
      <CreateLabelModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(label) => {
          toggleLabel(label);
        }}
      />
    </div>
  );
};
