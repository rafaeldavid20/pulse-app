'use client';

import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { MobileTabBar } from '@/components/layout/MobileTabBar';
import { AuthGuard } from '@/components/auth/AuthGuard';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-[#08090A]">
        {/* Desktop Left Sidebar */}
        <Sidebar />

        {/* Mobile Top Header Bar */}
        <MobileHeader />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#08090A] pb-16 md:pb-0">
          {children}
        </main>

        {/* Mobile Fixed Bottom Tab Bar */}
        <MobileTabBar />
      </div>
    </AuthGuard>
  );
}
