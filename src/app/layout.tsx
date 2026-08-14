import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pulse — Jira Killer',
  description: 'Gestión de proyectos ultra-rápida, keyboard-first y diseño premium',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full dark antialiased">
      <body className="min-h-full flex flex-col bg-[#08090A] text-[#F7F8F8] selection:bg-[#5E6AD2] selection:text-white">
        {children}
      </body>
    </html>
  );
}
