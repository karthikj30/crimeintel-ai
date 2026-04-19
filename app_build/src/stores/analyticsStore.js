'use client';
// ============================================================
// CRIMESCOPE AI — Analytics Store (Zustand)
// ============================================================

import { create } from 'zustand';
import { getAnalyticsOverview, getTemporalData, getCategoryData, getRegionData, getAnomalies } from '@/lib/api';

const useAnalyticsStore = create((set) => ({
  overview: null,
  temporalData: null,
  categoryData: null,
  regionData: null,
  anomalies: [],
  loading: false,

  fetchOverview: async () => {
    try {
      const data = await getAnalyticsOverview();
      set({ overview: data });
    } catch (err) {
      console.error('Failed to fetch overview:', err);
    }
  },

  fetchTemporal: async () => {
    try {
      const data = await getTemporalData();
      set({ temporalData: data });
    } catch (err) {
      console.error('Failed to fetch temporal:', err);
    }
  },

  fetchCategories: async () => {
    try {
      const data = await getCategoryData();
      set({ categoryData: data });
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  },

  fetchRegions: async () => {
    try {
      const data = await getRegionData();
      set({ regionData: data });
    } catch (err) {
      console.error('Failed to fetch regions:', err);
    }
  },

  fetchAnomalies: async () => {
    try {
      const data = await getAnomalies();
      set({ anomalies: data.anomalies || [] });
    } catch (err) {
      console.error('Failed to fetch anomalies:', err);
    }
  },

  fetchAll: async () => {
    set({ loading: true });
    const store = useAnalyticsStore.getState();
    await Promise.all([
      store.fetchOverview(),
      store.fetchTemporal(),
      store.fetchCategories(),
      store.fetchRegions(),
      store.fetchAnomalies(),
    ]);
    set({ loading: false });
  },
}));

export default useAnalyticsStore;
