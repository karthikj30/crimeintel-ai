'use client';
// ============================================================
// CRIMESCOPE AI — Sidebar Component
// ============================================================

import { Map, BarChart3, Bell, Search, Settings, Shield } from 'lucide-react';
import useUIStore from '@/stores/uiStore';
import useAlertStore from '@/stores/alertStore';
import useRealtimeStore from '@/stores/realtimeStore';

const navItems = [
  { id: 'map', icon: Map, label: 'Heatmap' },
  { id: 'analytics', icon: BarChart3, label: 'Analytics' },
  { id: 'alerts', icon: Bell, label: 'Alerts' },
  { id: 'investigate', icon: Search, label: 'Investigate' },
];

export default function Sidebar() {
  const activeView = useUIStore(s => s.activeView);
  const setView = useUIStore(s => s.setView);
  const connected = useRealtimeStore(s => s.connected);
  const unreadCount = useAlertStore(s => s.unreadCount);

  return (
    <aside className="sidebar no-select">
      <div className="sidebar-logo">
        <Shield size={22} color="white" />
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`sidebar-nav-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => setView(item.id)}
            id={`nav-${item.id}`}
          >
            <item.icon size={20} />
            <span className="tooltip">{item.label}</span>
            {item.id === 'alerts' && unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#ef4444',
                boxShadow: '0 0 6px rgba(239,68,68,0.6)',
              }} />
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <button className="sidebar-nav-item" id="nav-settings">
          <Settings size={20} />
          <span className="tooltip">Settings</span>
        </button>
        <div
          className={`connection-indicator ${connected ? '' : 'disconnected'}`}
          title={connected ? 'Connected' : 'Disconnected'}
        />
      </div>
    </aside>
  );
}
