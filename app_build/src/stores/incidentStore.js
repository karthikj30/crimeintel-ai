'use client';
// ============================================================
// CRIMESCOPE AI — Incident Store (Zustand)
// ============================================================

import { create } from 'zustand';
import { getIncidents, getHeatmapData, getIncident } from '@/lib/api';

const useIncidentStore = create((set, get) => ({
  incidents: [],
  selectedIncident: null,
  relatedIncidents: [],
  heatmapData: [],
  filters: {
    type: null,
    severity: null,
    region: null,
    source: null,
  },
  loading: false,
  total: 0,

  fetchIncidents: async (params = {}) => {
    set({ loading: true });
    try {
      const filterParams = {};
      const { filters } = get();
      if (filters.type) filterParams.type = filters.type;
      if (filters.severity) filterParams.severity = filters.severity;
      if (filters.region) filterParams.region = filters.region;
      if (filters.source) filterParams.source = filters.source;

      const data = await getIncidents({ ...filterParams, ...params });
      set({ incidents: data.incidents, total: data.total, loading: false });
    } catch (err) {
      console.error('Failed to fetch incidents:', err);
      set({ loading: false });
    }
  },

  fetchHeatmapData: async () => {
    try {
      const data = await getHeatmapData();
      set({ heatmapData: data.heatmapData });
    } catch (err) {
      console.error('Failed to fetch heatmap data:', err);
    }
  },

  selectIncident: async (id) => {
    if (!id) {
      set({ selectedIncident: null, relatedIncidents: [] });
      return;
    }
    try {
      const data = await getIncident(id);
      set({ selectedIncident: data.incident, relatedIncidents: data.related || [] });
    } catch (err) {
      console.error('Failed to fetch incident:', err);
    }
  },

  addIncident: (incident) => {
    set(state => ({
      incidents: [incident, ...state.incidents].slice(0, 200),
      heatmapData: [
        ...state.heatmapData,
        [incident.latitude, incident.longitude, incident.severity === 'critical' ? 1.0 : 0.5],
      ],
    }));
  },

  setFilter: (key, value) => {
    set(state => ({
      filters: { ...state.filters, [key]: value },
    }));
  },

  clearFilters: () => {
    set({
      filters: { type: null, severity: null, region: null, source: null },
    });
  },
}));

export default useIncidentStore;
