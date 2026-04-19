'use client';
// ============================================================
// CRIMESCOPE AI — Realtime Store (Zustand)
// ============================================================

import { create } from 'zustand';

const useRealtimeStore = create((set) => ({
  connected: false,
  lastEvent: null,
  eventCount: 0,

  setConnected: (connected) => set({ connected }),
  setLastEvent: (event) => set(state => ({
    lastEvent: event,
    eventCount: state.eventCount + 1,
  })),
}));

export default useRealtimeStore;
