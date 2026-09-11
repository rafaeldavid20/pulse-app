'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/stores/appStore';
import { inviteUserToWorkspace } from '@/lib/firestore';
import { MemberRole } from '@/types';
import { Check, AlertCircle } from 'lucide-react';

export const InviteMemberModal: React.FC = () => {
  const { user } = useAuth();
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const isInviteMemberOpen = useAppStore((s) => s.isInviteMemberOpen);
  const setInviteMemberOpen = useAppStore((s) => s.setInviteMemberOpen);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('member');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !user) return;

    if (!activeWorkspace) {
      setErrorMsg('No hay un workspace activo seleccionado.');
      return;
    }

    setLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      await inviteUserToWorkspace(
        activeWorkspace.id,
        activeWorkspace.name,
        email.trim(),
        role,
        user.uid,
        user.displayName || user.email
      );

      setSuccessMsg(`¡Invitación enviada exitosamente a ${email.trim()}!`);
      setEmail('');
      setTimeout(() => {
        setSuccessMsg('');
        setErrorMsg('');
        setInviteMemberOpen(false);
      }, 2000);
    } catch (err: any) {
      console.error('Error inviting member:', err);
      setErrorMsg(err?.message || 'Error al enviar la invitación. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isInviteMemberOpen}
      onClose={() => {
        setErrorMsg('');
        setSuccessMsg('');
        setInviteMemberOpen(false);
      }}
      title={`Invitar miembro a ${activeWorkspace?.name || 'Workspace'}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {errorMsg && (
          <div className="p-3 bg-priority-urgent/15 border border-priority-urgent/30 rounded-lg text-xs text-priority-urgent flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg ? (
          <div className="p-4 bg-success/15 border border-success/30 rounded-lg text-xs text-success flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-secondary">
                Correo electrónico del invitado
              </label>
              <Input
                type="email"
                placeholder="colaborador@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-secondary">Rol en el workspace</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as MemberRole)}
                className="bg-elevated border border-default text-primary text-xs rounded-md p-2 outline-none cursor-pointer"
              >
                <option value="member">Miembro (Crear y editar issues)</option>
                <option value="admin">Administrador (Gestionar miembros y proyectos)</option>
              </select>
            </div>

            <p className="text-[11px] text-tertiary">
              Si el usuario ya se ha registrado en Pulse, se unirá inmediatamente a tu workspace. Si aún no tiene cuenta, verá la invitación al registrarse.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-subtle mt-2">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setSuccessMsg('');
                  setInviteMemberOpen(false);
                }}
              >
                Cancelar
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={!email.trim() || loading}>
                {loading ? 'Enviando...' : 'Enviar Invitación'}
              </Button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
};
