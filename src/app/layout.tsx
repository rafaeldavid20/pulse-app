import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pulse — Orden y Progreso',
  description: 'Gestión de proyectos ultra-rápida, keyboard-first y diseño premium',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full dark antialiased">
      <body className="min-h-full flex flex-col bg-base text-primary selection:bg-accent selection:text-white">
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--color-hover)',
              border: '1px solid var(--color-default)',
              color: 'var(--color-primary)',
            },
          }}
        />
      </body>
    </html>
  );
}
