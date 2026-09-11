'use client';

import React, { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'lg',
}) => {
  // Portal target isn't available during SSR; useSyncExternalStore (rather
  // than a `useState` + effect) reports false on the server and during the
  // first client render, then true after hydration — no client/server
  // markup mismatch, and no setState-in-effect.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  // Rendered via a portal into `document.body` rather than in place: a
  // modal opened from inside another modal's <form> (e.g. "Crear
  // etiqueta" from within "Crear issue") would otherwise nest a <form>
  // inside a <form>. Nested forms share form-owner resolution in ways
  // that make the inner submit bubble into the outer form's submit
  // handler, closing/resetting both modals instead of just the inner one.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in-scale">
      <div
        className={cn(
          'w-full bg-surface border border-default rounded-xl shadow-2xl overflow-hidden flex flex-col',
          maxWidthClasses[maxWidth]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-subtle">
            <div className="text-base font-semibold text-primary">{title}</div>
            <button
              onClick={onClose}
              className="text-secondary hover:text-primary p-1 rounded-md hover:bg-hover transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="p-5 overflow-y-auto max-h-[80vh]">{children}</div>
      </div>
    </div>,
    document.body
  );
};
