'use client';

import React from 'react';
import { Header } from '@/components/layout/Header';
import { Inbox, CheckCircle2, MessageSquare, Tag } from 'lucide-react';
import { formatTimeAgo } from '@/lib/utils';

export default function InboxPage() {
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
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <Header title="Inbox" subtitle="Notificaciones e hilados" showViewToggle={false} />

      <div className="flex-1 p-6 overflow-y-auto max-w-3xl">
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
      </div>
    </div>
  );
}
