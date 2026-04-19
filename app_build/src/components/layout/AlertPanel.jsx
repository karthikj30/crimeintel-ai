'use client';
// ============================================================
// CRIMESCOPE AI — Alert Panel (Right Sidebar)
// ============================================================

import { useEffect } from 'react';
import { MapPin, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import useAlertStore from '@/stores/alertStore';
import useUIStore from '@/stores/uiStore';
import { formatTime, capitalize } from '@/lib/utils';

export default function AlertPanel() {
  const { alerts, fetchAlerts, acknowledgeAlert } = useAlertStore();
  const alertPanelOpen = useUIStore(s => s.alertPanelOpen);
  const setView = useUIStore(s => s.setView);

  useEffect(() => {
    fetchAlerts();
  }, []);

  if (!alertPanelOpen) return null;

  return (
    <aside className="alert-panel">
      <div className="alert-panel-header">
        <div className="alert-panel-title">
          <div className="live-dot" />
          Live Alert Feed
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'JetBrains Mono, monospace' }}>
          {alerts.length} alerts
        </span>
      </div>

      <div className="alert-panel-list">
        {alerts.slice(0, 50).map((alert, idx) => (
          <div
            key={alert.id}
            className={`alert-item ${alert.priority}`}
            onClick={() => {
              if (alert.incident_id) {
                setView('investigate');
              }
            }}
            style={{
              animationDelay: `${idx * 30}ms`,
              opacity: alert.acknowledged ? 0.5 : 1,
            }}
          >
            <div className="alert-item-header">
              <span className="alert-item-type">
                {alert.priority === 'critical' && <AlertTriangle size={10} style={{ marginRight: 4 }} />}
                {capitalize(alert.priority)}
              </span>
              <span className="alert-item-time">{formatTime(alert.created_at)}</span>
            </div>
            <div className="alert-item-message">{alert.message}</div>
            {alert.location_name && (
              <div className="alert-item-location">
                <MapPin size={10} />
                {alert.location_name}
              </div>
            )}
            {!alert.acknowledged && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  acknowledgeAlert(alert.id);
                }}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 4,
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => e.target.style.color = 'var(--severity-low)'}
                onMouseLeave={e => e.target.style.color = 'var(--text-dim)'}
                title="Acknowledge"
              >
                <CheckCircle size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
