'use client';
// ============================================================
// KSP CRIME INTELLIGENCE — Karnataka Hotspot Map
// Real OSM police stations + FIR incident heat + district clusters
// over dark Karnataka tiles.
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { Flame, Building2, MapPinned } from 'lucide-react';
import { MAP_TILE_URL, MAP_ATTRIBUTION, HEATMAP_CONFIG } from '@/lib/constants';
import { getFirHeatmap, getFirStations, getFirDistricts } from '@/lib/api';

const KA_CENTER = [14.8, 76.3];
const KA_ZOOM = 7;

export default function KarnatakaMap() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layers = useRef({ heat: null, stations: null, districts: null });
  const [ready, setReady] = useState(false);
  const [counts, setCounts] = useState({ incidents: 0, stations: 0 });
  const [show, setShow] = useState({ heat: true, stations: true, districts: true });

  useEffect(() => {
    if (typeof window === 'undefined' || mapInstance.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      try { await import('leaflet.heat'); } catch { /* heat optional */ }
      if (cancelled || !mapRef.current || mapInstance.current) return;

      const map = L.map(mapRef.current, { center: KA_CENTER, zoom: KA_ZOOM, zoomControl: false, attributionControl: true });
      L.tileLayer(MAP_TILE_URL, { attribution: MAP_ATTRIBUTION, subdomains: 'abcd', maxZoom: 19 }).addTo(map);
      L.control.zoom({ position: 'topright' }).addTo(map);
      mapInstance.current = map;
      setReady(true);

      const [heat, stations, districts] = await Promise.all([getFirHeatmap(), getFirStations(), getFirDistricts()]);
      if (cancelled) return;
      setCounts({ incidents: heat.length, stations: stations.length });

      // FIR heat
      if (L.heatLayer) {
        const pts = heat.map((p) => [p.lat, p.lng, p.gravity === 'Heinous' ? 1.0 : 0.55]);
        layers.current.heat = L.heatLayer(pts, { radius: 16, blur: 20, max: 1.4, gradient: HEATMAP_CONFIG.gradient });
        layers.current.heat.addTo(map);
      }

      // Real police stations
      const stationGroup = L.layerGroup();
      for (const s of stations) {
        L.circleMarker([s.lat, s.lon], { radius: 3, color: '#22d3ee', weight: 0.6, fillColor: '#06b6d4', fillOpacity: 0.75 })
          .bindPopup(`<b>${s.name}</b><br/><span style="color:#94a3b8;font-size:11px">Karnataka State Police</span>`)
          .addTo(stationGroup);
      }
      stationGroup.addTo(map);
      layers.current.stations = stationGroup;

      // District clusters
      const distGroup = L.layerGroup();
      const maxCases = Math.max(...districts.map((d) => d.cases), 1);
      for (const d of districts) {
        if (d.lat == null) continue;
        const ratio = d.cases ? d.heinous / d.cases : 0;
        const color = ratio > 0.28 ? '#ef4444' : ratio > 0.2 ? '#f97316' : '#6366f1';
        L.circleMarker([d.lat, d.lng], {
          radius: 8 + (d.cases / maxCases) * 26, color, weight: 1.5, fillColor: color, fillOpacity: 0.18,
        }).bindPopup(`<b>${d.district}</b><br/><span style="font-size:12px">${d.cases} FIRs · ${d.heinous} heinous</span>`)
          .addTo(distGroup);
      }
      distGroup.addTo(map);
      layers.current.districts = distGroup;
    })();

    return () => {
      cancelled = true;
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
    };
  }, []);

  function toggle(key) {
    const map = mapInstance.current; const layer = layers.current[key];
    if (!map || !layer) return;
    const next = !show[key];
    if (next) layer.addTo(map); else map.removeLayer(layer);
    setShow((s) => ({ ...s, [key]: next }));
  }

  return (
    <div className="map-container">
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} id="ksp-map" />

      <div className="map-controls">
        <button className={`map-control-btn ${show.heat ? 'active' : ''}`} onClick={() => toggle('heat')} title="Crime heat"><Flame size={18} /></button>
        <button className={`map-control-btn ${show.stations ? 'active' : ''}`} onClick={() => toggle('stations')} title="Police stations"><Building2 size={18} /></button>
        <button className={`map-control-btn ${show.districts ? 'active' : ''}`} onClick={() => toggle('districts')} title="District clusters"><MapPinned size={18} /></button>
      </div>

      <div className="map-legend">
        <div className="map-legend-title">District risk</div>
        <div className="map-legend-item"><div className="map-legend-color" style={{ background: '#ef4444' }} />High heinous</div>
        <div className="map-legend-item"><div className="map-legend-color" style={{ background: '#f97316' }} />Elevated</div>
        <div className="map-legend-item"><div className="map-legend-color" style={{ background: '#6366f1' }} />Baseline</div>
        <div className="map-legend-item"><div className="map-legend-color" style={{ background: '#06b6d4' }} />Police station</div>
      </div>

      <div className="map-badge">
        <div className="map-badge-dot" />
        <span>{counts.incidents.toLocaleString()} FIRs · {counts.stations} stations · Karnataka</span>
      </div>

      {!ready && <div className="map-loading">Loading Karnataka crime map…</div>}
    </div>
  );
}
