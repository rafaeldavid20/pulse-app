'use client';

import React, { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useAuth } from '@/hooks/useAuth';
import { updateNotificationPreference } from '@/lib/firestore';
import { NotificationType } from '@/types';

const NOTIFICATION_TYPE_OPTIONS: { type: NotificationType; label: string; description: string }[] = [
  { type: 'assigned', label: 'Asignaciones', description: 'Cuando te asignan un issue.' },
  { type: 'mentioned', label: 'Menciones', description: 'Cuando alguien te menciona en un comentario.' },
  { type: 'comment', label: 'Comentarios', description: 'Nuevos comentarios en issues que te involucran.' },
  { type: 'status_change', label: 'Cambios de estado', description: 'Cuando cambia el estado de un issue tuyo.' },
  { type: 'review_result', label: 'Resultado de revisión', description: 'Cuando un agente QA revisa tu PR.' },
  { type: 'due_soon', label: 'Vencimientos próximos', description: 'Recordatorios de issues por vencer.' },
];

/**
 * Apagar/prender categorías completas de notificación por miembro (F4) — no
 * silencia un issue puntual, eso ya lo cubre el botón de silenciar del inbox
 * (F1/F3). `localMuted` espeja `mutedNotificationTypes` del doc de membership
 * (fuente de verdad via `subscribeWorkspaceMembers` en AuthGuard) para poder
 * togglear de forma optimista, mismo patrón que el inbox.
 */
export function NotificationPreferencesSection() {
  const { user } = useAuth();
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const members = useAppStore((s) => s.members);
  const workspaceId = activeWorkspace?.id;
  const currentMember = members.find((m) => m.userId === user?.uid);

  const [localMuted, setLocalMuted] = useState<NotificationType[]>(currentMember?.mutedNotificationTypes ?? []);
  const [savingType, setSavingType] = useState<NotificationType | null>(null);

  useEffect(() => {
    setLocalMuted(currentMember?.mutedNotificationTypes ?? []);
  }, [currentMember]);

  const handleToggle = async (type: NotificationType, enabled: boolean) => {
    if (!workspaceId) return;
    const previous = localMuted;
    setLocalMuted((prev) => (enabled ? prev.filter((t) => t !== type) : [...prev, type]));
    setSavingType(type);
    try {
      await updateNotificationPreference(workspaceId, type, enabled);
    } catch (err) {
      setLocalMuted(previous);
      alert(err instanceof Error ? err.message : 'No se pudo actualizar la preferencia.');
    } finally {
      setSavingType(null);
    }
  };

  if (!workspaceId || !currentMember) return null;

  return (
    <div className="flex flex-col gap-4 p-5 bg-surface border border-default rounded-xl">
      <div className="flex items-center gap-2">
        <BellRing className="w-4 h-4 text-secondary" />
        <h3 className="text-base font-semibold text-primary">Notificaciones</h3>
      </div>

      <p className="text-xs text-secondary">
        Elegí qué tipos de notificación querés recibir en este workspace. Apagar una categoría acá no
        afecta el silenciado de issues puntuales desde el inbox.
      </p>

      <div className="flex flex-col gap-0.5">
        {NOTIFICATION_TYPE_OPTIONS.map(({ type, label, description }) => {
          const enabled = !localMuted.includes(type);
          return (
            <div key={type} className="flex items-center justify-between gap-4 px-1 py-2 rounded-md hover:bg-hover transition-colors">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm text-primary">{label}</span>
                <span className="text-xs text-tertiary">{description}</span>
              </div>
              <label className="flex items-center shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={savingType === type}
                  onChange={(e) => handleToggle(type, e.target.checked)}
                  className="w-3.5 h-3.5 accent-accent"
                  aria-label={label}
                />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
