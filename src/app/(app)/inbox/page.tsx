'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AtSign,
  BellOff,
  Check,
  CheckCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Loader2,
  MessageSquare,
  RefreshCcw,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { formatTimeAgo, cn } from '@/lib/utils';
import { useTriageIssues } from '@/hooks/useTriageIssues';
import { useUserNotifications } from '@/hooks/useUserNotifications';
import { TriageQueue } from '@/components/issues/TriageQueue';
import { Skeleton } from '@/components/ui/Skeleton';
import { useIssueStore } from '@/stores/issueStore';
import {
  markNotificationRead,
  markAllNotificationsRead,
  muteIssueNotifications,
  snoozeNotification,
} from '@/lib/firestore';
import { Notification, NotificationType, SnoozePreset } from '@/types';

const SNOOZE_OPTIONS: { preset: SnoozePreset; label: string }[] = [
  { preset: '1h', label: '1 hora' },
  { preset: 'tomorrow', label: 'Mañana' },
  { preset: 'next_week', label: 'Próxima semana' },
];

const SNOOZE_TOAST_LABELS: Record<SnoozePreset, string> = {
  '1h': '1 hora',
  tomorrow: 'mañana',
  next_week: 'la próxima semana',
  clear: '',
};

/** Menú de posponer de una fila de notificación (F4) — mismo patrón de click-outside que SelectPopover. */
function SnoozeMenuButton({ onSnooze, disabled }: { onSnooze: (preset: SnoozePreset) => void; disabled?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((o) => !o);
        }}
        disabled={disabled}
        title="Posponer"
        aria-label="Posponer notificación"
        className={cn(
          'p-1.5 text-tertiary hover:text-primary opacity-0 group-hover:opacity-100 hover:bg-hover rounded-md transition-all disabled:opacity-40',
          isOpen && 'opacity-100'
        )}
      >
        <Clock className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full mt-1 z-30 min-w-[9.5rem] bg-surface border border-default rounded-xl p-1.5 shadow-2xl flex flex-col gap-0.5 animate-fade-in-scale"
        >
          {SNOOZE_OPTIONS.map((opt) => (
            <button
              key={opt.preset}
              type="button"
              onClick={() => {
                setIsOpen(false);
                onSnooze(opt.preset);
              }}
              className="px-2.5 py-1.5 rounded-md text-xs text-left text-secondary hover:bg-hover hover:text-primary transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type InboxTab = 'notifications' | 'triage';
type NotificationFilter = 'all' | 'unread';

const NOTIFICATION_ICONS: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  assigned: CheckCircle2,
  mentioned: AtSign,
  comment: MessageSquare,
  status_change: RefreshCcw,
  review_result: ClipboardCheck,
  due_soon: Clock,
};

/** "Hoy" agrupa por fecha de calendario local, no por ventana de 24hs. */
function isToday(dateString: string): boolean {
  const d = new Date(dateString);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

interface NotificationRowProps {
  notification: Notification;
  isFocused: boolean;
  busy: boolean;
  onOpen: () => void;
  onMarkRead: () => void;
  onMute: () => void;
  onSnooze: (preset: SnoozePreset) => void;
}

const NotificationRow: React.FC<NotificationRowProps> = ({
  notification,
  isFocused,
  busy,
  onOpen,
  onMarkRead,
  onMute,
  onSnooze,
}) => {
  const Icon = NOTIFICATION_ICONS[notification.type] ?? CheckCircle2;

  return (
    <div
      onClick={onOpen}
      tabIndex={0}
      className={cn(
        'group flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer select-none',
        isFocused && 'border-accent/60 ring-1 ring-accent/30',
        !notification.read && 'bg-elevated border-accent/40 shadow-sm',
        notification.read && !isFocused && 'bg-surface border-subtle opacity-80 hover:border-default'
      )}
    >
      <div className="p-2 rounded-lg bg-hover text-accent shrink-0 mt-0.5">
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-primary truncate">{notification.title}</h4>
          <span className="text-xs text-tertiary shrink-0 font-mono">
            {formatTimeAgo(notification.createdAt)}
          </span>
        </div>
        <p className="text-xs text-secondary truncate">{notification.body}</p>
      </div>

      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 text-tertiary animate-spin mx-1" />
        ) : (
          <>
            {!notification.read && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkRead();
                }}
                title="Marcar como leída"
                aria-label="Marcar como leída"
                className="p-1.5 text-tertiary hover:text-primary opacity-0 group-hover:opacity-100 hover:bg-hover rounded-md transition-all"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            )}
            <SnoozeMenuButton onSnooze={onSnooze} />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMute();
              }}
              title="Silenciar issue"
              aria-label="Silenciar issue"
              className="p-1.5 text-tertiary hover:text-primary opacity-0 group-hover:opacity-100 hover:bg-hover rounded-md transition-all"
            >
              <BellOff className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

