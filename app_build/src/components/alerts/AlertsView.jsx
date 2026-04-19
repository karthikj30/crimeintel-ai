'use client';
// ============================================================
// CRIMESCOPE AI — Full Alerts View
// ============================================================

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, MapPin, Clock, Filter, Bell } from 'lucide-react';
import useAlertStore from '@/stores/alertStore';
import useUIStore from '@/stores/uiStore';
import { formatTime, capitalize, getSeverityColor } from '@/lib/utils';

export default function AlertsView() {
  const { alerts, fetchAlerts, acknowledgeAlert } = useAlertStore();
  const setView = useUIStore(s => s.setView);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchAlerts();
  }, []);

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !a.acknowledged;
    return a.priority === filter;
  });

  return (
    <div className="alerts-view">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{
          fontSize: 20, fontWeight: 700, marginBottom: 4,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Bell size={22} style={{ color: 'var(--accent-primary)' }} />
          Alert Management Center
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Monitor, triage, and acknowledge priority-based incident alerts
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {['all', 'unread', 'critical', 'high', 'medium', 'low'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 16px',
              borderRadius: 20,
              border: filter === f ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
              background: filter === f ? 'var(--accent-glow)' : 'transparent',
              color: filter === f ? 'var(--accent-primary)' : 'var(--text-muted)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {capitalize(f)} {f !== 'all' && f !== 'unread'
              ? `(${alerts.filter(a => a.priority === f).length})`
              : f === 'unread'
              ? `(${alerts.filter(a => !a.acknowledged).length})`
              : `(${alerts.length})`}
          </button>
        ))}
      </div>

      {/* Alert Grid */}
      <div className="alerts-grid">
        {filteredAlerts.map((alert, idx) => (
          <div
            key={alert.id}
            className="glass-card alert-card"
            style={{
              borderLeft: `3px solid ${getSeverityColor(alert.priority)}`,
              opacity: alert.acknowledged ? 0.6 : 1,
              animation: `slide-in-up 0.3s ease-out ${idx * 20}ms both`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className={`badge severity-${alert.priority}`}>
                  {alert.priority === 'critical' && <AlertTriangle size={9} style={{ marginRight: 3 }} />}
                  {alert.priority}
                </span>
                {alert.crime_type && (
                  <span style={{
                    display: 'inline-block', padding: '3px 8px', borderRadius: 20,
                    fontSize: 10, fontWeight: 500, background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text-muted)',
                  }}>
                    {capitalize(alert.crime_type)}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-dim)' }}>
                <Clock size={10} />
                {formatTime(alert.created_at)}
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
              {alert.message}
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {alert.location_name && (
                <span style={{ fontSize: 11, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={11} /> {alert.location_name}
                </span>
              )}
              {!alert.acknowledged ? (
                <button
                  onClick={() => acknowledgeAlert(alert.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '5px 12px', borderRadius: 6,
                    background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                    color: '#22c55e', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <CheckCircle size={12} /> Acknowledge
                </button>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--severity-low)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle size={12} /> Acknowledged
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredAlerts.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-dim)' }}>
          <Bell size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
          <p style={{ fontSize: 14 }}>No alerts match your filter</p>
        </div>
      )}
    </div>
  );
}
