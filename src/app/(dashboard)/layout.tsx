'use client';

import Sidebar from "@/components/shared/sidebar";
import MobileNav from "@/components/shared/mobile-nav";
import { SidebarProvider, useSidebar } from "@/components/shared/sidebar-context";

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { isSidebarCollapsed, toggleSidebar } = useSidebar();

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-slate-950">
      {/* Sidebar: visible only on desktop */}
      <div className="hidden lg:block">
        <Sidebar isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />
      </div>
      {/* Main content: add bottom padding on mobile for the nav bar */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 overflow-hidden">
        <main className="flex-1 min-h-0 relative pb-20 lg:pb-0">
          {children}
        </main>
      </div>
      {/* Mobile bottom nav */}
      <MobileNav />
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
