'use client';
// ============================================================
// CRIMESCOPE AI — Interactive Heatmap Component
// ============================================================

import { useEffect, useRef, useState } from 'react';
import useIncidentStore from '@/stores/incidentStore';
import { MAP_CENTER, MAP_ZOOM, MAP_TILE_URL, MAP_ATTRIBUTION, HEATMAP_CONFIG } from '@/lib/constants';
import { getSeverityColor, capitalize, formatTime } from '@/lib/utils';

export default function HeatMap() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const heatLayerRef = useRef(null);
  const markersRef = useRef([]);
  const [mapReady, setMapReady] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showHeat, setShowHeat] = useState(true);

  const { incidents, heatmapData, fetchIncidents, fetchHeatmapData } = useIncidentStore();

  useEffect(() => {
    if (typeof window === 'undefined' || mapInstanceRef.current) return;

    let L;
    const initMap = async () => {
      L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      
      // Import leaflet.heat
      try {
        await import('leaflet.heat');
      } catch (e) {
        console.warn('leaflet.heat not loaded, heatmap will be unavailable');
      }

      if (!mapRef.current || mapInstanceRef.current) return;

      const map = L.map(mapRef.current, {
        center: MAP_CENTER,
        zoom: MAP_ZOOM,
        zoomControl: false,
        attributionControl: true,
      });

      L.tileLayer(MAP_TILE_URL, {
        attribution: MAP_ATTRIBUTION,
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: 'topright' }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);

      // Fetch data
      fetchIncidents();
      fetchHeatmapData();
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update heatmap layer
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !heatmapData.length) return;

    const updateHeat = async () => {
      const L = (await import('leaflet')).default;
      
      if (heatLayerRef.current) {
        mapInstanceRef.current.removeLayer(heatLayerRef.current);
      }

      if (showHeat && L.heatLayer) {
        heatLayerRef.current = L.heatLayer(heatmapData, {
          radius: HEATMAP_CONFIG.radius,
          blur: HEATMAP_CONFIG.blur,
          maxZoom: HEATMAP_CONFIG.maxZoom,
          max: HEATMAP_CONFIG.max,
          gradient: HEATMAP_CONFIG.gradient,
        }).addTo(mapInstanceRef.current);
      }
    };

    updateHeat();
  }, [heatmapData, mapReady, showHeat]);

  // Update markers
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    const updateMarkers = async () => {
      const L = (await import('leaflet')).default;

      // Clear existing markers
      markersRef.current.forEach(m => mapInstanceRef.current.removeLayer(m));
      markersRef.current = [];

      if (!showMarkers) return;

      // Show last 50 incidents as markers
      const recentIncidents = incidents.slice(0, 50);

      recentIncidents.forEach(incident => {
        const color = getSeverityColor(incident.severity);

        const icon = L.divIcon({
          className: 'custom-marker',
          html: `
            <div style="
              width: 12px;
              height: 12px;
              background: ${color};
              border-radius: 50%;
              border: 2px solid rgba(255,255,255,0.3);
              box-shadow: 0 0 10px ${color}80, 0 0 20px ${color}40;
              animation: pulse-glow 2s ease-in-out infinite;
            "></div>
          `,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });

        const marker = L.marker([incident.latitude, incident.longitude], { icon });

        const popupContent = `
          <div style="min-width: 200px; font-family: Inter, sans-serif;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
              <span style="
                display: inline-block;
                padding: 2px 8px;
                border-radius: 20px;
                font-size: 10px;
                font-weight: 600;
                text-transform: uppercase;
                background: ${color}25;
                color: ${color};
                border: 1px solid ${color}40;
              ">${incident.severity}</span>
              <span style="
                display: inline-block;
                padding: 2px 8px;
                border-radius: 20px;
                font-size: 10px;
                font-weight: 600;
                background: rgba(255,255,255,0.05);
                color: #94a3b8;
              ">${capitalize(incident.crime_type)}</span>
            </div>
            <p style="font-size: 12px; color: #f1f5f9; margin-bottom: 6px; line-height: 1.4;">
              ${incident.title.substring(0, 120)}${incident.title.length > 120 ? '...' : ''}
            </p>
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #64748b;">
              <span>📍 ${incident.location_name || 'Unknown'}</span>
              <span>${formatTime(incident.timestamp)}</span>
            </div>
            <div style="margin-top: 6px; font-size: 10px; color: #64748b;">
              Source: ${capitalize(incident.source)} • Confidence: ${Math.round((incident.confidence || 0.85) * 100)}%
            </div>
          </div>
        `;

        marker.bindPopup(popupContent, {
          maxWidth: 300,
          className: 'crimescope-popup',
        });

        marker.addTo(mapInstanceRef.current);
        markersRef.current.push(marker);
      });
    };

    updateMarkers();
  }, [incidents, mapReady, showMarkers]);

  return (
    <div className="map-container">
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} id="crime-heatmap" />

      {/* Map Controls Overlay */}
      <div className="map-controls">
        <button
          className={`map-control-btn ${showHeat ? 'active' : ''}`}
          onClick={() => setShowHeat(!showHeat)}
          title="Toggle Heatmap"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" opacity="0.3"/>
            <circle cx="12" cy="12" r="4"/>
          </svg>
        </button>
        <button
          className={`map-control-btn ${showMarkers ? 'active' : ''}`}
          onClick={() => setShowMarkers(!showMarkers)}
          title="Toggle Markers"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </button>
      </div>

      {/* Legend */}
      <div className="map-legend">
        <div className="map-legend-title">Intensity</div>
        <div className="map-legend-item">
          <div className="map-legend-color" style={{ background: '#ef4444' }} />
          Critical
        </div>
        <div className="map-legend-item">
          <div className="map-legend-color" style={{ background: '#f97316' }} />
          High
        </div>
        <div className="map-legend-item">
          <div className="map-legend-color" style={{ background: '#eab308' }} />
          Medium
        </div>
        <div className="map-legend-item">
          <div className="map-legend-color" style={{ background: '#22c55e' }} />
          Low
        </div>
      </div>

      {/* Incident Count */}
      <div style={{
        position: 'absolute',
        top: 16,
        left: 16 + 48 + 12,
        zIndex: 1000,
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(20px)',
        border: 'var(--glass-border)',
        borderRadius: 'var(--radius-md)',
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#22c55e',
          animation: 'pulse-glow 2s ease-in-out infinite',
        }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          {heatmapData.length.toLocaleString()} incidents mapped
        </span>
      </div>
    </div>
  );
}
