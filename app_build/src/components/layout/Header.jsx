'use client';
// ============================================================
// CRIMESCOPE AI — Header Component
// ============================================================

import { useState, useEffect } from 'react';
import { Search, Bell, BellRing, PanelRightOpen, PanelRightClose } from 'lucide-react';
import useUIStore from '@/stores/uiStore';
import useAlertStore from '@/stores/alertStore';
import useRealtimeStore from '@/stores/realtimeStore';

export default function Header() {
  const [time, setTime] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const alertPanelOpen = useUIStore(s => s.alertPanelOpen);
  const toggleAlertPanel = useUIStore(s => s.toggleAlertPanel);
  const setView = useUIStore(s => s.setView);
  const unreadCount = useAlertStore(s => s.unreadCount);
  const connected = useRealtimeStore(s => s.connected);
  const eventCount = useRealtimeStore(s => s.eventCount);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchValue.trim()) {
      setView('investigate');
    }
  };

  return (
    <header className="header">
      <div>
        <div className="header-title">CrimeScope AI</div>
        <div className="header-subtitle">Real-Time Intelligence Platform</div>
      </div>

      <div className="header-search">
        <form onSubmit={handleSearch}>
          <div className="search-input-wrapper">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search incidents, locations, crime types..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              id="global-search"
            />
          </div>
        </form>
      </div>

      <div className="header-actions">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: connected ? '#22c55e' : '#ef4444',
            boxShadow: connected ? '0 0 8px rgba(34,197,94,0.5)' : '0 0 8px rgba(239,68,68,0.5)',
            animation: 'pulse-glow 2s ease-in-out infinite',
          }} />
          <span className="header-time text-mono">{connected ? 'LIVE' : 'OFFLINE'}</span>
        </div>

        <span className="header-time text-mono">{time}</span>

        <button className="header-btn" onClick={() => setView('alerts')} id="header-alerts-btn">
          {unreadCount > 0 ? <BellRing size={18} /> : <Bell size={18} />}
          {unreadCount > 0 && (
            <span className="badge-count">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>

        <button className="header-btn" onClick={toggleAlertPanel} id="toggle-alert-panel">
          {alertPanelOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
        </button>
      </div>
    </header>
  );
}
