'use client';

import Sidebar from "@/components/shared/sidebar";
import MobileNav from "@/components/shared/mobile-nav";
import { SidebarProvider, useSidebar } from "@/components/shared/sidebar-context";
import { useMobileKeyboardBack } from "@/components/shared/use-mobile-gestures";

import { useState, useEffect } from 'react';

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { isSidebarCollapsed, toggleSidebar } = useSidebar();
  useMobileKeyboardBack();
  const [isTouchTablet, setIsTouchTablet] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const check = () => {
      const isIPad = /iPad|Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
      const isTabletScreen = window.innerWidth < 1280;
      setIsTouchTablet(isIPad || isTabletScreen);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-white dark:bg-slate-900">
      {/* Sidebar: visible only on desktop */}
      <div className={isTouchTablet ? 'hidden' : 'hidden xl:block'}>
        <Sidebar isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />
      </div>
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 overflow-hidden">
        <main className="flex-1 min-h-0 relative flex flex-col">
          {children}
        </main>
        {/* Mobile / Tablet bottom nav */}
        <MobileNav isTouchTablet={isTouchTablet} />
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <DashboardLayoutInner>
        {children}
      </DashboardLayoutInner>
    </SidebarProvider>
  );
}
