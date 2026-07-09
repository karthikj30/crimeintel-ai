'use client';
// ============================================================
// CRIMESCOPE AI — UI Store (Zustand)
// ============================================================

import { create } from 'zustand';

const useUIStore = create((set) => ({
  activeView: 'assistant',
  alertPanelOpen: true,
  modalOpen: false,
  modalContent: null,
  searchOpen: false,
  searchQuery: '',
  role: 'Investigator', // RBAC: Investigator | Analyst | Supervisor | Policymaker

  setView: (view) => set({ activeView: view }),
  toggleAlertPanel: () => set(state => ({ alertPanelOpen: !state.alertPanelOpen })),
  setAlertPanelOpen: (open) => set({ alertPanelOpen: open }),

  openModal: (content) => set({ modalOpen: true, modalContent: content }),
  closeModal: () => set({ modalOpen: false, modalContent: null }),

  setSearchOpen: (open) => set({ searchOpen: open }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setRole: (role) => set({ role }),
}));

export default useUIStore;
