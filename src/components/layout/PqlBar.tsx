'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { tokenize, type Diagnostic } from '@/lib/pql';
import { validatePql } from '@/lib/pql-validation';
import { filtersToPql, pqlToFilters } from '@/lib/pql-filter-conversion';
import { completePql, type Suggestion } from '@/lib/pql-completion';
import { usePqlContext } from '@/hooks/usePqlContext';
import { usePqlAgentStatus } from '@/hooks/usePqlAgentStatus';
import { useAppStore } from '@/stores/appStore';
import { useIssueStore } from '@/stores/issueStore';
import { useFilteredIssues } from '@/hooks/useFilteredIssues';
import type { Issue } from '@/types';

const EMPTY_ISSUES: Issue[] = [];

export function PqlBar({ issues = EMPTY_ISSUES }: { issues?: Issue[] }) {
  const mode = useAppStore(s => s.filterMode);
  const draft = useAppStore(s => s.pqlDraft);
  const applied = useAppStore(s => s.pqlApplied);
  const filters = useAppStore(s => s.filterState);
  const sortBy = useAppStore(s => s.sortBy);
  const setMode = useAppStore(s => s.setFilterMode);
  const setDraft = useAppStore(s => s.setPqlDraft);
  const setApplied = useAppStore(s => s.setPqlApplied);
  const setView = useAppStore(s => s.setViewState);
  const resetFilters = useAppStore(s => s.resetFilters);
  const groupBy = useAppStore(s => s.groupBy);
  const loaded = useIssueStore(s => s.issuesLoaded);
  const error = useIssueStore(s => s.issuesError);
  const catalogReady = useAppStore(s => s.workspaceCatalogReady);
  const catalogError = useAppStore(s => s.workspaceCatalogError);
  const context = usePqlContext();
  const agents = usePqlAgentStatus();
  const pathname = usePathname();
  const matches = useFilteredIssues(issues);
  const appliedScope = useAppStore(s => s.pqlScope);
  const evaluatedAt = useAppStore(s => s.pqlEvaluatedAt);
  const hasApplied = applied !== null && !!evaluatedAt && appliedScope === `${context.workspaceId}:${context.actorId}:${pathname}`;
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [conversionError, setConversionError] = useState('');
  const [notice, setNotice] = useState('');
  const [cursor, setCursor] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const suggestionIds = useMemo(() => {
    const scoped = issues.filter(issue => issue.workspaceId === context.workspaceId && (!context.teamId || issue.teamId === context.teamId));
    return {
      issues: new Set(scoped.map(issue => issue.id)),
      // Related entities can sit outside the route (e.g. an epic is never a
      // cycle item) while still being meaningful predicates for its issues.
      epics: new Set(scoped.flatMap(issue => issue.epicId ? [issue.epicId] : [])),
      parents: new Set(scoped.flatMap(issue => issue.parentId ? [issue.parentId] : [])),
    };
  }, [issues, context.workspaceId, context.teamId]);
  const suggestions = useMemo(() => {
    const teamRoute = /^\/team\/([^/]+)(?:\/|$)/.exec(pathname);
    // Never fall back to workspace-wide suggestions for an unauthorized team route.
    if (!agents.ready || !catalogReady || catalogError || (teamRoute && teamRoute[1] !== context.teamId)) return [];
    const detailRoute = /^\/team\/[^/]+\/(projects|cycles)\/([^/]+)\/?$/.exec(pathname);
    const scope = detailRoute?.[1] === 'projects' ? { projectId: detailRoute[2] }
      : detailRoute?.[1] === 'cycles' ? { cycleId: detailRoute[2] } : {};
    return completePql(draft, cursor, context, suggestionIds.issues, {
      ...scope, referencedEpicIds: suggestionIds.epics, referencedParentIds: suggestionIds.parents,
    });
  }, [draft, cursor, context, suggestionIds, agents.ready, catalogReady, catalogError, pathname]);
  const highlighted = useMemo(() => {
    const lexical = tokenize(draft);
    if (!lexical.ok) return draft;
    let previous = 0;
    return lexical.tokens.filter(token => token.kind !== 'eof').map((token, index) => {
      const gap = draft.slice(previous, token.start); previous = token.end;
      const keyword = token.kind === 'word' && /^(and|or|not|in|is|empty|order|by|asc|desc)$/i.test(token.value);
      const color = keyword ? 'text-accent' : token.kind === 'string' ? 'text-status-done' : token.kind === 'number' ? 'text-priority-high' : 'text-primary';
      return <span key={`${token.start}-${index}`}>{gap}<span className={color}>{draft.slice(token.start, token.end)}</span></span>;
    });
  }, [draft]);

  useEffect(() => {
    if (mode !== 'pql' || !loaded || error || !catalogReady || catalogError || !agents.ready || !context.workspaceId) return;
    const timer = window.setTimeout(() => {
      const evaluatedAt = new Date().toISOString();
      const result = validatePql(draft, { ...context, now: evaluatedAt });
      if (!result.ok) setDiagnostic(result.diagnostic);
      else { setDiagnostic(null); setApplied(draft, `${context.workspaceId}:${context.actorId}:${pathname}`, evaluatedAt); }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [mode, draft, loaded, error, catalogReady, catalogError, agents.ready, context, pathname, setApplied]);

  const toFilters = () => {
    if (mode === 'filters') return;
    const converted = pqlToFilters(draft, { ...context, now: new Date().toISOString() });
    if (!converted.ok) { setConversionError(converted.reason); return; }
    setConversionError('');
    setView({ filters: converted.filters, sortBy: converted.sortBy, groupBy, mode: 'filters' });
  };
  const insertSuggestion = (suggestion: Suggestion) => {
    const text = draft.slice(0, suggestion.start) + suggestion.insert + draft.slice(suggestion.end);
    const position = suggestion.start + suggestion.insert.length;
    setDraft(text); setCursor(position); setMenuOpen(false); setSelected(0);
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.setSelectionRange(position, position); });
  };
  return <div className="border-b border-subtle bg-base px-4 sm:px-6 py-2 space-y-2">
    <div className="flex items-center gap-2">
      <div className="flex rounded-md border border-default text-xs" role="group" aria-label="Modo de filtrado">
        <button type="button" aria-pressed={mode === 'filters'} className="px-2 py-1" onClick={toFilters}>Filtros</button>
        <button type="button" aria-pressed={mode === 'pql'} className="px-2 py-1" onClick={() => { if (mode === 'filters') { setConversionError(''); setNotice(sortBy === 'manual' || sortBy === 'estimate' ? 'PQL usa el orden predeterminado: creación descendente.' : ''); setMode('pql', filtersToPql(filters, sortBy)); } }}>PQL</button>
      </div>
      {mode === 'pql' && <button type="button" className="text-xs text-secondary" onClick={() => { resetFilters(); setDraft(''); }}>Limpiar</button>}
      <span className="text-xs text-tertiary">Fechas en UTC</span>
      {mode === 'pql' && <details className="text-xs text-secondary"><summary className="cursor-pointer">Ayuda PQL</summary><p>Campos: status, priority, type, assignee, creator, project, parent, epic, team, cycle, label, created, updated, due, agent.state, git.prState, review.state, review.reviewer, review.verdict y text. Operadores: =, !=, &lt;, &lt;=, &gt;, &gt;=, IN, NOT IN, IS EMPTY y ~ según el tipo. Funciones: me(), now(), startOfWeek(), currentCycle() y endOfCycle(). Las fechas son UTC; -7d indica siete días antes de ahora.</p></details>}
    </div>
    {mode === 'pql' && <>
      {notice && <p className="text-xs text-secondary">{notice}</p>}
      <label className="block text-xs text-secondary" htmlFor="pql-query">Consulta PQL</label>
      <div className="relative rounded-md bg-surface">
        <div ref={highlightRef} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre px-[9px] py-[5px] font-mono text-sm">{highlighted}</div>
        <input ref={inputRef} id="pql-query" value={draft} onChange={e => { setDiagnostic(null); setDraft(e.target.value); setCursor(e.target.selectionStart ?? e.target.value.length); setSelected(0); setMenuOpen(true); }} onScroll={e => { if (highlightRef.current) highlightRef.current.scrollLeft = e.currentTarget.scrollLeft; }} onSelect={e => setCursor(e.currentTarget.selectionStart ?? 0)} onFocus={() => setMenuOpen(true)} onBlur={() => setMenuOpen(false)} onKeyDown={e => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Escape' && menuOpen) { e.preventDefault(); setMenuOpen(false); }
          else if (menuOpen && suggestions.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); setSelected(i => (i + (e.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length); }
          else if (menuOpen && suggestions.length && (e.key === 'Enter' || e.key === 'Tab')) { e.preventDefault(); insertSuggestion(suggestions[Math.min(selected, suggestions.length - 1)]); }
          else if (e.key === 'Enter') e.preventDefault();
        }} spellCheck={false} role="combobox" aria-expanded={menuOpen && suggestions.length > 0} aria-controls="pql-suggestions" aria-activedescendant={menuOpen && suggestions.length ? `pql-option-${Math.min(selected, suggestions.length - 1)}` : undefined} aria-autocomplete="list" aria-invalid={!!diagnostic} aria-describedby="pql-message" className="relative w-full rounded-md border border-default bg-transparent px-2 py-1 font-mono text-sm text-transparent placeholder:text-tertiary" style={{ caretColor: 'var(--color-primary)' }} placeholder="status = todo AND assignee = me()" />
        {menuOpen && suggestions.length > 0 && <ul id="pql-suggestions" role="listbox" className="absolute z-50 max-h-48 overflow-auto rounded-md border border-default bg-surface shadow-lg">
          {suggestions.map((suggestion, index) => <li key={`${suggestion.label}-${index}`} id={`pql-option-${index}`} role="option" aria-selected={index === selected} className={`cursor-pointer px-3 py-1 text-xs ${index === selected ? 'bg-hover' : ''}`} onMouseDown={e => { e.preventDefault(); insertSuggestion(suggestion); }}>{suggestion.label}</li>)}
        </ul>}
      </div>
      <p id="pql-message" role="status" className="text-xs text-secondary">
        {error ? `Error al cargar issues: ${error}` : catalogError ? catalogError : agents.error ? 'No se pudieron cargar los agentes del workspace.' : !loaded || !catalogReady || !agents.ready ? 'Cargando issues y catálogos…' : diagnostic ? `Línea ${diagnostic.line}, columna ${diagnostic.column}: ${diagnostic.message}${applied !== null ? ' Resultados de la última consulta válida.' : ''}` : draft !== applied ? 'Evaluando consulta…' : 'Consulta aplicada.'}
        {!error && !catalogError && !agents.error && agents.ready && loaded && catalogReady && hasApplied && ` ${matches.length} ${matches.length === 1 ? 'coincidencia' : 'coincidencias'}${draft !== applied ? ' de la última consulta válida' : ''}.`}
      </p>
      {diagnostic && <p className="break-all font-mono text-xs text-secondary" aria-hidden="true">{draft.slice(0, diagnostic.start)}<mark>{draft.slice(diagnostic.start, diagnostic.end) || ' '}</mark>{draft.slice(diagnostic.end)}</p>}
    </>}
    {conversionError && <p role="alert" className="text-xs text-secondary">{conversionError} <button type="button" onClick={() => { resetFilters(); setMode('filters'); setConversionError(''); }}>Restablecer filtros</button></p>}
  </div>;
}
