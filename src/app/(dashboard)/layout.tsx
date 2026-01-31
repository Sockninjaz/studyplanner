'use client';

import { useState, createContext, useContext } from 'react';
import Header from "@/components/shared/header";
import Sidebar from "@/components/shared/sidebar";

interface SidebarContextType {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within DashboardLayout');
  }
  return context;
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <SidebarContext.Provider value={{ isSidebarCollapsed, toggleSidebar }}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />
        <div className={`relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden transition-all duration-300 ${
          isSidebarCollapsed ? 'ml-0' : 'lg:ml-0'
        }`}>
          <Header isSidebarCollapsed={isSidebarCollapsed} onToggleSidebar={toggleSidebar} />
          <main>
            <div className={`mx-auto transition-all duration-300 p-4 md:p-6 2xl:p-10 ${
              isSidebarCollapsed ? 'max-w-screen-2xl' : 'max-w-screen-2xl'
            }`}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
