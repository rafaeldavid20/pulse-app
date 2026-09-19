'use client';

import React, { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { CheckCircle2, MessageSquare } from 'lucide-react';
import { formatTimeAgo, cn } from '@/lib/utils';
import { useTriageIssues } from '@/hooks/useTriageIssues';
import { TriageQueue } from '@/components/issues/TriageQueue';

type InboxTab = 'notifications' | 'triage';

function NotificationsTab() {
  const notifications = [
    {
      id: 'n-1',
      title: 'Sofia Chen te asignó a ENG-102',
      subtitle: 'Diseñar arquitectura local-first para mutaciones optimistas',
      time: new Date(Date.now() - 3600000 * 2).toISOString(),
      read: false,
      icon: CheckCircle2,
    },
    {
      id: 'n-2',
      title: 'Lucas Mateo comentó en ENG-101',
      subtitle: '"Revisé la configuración de Firebase Auth y funciona bien."',
      time: new Date(Date.now() - 3600000 * 5).toISOString(),
      read: true,
      icon: MessageSquare,
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      {notifications.map((n) => {
        const Icon = n.icon;
        return (
          <div
            key={n.id}
            className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
              !n.read
                ? 'bg-elevated border-accent/40 shadow-sm'
                : 'bg-surface border-subtle opacity-80'
            }`}
          >
            <div className="p-2 rounded-lg bg-hover text-accent shrink-0 mt-0.5">
              <Icon className="w-4 h-4" />
            </div>

            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-primary">
                  {n.title}
                </h4>
                <span className="text-xs text-tertiary shrink-0 font-mono">
                  {formatTimeAgo(n.time)}
                </span>
              </div>
              <p className="text-xs text-secondary truncate">{n.subtitle}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function InboxPage() {
  const [tab, setTab] = useState<InboxTab>('notifications');
  const { issues: triageIssues } = useTriageIssues();
  const triageCount = triageIssues.length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <Header title="Inbox" subtitle="Notificaciones e hilados" showViewToggle={false} />

      <div className="px-6 pt-4 shrink-0">
        <div className="inline-flex items-center bg-surface border border-default p-0.5 rounded-md">
          <button
            type="button"
            onClick={() => setTab('notifications')}
            className={cn(
              'px-3 py-1.5 rounded text-xs font-medium transition-colors',
              tab === 'notifications' ? 'bg-hover text-primary' : 'text-secondary hover:text-primary'
            )}
          >
            Notificaciones
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
        {tab === 'notifications' ? <NotificationsTab /> : <TriageQueue />}
      </div>
    </div>
  );
}
