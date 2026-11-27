'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IssuePeekBody } from '@/components/issues/IssuePeekPanel';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';

export default function IssuePage({ params }: { params: Promise<{ issueId: string }> }) {
  const { issueId } = use(params);
  const router = useRouter();
  const workspaceId = useAppStore(s => s.activeWorkspace?.id);
  const members = useAppStore(s => s.members);
  const issues = useIssueStore(s => s.issues);
  const loaded = useIssueStore(s => s.issuesLoaded);
  const error = useIssueStore(s => s.issuesError);
  const updateIssue = useIssueStore(s => s.updateIssue);
  const deleteIssue = useIssueStore(s => s.deleteIssue);
  const issue = issues.find(item => item.id === issueId && item.workspaceId === workspaceId);

  if (error) return <p role="alert" className="p-6">{error}</p>;
  if (!loaded) return <p role="status" className="p-6">Cargando issue…</p>;
  if (!issue) return <div className="p-6"><p>La issue no está disponible en este workspace o no tenés acceso.</p><Link href="/my-issues" className="text-accent hover:underline">Ir a Mis issues</Link></div>;
  return <IssuePeekBody key={issue.id} fullPage issue={issue} members={members} updateIssue={updateIssue} deleteIssue={deleteIssue} onClose={() => router.push('/my-issues')} onOpenIssue={id => router.push(`/issues/${encodeURIComponent(id)}`)} />;
}
