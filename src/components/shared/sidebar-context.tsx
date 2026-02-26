'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface SidebarContextType {
    isSidebarCollapsed: boolean;
    toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebar = () => {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error('useSidebar must be used within SidebarProvider');
    }
    return context;
};

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    const toggleSidebar = () => {
        setIsSidebarCollapsed(!isSidebarCollapsed);
    };

    return (
        <SidebarContext.Provider value={{ isSidebarCollapsed, toggleSidebar }}>
            {children}
        </SidebarContext.Provider>
    );
}
