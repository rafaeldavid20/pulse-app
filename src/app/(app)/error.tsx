'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { reportPulseClientError, type ReportableError } from '@/lib/argus-client';

export default function AppError({
  error,
  reset,
}: {
  error: ReportableError;
  reset: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    void reportPulseClientError(error, pathname);
  }, [error, pathname]);

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-default bg-surface p-8 text-center shadow-xl">
        <p className="mb-2 text-sm font-medium text-accent">Pulse</p>
        <h1 className="text-xl font-semibold text-primary">No pudimos cargar esta vista.</h1>
        <p className="mt-3 text-sm text-secondary">El equipo recibió el contexto para investigarlo. Podés intentar de nuevo.</p>
        <button className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white" onClick={reset}>
          Reintentar
        </button>
      </div>
    </div>
  );
}
