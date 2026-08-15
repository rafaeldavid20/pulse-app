'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { signInWithEmail, signInWithGoogle, getFirebaseErrorMessage } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signInWithEmail(email.trim(), password);
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
    <div className="min-h-screen bg-[#08090A] flex flex-col items-center justify-center p-4 selection:bg-[#5E6AD2] selection:text-white">
      <div className="w-full max-w-md bg-[#0F1012] border border-[#26292F] rounded-2xl p-8 shadow-2xl flex flex-col gap-6 animate-fade-in-scale">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-[#5E6AD2] flex items-center justify-center text-white text-2xl shadow-lg shadow-[#5E6AD2]/30 mb-2">
            🫀
          </div>
          <h1 className="text-2xl font-bold text-[#F7F8F8] tracking-tight">
            Iniciar Sesión en Pulse
          </h1>
          <p className="text-xs text-[#8A8F98]">
            Gestión de proyectos ultra-rápida y keyboard-first
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-[#F75555]/15 border border-[#F75555]/30 rounded-lg text-xs text-[#F75555] font-medium leading-relaxed">
            {error}
          </div>
        )}

        {/* Google OAuth Button */}
        <Button
          type="button"
          variant="secondary"
          className="w-full justify-center gap-2 py-2.5"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
            />
            <path
              fill="#4285F4"
              d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
            />
            <path
              fill="#FBBC05"
              d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12s.7 2.3 1.9 4.7l3.7-2.9z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
            />
          </svg>
          Continuar con Google
        </Button>

        <div className="relative flex items-center justify-center my-1">
          <hr className="w-full border-[#1C1E22]" />
          <span className="absolute bg-[#0F1012] px-3 text-[11px] text-[#5B616E] uppercase font-mono">
            o con tu email
          </span>
        </div>

        {/* Email Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              placeholder="Ingresa tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit" variant="primary" className="w-full py-2.5 mt-2" disabled={loading}>
            {loading ? 'Verificando credenciales...' : 'Iniciar Sesión'}
          </Button>
        </form>

        {/* Register Redirect */}
        <p className="text-center text-xs text-[#8A8F98]">
          ¿No tienes cuenta?{' '}
          <Link href="/signup" className="text-[#5E6AD2] hover:underline font-medium">
            Regístrate aquí
          </Link>
        </p>
      </div>
    </div>
  );
}
