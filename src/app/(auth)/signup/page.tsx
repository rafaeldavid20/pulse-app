'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { signUpWithEmail, signInWithGoogle, getFirebaseErrorMessage } from '@/lib/auth';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signUpWithEmail(email.trim(), password, name.trim(), workspaceName.trim());
      router.push('/team/eng/issues');
    } catch (err: any) {
      const msg = getFirebaseErrorMessage(err?.code || err?.message);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
      router.push('/team/eng/issues');
    } catch (err: any) {
      const msg = getFirebaseErrorMessage(err?.code || err?.message);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08090A] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0F1012] border border-[#26292F] rounded-2xl p-8 shadow-2xl flex flex-col gap-6 animate-fade-in-scale">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-[#5E6AD2] flex items-center justify-center text-white text-2xl shadow-lg shadow-[#5E6AD2]/30 mb-2">
            🫀
          </div>
          <h1 className="text-2xl font-bold text-[#F7F8F8] tracking-tight">
            Crear cuenta en Pulse
          </h1>
          <p className="text-xs text-[#8A8F98]">
            Crea tu workspace y empieza a gestionar proyectos con tu equipo
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-[#F75555]/15 border border-[#F75555]/30 rounded-lg text-xs text-[#F75555] font-medium leading-relaxed">
            {error}
          </div>
        )}

        <Button
          type="button"
          variant="secondary"
          className="w-full justify-center gap-2 py-2.5"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          Registrarse con Google
        </Button>

        <div className="relative flex items-center justify-center my-1">
          <hr className="w-full border-[#1C1E22]" />
          <span className="absolute bg-[#0F1012] px-3 text-[11px] text-[#5B616E] uppercase font-mono">
            o con tu email
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#8A8F98]">Nombre completo</label>
            <Input
              type="text"
              placeholder="Rafael Rodriguez"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#8A8F98]">Correo electrónico</label>
            <Input
              type="email"
              placeholder="tu@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#8A8F98]">Contraseña</label>
            <Input
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#8A8F98]">Nombre de tu Workspace (opcional)</label>
            <Input
              type="text"
              placeholder="e.g. Acme Studio, Startup Dev"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
            />
          </div>

          <Button type="submit" variant="primary" className="w-full py-2.5 mt-2" disabled={loading}>
            {loading ? 'Creando cuenta y workspace...' : 'Crear Cuenta y Workspace'}
          </Button>
        </form>

        <p className="text-center text-xs text-[#8A8F98]">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-[#5E6AD2] hover:underline font-medium">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
