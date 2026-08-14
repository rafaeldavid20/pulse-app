'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { useAppStore } from '@/stores/appStore';

export const ShortcutHelp: React.FC = () => {
  const isShortcutHelpOpen = useAppStore((s) => s.isShortcutHelpOpen);
  const setShortcutHelpOpen = useAppStore((s) => s.setShortcutHelpOpen);

  const shortcutGroups = [
    {
      title: 'Comandos Generales',
      items: [
        { key: '⌘ K', label: 'Abrir Command Palette' },
        { key: 'C', label: 'Crear nuevo issue' },
        { key: 'Space', label: 'Abrir Peek Panel (previsualizar issue)' },
        { key: '?', label: 'Mostrar este menú de ayuda' },
        { key: 'Esc', label: 'Cerrar modal / Limpiar selección' },
      ],
    },
    {
      title: 'Navegación de Lista',
      items: [
        { key: 'J / ↓', label: 'Mover selección abajo' },
        { key: 'K / ↑', label: 'Mover selección arriba' },
        { key: 'X', label: 'Seleccionar / Deseleccionar issue' },
      ],
    },
    {
      title: 'Modificar Properties (Issue seleccionado)',
      items: [
        { key: '1 .. 4', label: 'Cambiar prioridad (1=Urgente, 4=Baja)' },
        { key: '0', label: 'Remover prioridad' },
        { key: '⌘ Enter', label: 'Guardar formulario / Enviar comentario' },
      ],
    },
    {
      title: 'Navegación por Teclado (Chords: G + tecla)',
      items: [
        { key: 'G  I', label: 'Ir a Inbox' },
        { key: 'G  M', label: 'Ir a Mis Issues' },
        { key: 'G  B', label: 'Ir a Engineering Issues' },
        { key: 'G  P', label: 'Ir a Proyectos' },
      ],
    },
  ];

  return (
    <Modal
      isOpen={isShortcutHelpOpen}
      onClose={() => setShortcutHelpOpen(false)}
      title="Shortcuts de Teclado (Linear-style)"
      maxWidth="lg"
    >
      <div className="flex flex-col gap-5 text-sm">
        {shortcutGroups.map((group) => (
          <div key={group.title} className="flex flex-col gap-2">
            <h4 className="text-xs font-semibold text-[#8A8F98] uppercase tracking-wider">
              {group.title}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {group.items.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-2 bg-[#16171A] border border-[#26292F] rounded-md text-xs"
                >
                  <span className="text-[#8A8F98]">{item.label}</span>
                  <kbd className="font-mono text-xs text-[#F7F8F8] bg-[#1E2024] px-1.5 py-0.5 rounded border border-[#26292F] font-semibold">
                    {item.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
};
