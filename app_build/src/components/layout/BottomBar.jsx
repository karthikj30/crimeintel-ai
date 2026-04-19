'use client';
// ============================================================
// CRIMESCOPE AI — Bottom Bar (KPI Cards)
// ============================================================

import { useEffect } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Shield, Activity, MapPin, Crosshair, Zap } from 'lucide-react';
import useAnalyticsStore from '@/stores/analyticsStore';
import useAnimatedValue from '@/hooks/useAnimatedValue';
import { formatNumber } from '@/lib/utils';

function KPICard({ label, value, change, icon: Icon, iconColor, iconBg }) {
  const animatedVal = useAnimatedValue(value || 0);

  return (
    <div className="glass-card kpi-card">
      <div className="kpi-card-header">
        <span className="kpi-card-label">{label}</span>
        <div className="kpi-card-icon" style={{ background: iconBg, color: iconColor }}>
          <Icon size={16} />
        </div>
      </div>
      <div className="kpi-card-value" style={{ color: iconColor }}>
        {formatNumber(animatedVal)}
      </div>
      {change !== undefined && change !== null && (
        <div className={`kpi-card-change ${change >= 0 ? 'positive' : 'negative'}`}>
          {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>{change >= 0 ? '+' : ''}{change}% vs yesterday</span>
        </div>
      )}
    </div>
  );
}

export default function BottomBar() {
  const overview = useAnalyticsStore(s => s.overview);
  const fetchOverview = useAnalyticsStore(s => s.fetchOverview);

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!overview) {
    return (
      <div className="bottom-bar">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="glass-card kpi-card">
            <div className="loading-pulse" style={{ height: 20, width: '60%', marginBottom: 8 }} />
            <div className="loading-pulse" style={{ height: 32, width: '40%', marginBottom: 8 }} />
            <div className="loading-pulse" style={{ height: 14, width: '80%' }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bottom-bar">
      <KPICard
        label="Total Incidents"
        value={overview.totalIncidents}
        change={overview.change24h}
        icon={Shield}
        iconColor="#6366f1"
        iconBg="rgba(99,102,241,0.15)"
      />
      <KPICard
        label="Last 24 Hours"
        value={overview.last24h}
        change={null}
        icon={Activity}
        iconColor="#8b5cf6"
        iconBg="rgba(139,92,246,0.15)"
      />
      <KPICard
        label="Active Alerts"
        value={overview.activeAlerts}
        change={null}
        icon={AlertTriangle}
        iconColor="#f97316"
        iconBg="rgba(249,115,22,0.15)"
      />
      <KPICard
        label="Critical Events"
        value={overview.criticalIncidents}
        change={null}
        icon={Zap}
        iconColor="#ef4444"
        iconBg="rgba(239,68,68,0.15)"
      />
      <KPICard
        label="AI Confidence"
        value={overview.avgConfidence}
        change={null}
        icon={Crosshair}
        iconColor="#22c55e"
        iconBg="rgba(34,197,94,0.15)"
      />
    </div>
  );
}
