import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
  // General sidebar collapsed state for management pages (defaults to false / open)
  isCollapsed: boolean;
  // POS-specific sidebar open state (defaults to false / collapsed so POS has maximum room)
  isPosSidebarOpen: boolean;
  toggleSidebar: () => void;
  togglePosSidebar: () => void;
  setCollapsed: (collapsed: boolean) => void;
  setPosSidebarOpen: (open: boolean) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isCollapsed: false,
      isPosSidebarOpen: false, // Default collapsed on POS terminal
      toggleSidebar: () =>
        set((state) => ({
          isCollapsed: !state.isCollapsed,
        })),
      togglePosSidebar: () =>
        set((state) => ({
          isPosSidebarOpen: !state.isPosSidebarOpen,
        })),
      setCollapsed: (collapsed: boolean) =>
        set({
          isCollapsed: collapsed,
        }),
      setPosSidebarOpen: (open: boolean) =>
        set({
          isPosSidebarOpen: open,
        }),
    }),
    {
      name: 'soxpos-sidebar-state',
    }
  )
);
