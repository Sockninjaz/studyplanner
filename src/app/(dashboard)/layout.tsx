'use client';

import Sidebar from "@/components/shared/sidebar";
import { SidebarProvider, useSidebar } from "@/components/shared/sidebar-context";

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { isSidebarCollapsed, toggleSidebar } = useSidebar();

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 overflow-hidden">
        <main className="flex-1 min-h-0 relative">
          {children}
        </main>
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
