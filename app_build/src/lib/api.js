// ============================================================
// CRIMESCOPE AI — API Client
// ============================================================

const BASE = '';
const TIMEOUT = 5000; // 5 second timeout

async function fetchJSON(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
  
  try {
    const res = await fetch(`${BASE}${url}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getIncidents(params = {}) {
  const query = new URLSearchParams(params).toString();
  return fetchJSON(`/api/incidents${query ? '?' + query : ''}`);
}

export async function getIncident(id) {
  return fetchJSON(`/api/incidents/${id}`);
}

export async function getHeatmapData() {
  return fetchJSON('/api/incidents/heatmap');
}

export async function getAnalyticsOverview() {
  return fetchJSON('/api/analytics/overview');
}

export async function getTemporalData() {
  return fetchJSON('/api/analytics/temporal');
}

export async function getCategoryData() {
  return fetchJSON('/api/analytics/categories');
}

export async function getRegionData() {
  return fetchJSON('/api/analytics/regions');
}

export async function getAnomalies() {
  return fetchJSON('/api/analytics/anomalies');
}

export async function getAlerts() {
  return fetchJSON('/api/alerts');
}

export async function acknowledgeAlert(id) {
  const res = await fetch(`${BASE}/api/alerts/${id}/acknowledge`, { method: 'PATCH' });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function searchIncidents(q) {
  return fetchJSON(`/api/search?q=${encodeURIComponent(q)}`);
}
