'use client';
// ============================================================
// CRIMESCOPE AI — Investigation/Drill-Down View
// ============================================================

import { useEffect, useState } from 'react';
import { Search, MapPin, Clock, ExternalLink, Newspaper, Globe, Building2, Shield, ChevronRight, Brain, Layers, FileText } from 'lucide-react';
import useIncidentStore from '@/stores/incidentStore';
import { searchIncidents } from '@/lib/api';
import { formatTime, formatDateTime, capitalize, getSeverityColor, getCrimeColor, getConfidenceLabel, getConfidenceColor } from '@/lib/utils';

export default function InvestigateView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const { incidents, selectedIncident, relatedIncidents, selectIncident } = useIncidentStore();

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (searchQuery.trim().length < 2) {
      setSearchResults(incidents.slice(0, 30));
      return;
    }
    try {
      const data = await searchIncidents(searchQuery);
      setSearchResults(data.results || []);
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  useEffect(() => {
    setSearchResults(incidents.slice(0, 30));
  }, [incidents]);

  useEffect(() => {
    if (selectedId) {
      selectIncident(selectedId);
    }
  }, [selectedId]);

  const sourceIcons = {
    news: Newspaper,
    twitter: Globe,
    government: Building2,
    web: Globe,
  };

  return (
    <div className="investigate-view" style={{ display: 'flex', gap: 20 }}>
      {/* Left: Search + List */}
      <div style={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={20} style={{ color: 'var(--accent-primary)' }} />
            Investigation Panel
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Drill-down into incidents with source traceability
          </p>
        </div>

        <form onSubmit={handleSearch} style={{ marginBottom: 12 }}>
          <div className="search-input-wrapper">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search by keyword, location, type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="investigate-search"
            />
          </div>
        </form>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {searchResults.map((incident, idx) => (
            <div
              key={incident.id}
              onClick={() => setSelectedId(incident.id)}
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                marginBottom: 6,
                cursor: 'pointer',
                background: selectedId === incident.id ? 'var(--accent-glow)' : 'rgba(255,255,255,0.02)',
                border: selectedId === incident.id ? '1px solid var(--border-accent)' : '1px solid transparent',
                transition: 'all 0.2s',
                animation: `slide-in-up 0.2s ease-out ${idx * 15}ms both`,
              }}
              onMouseEnter={e => {
                if (selectedId !== incident.id)
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              }}
              onMouseLeave={e => {
                if (selectedId !== incident.id)
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
              }}
            >
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <span className={`badge severity-${incident.severity}`}>
                  {incident.severity}
                </span>
                <span style={{
                  padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 500,
                  background: `${getCrimeColor(incident.crime_type)}15`,
                  color: getCrimeColor(incident.crime_type),
                }}>
                  {capitalize(incident.crime_type)}
                </span>
              </div>
              <p style={{
                fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {incident.title}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--text-dim)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <MapPin size={9} /> {incident.location_name}
                </span>
                <span>{formatTime(incident.timestamp)}</span>
              </div>
            </div>
          ))}
          {searchResults.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
              <Search size={28} style={{ opacity: 0.2, marginBottom: 8 }} />
              <p style={{ fontSize: 13 }}>No results found</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Detail Panel */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {selectedIncident ? (
          <div className="incident-detail animate-fade-in">
            <div className="incident-detail-header">
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <span className={`badge severity-${selectedIncident.severity}`}>
                  {selectedIncident.severity}
                </span>
                <span style={{
                  padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                  background: `${getCrimeColor(selectedIncident.crime_type)}20`,
                  color: getCrimeColor(selectedIncident.crime_type),
                  border: `1px solid ${getCrimeColor(selectedIncident.crime_type)}40`,
                }}>
                  {capitalize(selectedIncident.crime_type)}
                </span>
                <span style={{
                  padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 500,
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-muted)',
                }}>
                  {capitalize(selectedIncident.source)}
                </span>
              </div>

              <h3 className="incident-detail-title">{selectedIncident.title}</h3>

              <div className="incident-detail-meta">
                <div className="incident-meta-item">
                  <MapPin size={13} /> {selectedIncident.location_name}
                </div>
                <div className="incident-meta-item">
                  <Clock size={13} /> {formatDateTime(selectedIncident.timestamp)}
                </div>
                <div className="incident-meta-item">
                  <Shield size={13} /> {selectedIncident.region}
                </div>
              </div>
            </div>

            {/* NLP Analysis Section */}
            <div className="glass-card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Brain size={16} style={{ color: 'var(--accent-primary)' }} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>NLP Analysis</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Crime Type
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: getCrimeColor(selectedIncident.crime_type) }}>
                    {capitalize(selectedIncident.crime_type)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>
                    AI Confidence
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: getConfidenceColor(selectedIncident.confidence || 0.85) }}>
                      {Math.round((selectedIncident.confidence || 0.85) * 100)}%
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {getConfidenceLabel(selectedIncident.confidence || 0.85)}
                    </span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Status
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--severity-low)' }}>
                    {capitalize(selectedIncident.status)}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Confidence Meter
                </div>
                <div className="confidence-bar" style={{ height: 8 }}>
                  <div
                    className="confidence-fill"
                    style={{
                      width: `${(selectedIncident.confidence || 0.85) * 100}%`,
                      background: `linear-gradient(to right, ${getConfidenceColor(selectedIncident.confidence || 0.85)}, ${getConfidenceColor(selectedIncident.confidence || 0.85)}80)`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Source Provenance */}
            <div className="glass-card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Layers size={16} style={{ color: '#f97316' }} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>Source Provenance</span>
              </div>
              <div className="source-list">
                <div className="source-item">
                  <div className={`source-icon ${selectedIncident.source}`}>
                    {(() => {
                      const Icon = sourceIcons[selectedIncident.source] || Globe;
                      return <Icon size={16} />;
                    })()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {capitalize(selectedIncident.source)} Source
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                      {selectedIncident.source_url || 'URL not available'}
                    </div>
                  </div>
                  {selectedIncident.source_url && (
                    <ExternalLink size={14} style={{ color: 'var(--text-dim)', cursor: 'pointer' }} />
                  )}
                </div>
              </div>
            </div>

            {/* Coordinates */}
            <div className="glass-card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <MapPin size={16} style={{ color: '#22c55e' }} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>Geolocation</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>Latitude</div>
                  <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'JetBrains Mono', color: 'var(--text-primary)' }}>
                    {selectedIncident.latitude?.toFixed(6)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>Longitude</div>
                  <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'JetBrains Mono', color: 'var(--text-primary)' }}>
                    {selectedIncident.longitude?.toFixed(6)}
                  </div>
                </div>
              </div>
            </div>

            {/* Related Incidents */}
            {relatedIncidents.length > 0 && (
              <div className="glass-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <FileText size={16} style={{ color: 'var(--accent-secondary)' }} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Related Incidents</span>
                </div>
                {relatedIncidents.map(rel => (
                  <div
                    key={rel.id}
                    onClick={() => setSelectedId(rel.id)}
                    style={{
                      padding: '10px 12px',
                      background: 'rgba(255,255,255,0.02)',
                      borderRadius: 8,
                      marginBottom: 6,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: getSeverityColor(rel.severity),
                      flexShrink: 0,
                    }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rel.title}
                      </p>
                      <p style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                        {formatTime(rel.timestamp)} • {rel.location_name}
                      </p>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--text-dim)' }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>
            <div style={{ textAlign: 'center' }}>
              <Search size={48} style={{ opacity: 0.15, marginBottom: 12 }} />
              <p style={{ fontSize: 16, fontWeight: 500 }}>Select an incident to investigate</p>
              <p style={{ fontSize: 13, marginTop: 4, color: 'var(--text-dim)' }}>
                Click on any incident from the list or search by keyword
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
