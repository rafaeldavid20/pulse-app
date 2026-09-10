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
      <body className="min-h-full flex flex-col bg-[#08090A] text-[#F7F8F8] selection:bg-[#5E6AD2] selection:text-white">
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1E2024',
              border: '1px solid #26292F',
              color: '#F7F8F8',
            },
          }}
        />
      </body>
    </html>
  );
}
