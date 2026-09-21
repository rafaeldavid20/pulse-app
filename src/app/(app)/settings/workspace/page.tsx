'use client';

import React, { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { updateWorkspaceName } from '@/lib/firestore';

export default function WorkspaceSettingsPage() {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const setActiveWorkspace = useAppStore((s) => s.setActiveWorkspace);

  const [name, setName] = useState(activeWorkspace?.name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs the editable field with the store when the workspace changes, not a render loop
    setName(activeWorkspace?.name || '');
  }, [activeWorkspace?.name]);

  const dirty = name.trim() !== '' && name.trim() !== activeWorkspace?.name;

  const handleSave = async () => {
    if (!activeWorkspace || !dirty) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateWorkspaceName(activeWorkspace.id, name.trim());
      setActiveWorkspace(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el workspace.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-5 bg-surface border border-default rounded-xl">
      <h3 className="text-base font-semibold text-primary">General</h3>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-secondary">Nombre del Workspace</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-secondary">URL Slug</label>
        <Input defaultValue={activeWorkspace?.slug || 'pulse'} disabled />
      </div>

      {error && <p className="text-xs text-priority-urgent break-words">{error}</p>}

      <div className="flex items-center justify-end gap-2 pt-2">
        {saved && (
          <span className="flex items-center gap-1 text-xs text-status-done">
            <Check className="w-3.5 h-3.5" /> Guardado
          </span>
        )}
        <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Guardar Cambios'}
        </Button>
      </div>
    </div>
  );
}
