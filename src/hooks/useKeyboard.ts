'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';

export function useKeyboard() {
  const router = useRouter();
  const setCmdKOpen = useAppStore((s) => s.setCmdKOpen);
  const setShortcutHelpOpen = useAppStore((s) => s.setShortcutHelpOpen);
  const setCreateIssueOpen = useAppStore((s) => s.setCreateIssueOpen);
  const activeTeam = useAppStore((s) => s.activeTeam);
  
  const issues = useIssueStore((s) => s.issues);
  const selectedIssueId = useIssueStore((s) => s.selectedIssueId);
  const setSelectedIssueId = useIssueStore((s) => s.setSelectedIssueId);
  const peekIssueId = useIssueStore((s) => s.peekIssueId);
  const setPeekIssueId = useIssueStore((s) => s.setPeekIssueId);
  const updateIssue = useIssueStore((s) => s.updateIssue);
  const deleteIssue = useIssueStore((s) => s.deleteIssue);

  // State for key chords (e.g. 'G' then 'I')
  const lastKeyRef = useRef<string | null>(null);
  const chordTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger hotkeys if user is typing in an input/textarea/editable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      // Esc: Close the peek panel (blur-while-typing is handled above)
      if (e.key === 'Escape' && peekIssueId) {
        e.preventDefault();
        setPeekIssueId(null);
        return;
      }

      // Cmd/Ctrl + K: Command palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdKOpen(true);
        return;
      }

      // C: Create Issue
      if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setCreateIssueOpen(true);
        return;
      }

      // ?: Help overlay
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShortcutHelpOpen(true);
        return;
      }

      // Space: Peek Panel
      if (e.key === ' ' && selectedIssueId) {
        e.preventDefault();
        setPeekIssueId(selectedIssueId);
        return;
      }

      // Delete / Backspace: Delete selected issue
      if ((e.key === 'Delete' || (e.key === 'Backspace' && (e.metaKey || e.ctrlKey))) && selectedIssueId) {
        e.preventDefault();
        deleteIssue(selectedIssueId);
        return;
      }

      // J / Down Arrow: Move selection down. When the peek panel is open, it
      // follows along instead of going stale behind the newly-selected row.
      if (e.key.toLowerCase() === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (issues.length === 0) return;
        const activeId = peekIssueId ?? selectedIssueId;
        if (!activeId) {
          setSelectedIssueId(issues[0].id);
          if (peekIssueId) setPeekIssueId(issues[0].id);
        } else {
          const currentIndex = issues.findIndex((i) => i.id === activeId);
          if (currentIndex < issues.length - 1) {
            const nextId = issues[currentIndex + 1].id;
            setSelectedIssueId(nextId);
            if (peekIssueId) setPeekIssueId(nextId);
          }
        }
        return;
      }

      // K / Up Arrow: Move selection up (same peek-follows-along behavior as J).
      if (e.key.toLowerCase() === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (issues.length === 0) return;
        const activeId = peekIssueId ?? selectedIssueId;
        if (!activeId) {
          setSelectedIssueId(issues[0].id);
          if (peekIssueId) setPeekIssueId(issues[0].id);
        } else {
          const currentIndex = issues.findIndex((i) => i.id === activeId);
          if (currentIndex > 0) {
            const prevId = issues[currentIndex - 1].id;
            setSelectedIssueId(prevId);
            if (peekIssueId) setPeekIssueId(prevId);
          }
        }
        return;
      }

      // 1..4: Quick set priority on selected issue
      if (['1', '2', '3', '4', '0'].includes(e.key) && selectedIssueId) {
        e.preventDefault();
        const p = parseInt(e.key, 10) as 0 | 1 | 2 | 3 | 4;
        updateIssue(selectedIssueId, { priority: p });
        return;
      }

      // Navigation Chords: G then Key
      if (e.key.toLowerCase() === 'g') {
        lastKeyRef.current = 'g';
        if (chordTimeoutRef.current) clearTimeout(chordTimeoutRef.current);
        chordTimeoutRef.current = setTimeout(() => {
          lastKeyRef.current = null;
        }, 1000);
        return;
      }

      if (lastKeyRef.current === 'g') {
        const chord = e.key.toLowerCase();
        lastKeyRef.current = null;

        // Antes estas rutas tenían 'eng' hardcodeado, así que en cualquier
        // workspace cuyo primer equipo no fuera ese, G+B y G+P navegaban a un
        // equipo inexistente. Se resuelve contra el equipo activo, igual que el
        // Sidebar, con el mismo fallback.
        const teamId = activeTeam?.id || 'eng';

        if (chord === 'i') {
          e.preventDefault();
          router.push('/inbox');
        } else if (chord === 'm') {
          e.preventDefault();
          router.push('/my-issues');
        } else if (chord === 'b') {
          e.preventDefault();
          router.push(`/team/${teamId}/issues`);
        } else if (chord === 'p') {
          e.preventDefault();
          router.push(`/team/${teamId}/projects`);
        } else if (chord === 'e') {
          e.preventDefault();
          router.push(`/team/${teamId}/epics`);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    issues,
    selectedIssueId,
    peekIssueId,
    setCmdKOpen,
    setCreateIssueOpen,
    setShortcutHelpOpen,
    setPeekIssueId,
    setSelectedIssueId,
    updateIssue,
    deleteIssue,
    router,
    activeTeam,
  ]);
}
