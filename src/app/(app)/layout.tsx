'use client';

import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { AuthGuard } from '@/components/auth/AuthGuard';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen w-screen overflow-hidden bg-[#08090A]">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#08090A]">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
