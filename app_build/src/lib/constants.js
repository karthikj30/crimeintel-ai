// ============================================================
// CRIMESCOPE AI — Constants & Configuration
// ============================================================

export const CRIME_TYPES = [
  { id: 'theft', label: 'Theft', color: '#f59e0b', icon: 'Package' },
  { id: 'assault', label: 'Assault', color: '#ef4444', icon: 'AlertTriangle' },
  { id: 'burglary', label: 'Burglary', color: '#8b5cf6', icon: 'Home' },
  { id: 'cybercrime', label: 'Cybercrime', color: '#06b6d4', icon: 'Monitor' },
  { id: 'accident', label: 'Accident', color: '#f97316', icon: 'Car' },
  { id: 'violence', label: 'Violence', color: '#dc2626', icon: 'Flame' },
  { id: 'fraud', label: 'Fraud', color: '#ec4899', icon: 'CreditCard' },
  { id: 'drug', label: 'Drug Related', color: '#84cc16', icon: 'Pill' },
  { id: 'missing', label: 'Missing Person', color: '#6366f1', icon: 'UserX' },
];

export const SEVERITY_LEVELS = [
  { id: 'critical', label: 'Critical', color: '#ef4444', weight: 4 },
  { id: 'high', label: 'High', color: '#f97316', weight: 3 },
  { id: 'medium', label: 'Medium', color: '#eab308', weight: 2 },
  { id: 'low', label: 'Low', color: '#22c55e', weight: 1 },
];

export const SOURCES = [
  { id: 'news', label: 'News Feed', icon: 'Newspaper', color: '#6366f1' },
  { id: 'twitter', label: 'Twitter/X', icon: 'Twitter', color: '#06b6d4' },
  { id: 'government', label: 'Government', icon: 'Building2', color: '#22c55e' },
  { id: 'web', label: 'Open Web', icon: 'Globe', color: '#f97316' },
];

export const VIEW_TYPES = {
  MAP: 'map',
  ANALYTICS: 'analytics',
  ALERTS: 'alerts',
  INVESTIGATE: 'investigate',
};

export const SOCKET_EVENTS = {
  INCIDENT_NEW: 'incident:new',
  INCIDENT_UPDATED: 'incident:updated',
  ALERT_NEW: 'alert:new',
  ANALYTICS_REFRESH: 'analytics:refresh',
  HEATMAP_UPDATE: 'heatmap:update',
  ALERT_ACKNOWLEDGE: 'alert:acknowledge',
};

export const API_BASE = typeof window !== 'undefined' ? '' : 'http://localhost:3000';

export const HEATMAP_CONFIG = {
  radius: 25,
  blur: 20,
  maxZoom: 17,
  max: 1.0,
  gradient: {
    0.1: '#1a1a6e',
    0.2: '#3b1f8e',
    0.35: '#6366f1',
    0.5: '#8b5cf6',
    0.65: '#f59e0b',
    0.8: '#f97316',
    0.95: '#ef4444',
    1.0: '#dc2626',
  },
};

// New Delhi center coordinates for demo
export const MAP_CENTER = [28.6139, 77.2090];
export const MAP_ZOOM = 12;
// Esri's dark canvas needs no API key. CARTO's basemaps now return an
// "API KEY REQUIRED" placeholder tile without one.
export const MAP_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
export const MAP_LABELS_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
export const MAP_MAX_ZOOM = 16;
export const MAP_ATTRIBUTION = 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors';
