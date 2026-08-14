'use client';

import React, { useState } from 'react';
import { Tag, Plus, Check } from 'lucide-react';
import { useLabelStore } from '@/stores/labelStore';
import { Badge } from '@/components/ui/Badge';
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
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const toggleLabel = (labelName: string) => {
    const exists = selectedLabelIds.includes(labelName);
    if (exists) {
      onChange(selectedLabelIds.filter((l) => l !== labelName));
    } else {
      onChange([...selectedLabelIds, labelName]);
    }
  };

  return (
    <div className="flex flex-col gap-2 relative">
      <div className="flex items-center gap-1.5 flex-wrap">
        {selectedLabelIds.map((labelName) => {
          const matched = labels.find((l) => l.name === labelName);
          return (
            <Badge
              key={labelName}
              variant="accent"
              color={matched?.color}
              className="cursor-pointer hover:opacity-80"
              onClick={() => toggleLabel(labelName)}
            >
              {labelName} ×
            </Badge>
          );
        })}

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-[#8A8F98] hover:text-[#F7F8F8] bg-[#1E2024] hover:bg-[#26292E] border border-[#26292F] transition-colors"
        >
          <Plus className="w-3 h-3" />
          <span>Añadir etiqueta</span>
        </button>
      </div>

      {/* Label Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-8 left-0 z-30 w-56 bg-[#0F1012] border border-[#26292F] rounded-xl p-2 shadow-2xl flex flex-col gap-1 animate-fade-in-scale">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[10px] font-semibold text-[#5B616E] uppercase tracking-wider">
              Etiquetas
            </span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsCreateModalOpen(true);
              }}
              className="text-[10px] text-[#5E6AD2] hover:underline font-medium flex items-center gap-0.5"
            >
              <Plus className="w-2.5 h-2.5" /> Nueva
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5">
            {labels.map((l) => {
              const isChecked = selectedLabelIds.includes(l.name);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggleLabel(l.name)}
                  className={`flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors ${
                    isChecked ? 'bg-[#5E6AD2]/15 text-[#F7F8F8]' : 'hover:bg-[#1E2024] text-[#8A8F98]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                    <span>{l.name}</span>
                  </div>
                  {isChecked && <Check className="w-3.5 h-3.5 text-[#5E6AD2]" />}
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
        onCreated={(labelName) => {
          toggleLabel(labelName);
        }}
      />
    </div>
  );
};
