'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectPopoverOption {
  value: string;
  label: React.ReactNode;
}

export interface SelectPopoverGroup {
  heading: string;
  options: SelectPopoverOption[];
}

/** Los items pueden ser sueltos o agrupados en la misma lista (p.ej. "Sin
 *  asignar" suelto seguido de los grupos "Humanos"/"Agentes"). */
export type SelectPopoverItem = SelectPopoverOption | SelectPopoverGroup;

interface SelectPopoverProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectPopoverItem[];
  placeholder?: string;
  /** Nombre accesible del control — no hay <label htmlFor> en estos grids de propiedades. */
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
  align?: 'left' | 'right';
}

const isGroup = (item: SelectPopoverItem): item is SelectPopoverGroup => 'heading' in item;

/**
 * Reemplazo de <select> nativo consistente con los popovers del resto de la
 * app (FilterBar, LabelPicker): mismo radio (rounded-md el trigger,
 * rounded-xl el menú), misma sombra, mismas filas con check. A diferencia
 * del nativo, expone role="combobox"/"listbox"/"option" (patrón APG "select
 * only combobox") en vez de perder toda semántica de selección como pasaba
 * con el <select> nativo estilizado a opacity-0.
 */
export const SelectPopover: React.FC<SelectPopoverProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Sin definir',
  ariaLabel,
  disabled,
  className,
  align = 'right',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const idPrefix = useId();
  const listboxId = `${idPrefix}-listbox`;

  const flatOptions = useMemo(
    () => options.flatMap((item) => (isGroup(item) ? item.options : [item])),
    [options]
  );
  const optionIndex = useMemo(
    () => new Map(flatOptions.map((o, i) => [o.value, i] as const)),
    [flatOptions]
  );

  const selected = flatOptions.find((o) => o.value === value);

  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isOpen]);

  const openMenu = () => {
    const idx = optionIndex.get(value);
    setHighlighted(idx ?? 0);
    setIsOpen(true);
  };

  const commit = (v: string) => {
    onChange(v);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!isOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlighted((i) => Math.min(i + 1, flatOptions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlighted((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setHighlighted(0);
        break;
      case 'End':
        e.preventDefault();
        setHighlighted(flatOptions.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (flatOptions[highlighted]) commit(flatOptions[highlighted].value);
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  const renderOption = (opt: SelectPopoverOption) => {
    const index = optionIndex.get(opt.value) ?? 0;
    return (
      <button
        key={opt.value}
        id={`${idPrefix}-opt-${index}`}
        type="button"
        role="option"
        aria-selected={opt.value === value}
        onMouseEnter={() => setHighlighted(index)}
        onClick={() => commit(opt.value)}
        className={cn(
          'flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-colors',
          index === highlighted ? 'bg-hover text-primary' : 'text-secondary hover:bg-hover hover:text-primary'
        )}
      >
        <span className="truncate">{opt.label}</span>
        {opt.value === value && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
      </button>
    );
  };

  return (
    <div className={cn('relative inline-block', className)} ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        aria-activedescendant={isOpen ? `${idPrefix}-opt-${highlighted}` : undefined}
        onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
        className="flex items-center gap-1 bg-hover hover:bg-active text-primary border border-default rounded-md px-2.5 py-1.5 outline-none text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed max-w-full truncate"
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown className="w-3 h-3 text-tertiary shrink-0" />
      </button>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className={cn(
            'absolute top-full mt-1 z-30 min-w-[10rem] max-h-64 overflow-y-auto bg-surface border border-default rounded-xl p-1.5 shadow-2xl flex flex-col gap-0.5 animate-fade-in-scale',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {options.map((item) =>
            isGroup(item) ? (
              <div key={item.heading} className="flex flex-col gap-0.5">
                <span className="px-2 py-1 text-[10px] font-semibold text-tertiary uppercase tracking-wider">
                  {item.heading}
                </span>
                {item.options.map((opt) => renderOption(opt))}
              </div>
            ) : (
              renderOption(item)
            )
          )}
        </div>
      )}
    </div>
  );
};
