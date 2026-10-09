'use client';

import { useEffect, useState } from 'react';
import { Bot, Code2, ScanSearch } from 'lucide-react';
import type { Issue } from '@/types';

const roles = {
  dev: { label: 'Agente desarrollando', icon: Code2, className: 'agent-activity-dev' },
  qa: { label: 'Agente revisando', icon: ScanSearch, className: 'agent-activity-qa' },
  unknown: { label: 'Agente trabajando', icon: Bot, className: 'agent-activity-unknown' },
};

export function AgentActivityBadge({ activity }: { activity: Issue['agentActivity'] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!activity || !Object.keys(activity).length) return;
    // Expire even without a Firestore update; re-check immediately after tab suspension.
    const refresh = () => setNow(Date.now());
    const timer = setInterval(refresh, 1000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [activity]);

  const activeRoles = new Set(Object.values(activity ?? {})
    .filter((entry) => Date.parse(entry.expiresAt) > now)
    .map((entry) => entry.role === 'dev' || entry.role === 'qa' ? entry.role : 'unknown'));
  return <>{(['dev', 'qa', 'unknown'] as const).filter((role) => activeRoles.has(role)).map((role) => {
    const { label, icon: Icon, className } = roles[role];
    return <span key={role} className={`agent-activity ${className}`}>
      <Icon aria-hidden="true" className="relative z-10 w-3 h-3" />
      <span className="relative z-10">{label}</span>
    </span>;
  })}</>;
}