interface NotificationsTabProps {
  notifications: Notification[];
  loaded: boolean;
  error: string | null;
}

function NotificationsTab({ notifications, loaded, error }: NotificationsTabProps) {
  const setPeekIssueId = useIssueStore((s) => s.setPeekIssueId);
  const setSelectedIssueId = useIssueStore((s) => s.setSelectedIssueId);

  const [filter, setFilter] = useState<NotificationFilter>('all');
  // El listener de Firestore es la fuente de verdad; se copia a estado local
  // para poder aplicar updates optimistas (marcar leído/silenciar) sin
  // esperar la confirmación del backend.
  const [localNotifications, setLocalNotifications] = useState<Notification[]>(notifications);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    setLocalNotifications(notifications);
  }, [notifications]);

  const unreadCount = localNotifications.filter((n) => !n.read).length;

  const visible = useMemo(
    () => (filter === 'unread' ? localNotifications.filter((n) => !n.read) : localNotifications),
    [localNotifications, filter]
  );

  const todayItems = visible.filter((n) => isToday(n.createdAt));
  const beforeItems = visible.filter((n) => !isToday(n.createdAt));

  useEffect(() => {
    if (!focusedId || !visible.some((n) => n.id === focusedId)) {
      setFocusedId(visible[0]?.id ?? null);
    }
  }, [visible, focusedId]);

  const handleMarkRead = async (id: string) => {
    let previous: Notification | undefined;
    setLocalNotifications((prev) => {
      previous = prev.find((n) => n.id === id);
      return prev.map((n) => (n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n));
    });
    setBusyId(id);
    try {
      await markNotificationRead(id);
    } catch (err) {
      if (previous) {
        const prevNotification = previous;
        setLocalNotifications((prev) => prev.map((n) => (n.id === id ? prevNotification : n)));
      }
      toast.error(err instanceof Error ? err.message : 'No se pudo marcar como leída.');
    } finally {
      setBusyId(null);
    }
  };

  const handleOpen = (notification: Notification) => {
    setSelectedIssueId(notification.issueId);
    setPeekIssueId(notification.issueId);
    if (!notification.read) handleMarkRead(notification.id);
  };

  const handleMarkAllRead = async () => {
    const previous = localNotifications;
    setMarkingAll(true);
    setLocalNotifications((prev) =>
      prev.map((n) => (n.read ? n : { ...n, read: true, readAt: new Date().toISOString() }))
    );
    try {
      await markAllNotificationsRead();
    } catch (err) {
      setLocalNotifications(previous);
      toast.error(err instanceof Error ? err.message : 'No se pudieron marcar las notificaciones como leídas.');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleSnooze = async (notification: Notification, preset: SnoozePreset) => {
    const previous = localNotifications;
    setBusyId(notification.id);
    // Un snooze futuro la oculta del inbox (F4) — igual que silenciar, optimista.
    setLocalNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    try {
      await snoozeNotification(notification.id, preset);
      toast.success(`Pospuesta hasta ${SNOOZE_TOAST_LABELS[preset]}.`, {
        action: {
          label: 'Deshacer',
          onClick: async () => {
            try {
              await snoozeNotification(notification.id, 'clear');
              setLocalNotifications((prev) =>
                prev.some((n) => n.id === notification.id)
                  ? prev
                  : [...prev, { ...notification, snoozedUntil: undefined }]
              );
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'No se pudo deshacer el snooze.');
            }
          },
        },
      });
    } catch (err) {
      setLocalNotifications(previous);
      toast.error(err instanceof Error ? err.message : 'No se pudo posponer la notificación.');
    } finally {
      setBusyId(null);
    }
  };

  const handleMute = async (notification: Notification) => {
    const previous = localNotifications;
    setBusyId(notification.id);
    setLocalNotifications((prev) => prev.filter((n) => n.issueId !== notification.issueId));
    try {
      await muteIssueNotifications(notification.issueId);
      toast.success('Vas a dejar de recibir notificaciones de este issue.');
    } catch (err) {
      setLocalNotifications(previous);
      toast.error(err instanceof Error ? err.message : 'No se pudo silenciar el issue.');
    } finally {
      setBusyId(null);
    }
  };

  // J/K sobre la fila con foco, mismo patrón que TriageQueue.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (!focusedId || !visible.some((n) => n.id === focusedId)) return;

      const idx = visible.findIndex((n) => n.id === focusedId);
      const key = e.key.toLowerCase();

      if (key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (idx < visible.length - 1) setFocusedId(visible[idx + 1].id);
      } else if (key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (idx > 0) setFocusedId(visible[idx - 1].id);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const current = visible.find((n) => n.id === focusedId);
        if (current) handleOpen(current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedId, visible]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-priority-urgent/40 bg-priority-urgent/5 rounded-lg">
        <p className="text-priority-urgent text-sm">{error}</p>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const renderGroup = (label: string, items: Notification[]) =>
    items.length > 0 && (
      <section key={label} className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-secondary uppercase tracking-wide px-1">{label}</h3>
        <div className="flex flex-col gap-2">
          {items.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              isFocused={focusedId === n.id}
              busy={busyId === n.id}
              onOpen={() => handleOpen(n)}
              onMarkRead={() => handleMarkRead(n.id)}
              onMute={() => handleMute(n)}
              onSnooze={(preset) => handleSnooze(n, preset)}
            />
          ))}
        </div>
      </section>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center bg-surface border border-default p-0.5 rounded-md">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={cn(
              'px-2.5 py-1 rounded text-xs font-medium transition-colors',
              filter === 'all' ? 'bg-hover text-primary' : 'text-secondary hover:text-primary'
            )}
          >
            Todo
          </button>
          <button
            type="button"
            onClick={() => setFilter('unread')}
            className={cn(
              'px-2.5 py-1 rounded text-xs font-medium transition-colors',
              filter === 'unread' ? 'bg-hover text-primary' : 'text-secondary hover:text-primary'
            )}
          >
            No leídas
          </button>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-secondary hover:text-primary rounded-md hover:bg-hover disabled:opacity-50 transition-colors"
          >
            {markingAll ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCheck className="w-3.5 h-3.5" />
            )}
            Marcar todo leído
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-default rounded-lg">
          <p className="text-secondary text-sm">
            {filter === 'unread' ? 'No tenés notificaciones sin leer.' : 'No tenés notificaciones.'}
          </p>
        </div>
      ) : (
        <>
          {renderGroup('Hoy', todayItems)}
          {renderGroup('Antes', beforeItems)}
        </>
      )}
    </div>
  );
}

export default function InboxPage() {
  const [tab, setTab] = useState<InboxTab>('notifications');
  const { issues: triageIssues } = useTriageIssues();
  const { notifications, loaded, error } = useUserNotifications();
  const triageCount = triageIssues.length;
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <Header title="Inbox" subtitle="Notificaciones e hilados" showViewToggle={false} />

      <div className="px-6 pt-4 shrink-0">
        <div className="inline-flex items-center bg-surface border border-default p-0.5 rounded-md">
          <button
            type="button"
            onClick={() => setTab('notifications')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors',
              tab === 'notifications' ? 'bg-hover text-primary' : 'text-secondary hover:text-primary'
            )}
          >
            Notificaciones
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-accent text-white text-[10px] font-semibold">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab('triage')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors',
              tab === 'triage' ? 'bg-hover text-primary' : 'text-secondary hover:text-primary'
            )}
          >
            Triage
            {triageCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-accent text-white text-[10px] font-semibold">
                {triageCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto max-w-3xl">
        {tab === 'notifications' ? (
          <NotificationsTab notifications={notifications} loaded={loaded} error={error} />
        ) : (
          <TriageQueue />
        )}
      </div>
    </div>
  );
}
