'use client';
// ============================================================
// CRIMESCOPE AI — Alert Store (Zustand)
// ============================================================

import { create } from 'zustand';
import { getAlerts, acknowledgeAlert as ackAlertAPI } from '@/lib/api';

const useAlertStore = create((set, get) => ({
  alerts: [],
  unreadCount: 0,
  loading: false,

  fetchAlerts: async () => {
    set({ loading: true });
    try {
      const data = await getAlerts();
      set({ alerts: data.alerts, unreadCount: data.unreadCount, loading: false });
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
      set({ loading: false });
    }
  },

  addAlert: (alert) => {
    set(state => ({
      alerts: [alert, ...state.alerts].slice(0, 100),
      unreadCount: state.unreadCount + 1,
    }));
  },

  acknowledgeAlert: async (id) => {
    try {
      await ackAlertAPI(id);
      set(state => ({
        alerts: state.alerts.map(a => a.id === id ? { ...a, acknowledged: 1 } : a),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  },
}));

export default useAlertStore;
