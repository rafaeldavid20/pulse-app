'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/stores/appStore';
import { createUserWorkspace } from '@/lib/firestore';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const setActiveWorkspace = useAppStore((s) => s.setActiveWorkspace);

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;

    setLoading(true);
    try {
      const { workspace } = await createUserWorkspace(
        user.uid,
        user.email,
        user.displayName,
        name.trim()
      );
      setActiveWorkspace(workspace);
      setName('');
      onClose();
    } catch (err) {
      console.error('Error creating workspace:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Crear nuevo workspace" maxWidth="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[#8A8F98]">Nombre del Workspace</label>
          <Input
            placeholder="e.g. Acme Corp, Mi Empresa, Startup"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[#1C1E22] mt-2">
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" type="submit" disabled={!name.trim() || loading}>
            {loading ? 'Creando...' : 'Crear Workspace'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
