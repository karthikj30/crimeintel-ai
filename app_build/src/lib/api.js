// ============================================================
// CRIMESCOPE AI — API Client
// ============================================================

const BASE = '';
const TIMEOUT = 15000; // 15 s — map/analytics data can be slow

async function fetchJSON(url) {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const res = await fetch(`${BASE}${url}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      // Return null silently — callers should handle null gracefully
      return null;
    }
    throw err;
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

// --- Investigative Intel (7 engines) ---
export async function getIntelOverview() { return fetchJSON('/api/intel/overview'); }
export async function getIntelLinkage() { return fetchJSON('/api/intel/linkage'); }
export async function getIntelGeographic(series) {
  return fetchJSON(`/api/intel/geographic${series ? `?series=${encodeURIComponent(series)}` : ''}`);
}
export async function getIntelNearRepeat() { return fetchJSON('/api/intel/near-repeat'); }
export async function getIntelMules() { return fetchJSON('/api/intel/mules'); }
export async function getIntelSolvability() { return fetchJSON('/api/intel/solvability'); }
export async function getIntelProlific() { return fetchJSON('/api/intel/prolific'); }
export async function getIntelSafeguarding() { return fetchJSON('/api/intel/safeguarding'); }
export async function getIntelSolve(series) {
  return fetchJSON(`/api/intel/solve${series ? `?series=${encodeURIComponent(series)}` : ''}`);
}
export async function getIntelColdCase() { return fetchJSON('/api/intel/cold-case'); }

// --- RAG / Gemini AI ---
export async function postRagFreeChat(message, history = []) {
  const res = await fetch(`${BASE}/api/rag/free-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // If fallback response is present, return it instead of throwing
    if (err.response) return { response: err.response, mode: 'fallback' };
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function uploadRagDocument(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/api/rag/upload`, { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export async function postRagChat(message, sessionId, history = []) {
  const res = await fetch(`${BASE}/api/rag/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId, history }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function deleteRagSession(sessionId) {
  const res = await fetch(`${BASE}/api/rag/sessions/${sessionId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
