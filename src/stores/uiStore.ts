/**
 * UI Store - Manages application UI state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEYS } from '@/utils/constants';

type Tab = 'insights' | 'chat' | 'contracts' | 'trends';
type Theme = 'light' | 'dark' | 'system';

interface UIState {
  // Navigation
  activeTab: Tab;
  sidebarExpanded: boolean;

  // Modals
  showApiKeyModal: boolean;
  showNewsPanel: boolean;
  showContractDetail: boolean;

  // Theme
  theme: Theme;

  // News search state
  newsSearchQuery: string;
  newsContractId: string | null;

  // Actions
  setActiveTab: (tab: Tab) => void;
  toggleSidebar: () => void;
  setSidebarExpanded: (expanded: boolean) => void;
  setShowApiKeyModal: (show: boolean) => void;
  setShowNewsPanel: (show: boolean) => void;
  setShowContractDetail: (show: boolean) => void;
  setTheme: (theme: Theme) => void;
  openNewsSearch: (contractId: string, query: string) => void;
  closeNewsSearch: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeTab: 'insights',
      sidebarExpanded: true,
      showApiKeyModal: false,
      showNewsPanel: false,
      showContractDetail: false,
      theme: 'light',
      newsSearchQuery: '',
      newsContractId: null,

      setActiveTab: (tab) => set({ activeTab: tab }),

      toggleSidebar: () =>
        set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),

      setSidebarExpanded: (expanded) => set({ sidebarExpanded: expanded }),

      setShowApiKeyModal: (show) => set({ showApiKeyModal: show }),

      setShowNewsPanel: (show) => set({ showNewsPanel: show }),

      setShowContractDetail: (show) => set({ showContractDetail: show }),

      setTheme: (theme) => {
        // Apply theme to document
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else if (theme === 'light') {
          document.documentElement.classList.remove('dark');
        } else {
          // System preference
          if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
        set({ theme });
      },

      openNewsSearch: (contractId, query) =>
        set({
          showNewsPanel: true,
          newsContractId: contractId,
          newsSearchQuery: query,
        }),

      closeNewsSearch: () =>
        set({
          showNewsPanel: false,
          newsContractId: null,
          newsSearchQuery: '',
        }),
    }),
    {
      name: STORAGE_KEYS.USER_PREFERENCES,
      partialize: (state) => ({
        theme: state.theme,
        sidebarExpanded: state.sidebarExpanded,
      }),
    }
  )
);

// Selector hooks
export const useActiveTab = () => useUIStore((state) => state.activeTab);
export const useTheme = () => useUIStore((state) => state.theme);
