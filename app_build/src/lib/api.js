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

// --- Conversational Assistant (no client timeout; the LLM can take a few seconds) ---
export async function getChatStatus() {
  return fetchJSON('/api/chat/status');
}

export async function postChat(message, sessionId) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// --- Criminal Network ---
export async function getNetworkGraph(max = 110) {
  return fetchJSON(`/api/network/graph?max=${max}`);
}
export async function getNetworkGangs() {
  return fetchJSON('/api/network/gangs');
}
export async function getPerson(id) {
  return fetchJSON(`/api/network/person/${id}`);
}

// --- Karnataka geo + analytics (FIR) ---
export async function getFirStations() { return fetchJSON('/api/fir/stations'); }
export async function getFirHeatmap() { return fetchJSON('/api/fir/heatmap'); }
export async function getFirDistricts() { return fetchJSON('/api/fir/districts'); }
export async function getFirOverview() { return fetchJSON('/api/fir/overview'); }
export async function getFirTemporal() { return fetchJSON('/api/fir/temporal'); }
export async function getFirCategories() { return fetchJSON('/api/fir/categories'); }
export async function getFirDemographics() { return fetchJSON('/api/fir/demographics'); }
export async function getFirHourly() { return fetchJSON('/api/fir/hourly'); }
export async function getFirForecast() { return fetchJSON('/api/fir/forecast'); }
export async function getFirOffenders() { return fetchJSON('/api/fir/offenders'); }
