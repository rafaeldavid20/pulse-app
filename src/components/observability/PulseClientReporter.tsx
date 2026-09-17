'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { reportPulseClientError } from '@/lib/argus-client';

function rejectionError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  if (typeof reason === 'string') return new Error(reason);
  return new Error('Promesa rechazada sin detalle en Pulse App');
}

export function PulseClientReporter() {
  const pathname = usePathname();

  useEffect(() => {
    const reportError = (event: ErrorEvent) => {
      void reportPulseClientError(
        event.error instanceof Error ? event.error : new Error(event.message),
        pathname,
      );
    };
    const reportRejection = (event: PromiseRejectionEvent) => {
      void reportPulseClientError(rejectionError(event.reason), pathname);
    };
    window.addEventListener('error', reportError);
    window.addEventListener('unhandledrejection', reportRejection);
    return () => {
      window.removeEventListener('error', reportError);
      window.removeEventListener('unhandledrejection', reportRejection);
    };
  }, [pathname]);

  return null;
}
