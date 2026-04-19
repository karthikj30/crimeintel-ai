'use client';
// ============================================================
// CRIMESCOPE AI — Analytics View
// ============================================================

import { useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, AlertTriangle, MapPin, ShieldAlert } from 'lucide-react';
import useAnalyticsStore from '@/stores/analyticsStore';
import { capitalize, getCrimeColor, getSeverityColor } from '@/lib/utils';

const CRIME_COLORS = {
  theft: '#f59e0b', assault: '#ef4444', burglary: '#8b5cf6',
  cybercrime: '#06b6d4', accident: '#f97316', violence: '#dc2626',
  fraud: '#ec4899', drug: '#84cc16', missing: '#6366f1',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div style={{
      background: 'rgba(12, 18, 32, 0.95)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
    }}>
      <p style={{ color: '#f1f5f9', fontWeight: 600, marginBottom: 4 }}>{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color, margin: '2px 0' }}>
          {capitalize(entry.name)}: {entry.value}
        </p>
      ))}
    </div>
  );
};

export default function AnalyticsView() {
  const { temporalData, categoryData, regionData, anomalies, fetchAll, loading } = useAnalyticsStore();

  useEffect(() => {
    fetchAll();
  }, []);

  if (loading && !temporalData) {
    return (
      <div className="analytics-view">
        {[1,2,3,4].map(i => (
          <div key={i} className="glass-card chart-card">
            <div className="loading-pulse" style={{ height: 20, width: '40%', marginBottom: 16 }} />
            <div className="loading-pulse" style={{ height: 250 }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="analytics-view">
      {/* Daily Trend Chart */}
      <div className="glass-card chart-card" style={{ gridColumn: 'span 2' }}>
        <div className="chart-card-header">
          <div>
            <div className="chart-card-title">
              <TrendingUp size={16} style={{ marginRight: 8, color: 'var(--accent-primary)' }} />
              Crime Trend — Last 7 Days
            </div>
            <div className="chart-card-subtitle">Stacked area chart by crime type</div>
          </div>
        </div>
        {temporalData?.dailyData && (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={temporalData.dailyData}>
              <defs>
                {Object.entries(CRIME_COLORS).map(([type, color]) => (
                  <linearGradient key={type} id={`grad-${type}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={color} stopOpacity={0.02}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              {Object.entries(CRIME_COLORS).map(([type, color]) => (
                <Area
                  key={type}
                  type="monotone"
                  dataKey={type}
                  stackId="1"
                  stroke={color}
                  fill={`url(#grad-${type})`}
                  strokeWidth={1.5}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Crime Category Breakdown */}
      <div className="glass-card chart-card">
        <div className="chart-card-header">
          <div>
            <div className="chart-card-title">
              <ShieldAlert size={16} style={{ marginRight: 8, color: 'var(--accent-secondary)' }} />
              Crime Categories
            </div>
            <div className="chart-card-subtitle">Distribution by type</div>
          </div>
        </div>
        {categoryData?.categories && (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={categoryData.categories}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={100}
                paddingAngle={3}
                dataKey="count"
                nameKey="crime_type"
                stroke="none"
              >
                {categoryData.categories.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={getCrimeColor(entry.crime_type)}
                    opacity={0.85}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => capitalize(value)}
                wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Hourly Pattern */}
      <div className="glass-card chart-card">
        <div className="chart-card-header">
          <div>
            <div className="chart-card-title">
              ⏰ Hourly Pattern
            </div>
            <div className="chart-card-subtitle">Crime distribution across 24 hours</div>
          </div>
        </div>
        {temporalData?.hourlyPattern && (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={temporalData.hourlyPattern}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Incidents" radius={[4, 4, 0, 0]}>
                {temporalData.hourlyPattern.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.count > (temporalData.hourlyPattern.reduce((s,e) => s + e.count, 0) / 24 * 1.5)
                      ? '#ef4444' : '#6366f1'}
                    opacity={0.7}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Day of Week */}
      <div className="glass-card chart-card">
        <div className="chart-card-header">
          <div>
            <div className="chart-card-title">
              📅 Day of Week Pattern
            </div>
            <div className="chart-card-subtitle">Weekly crime distribution</div>
          </div>
        </div>
        {temporalData?.dowData && (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={temporalData.dowData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis type="category" dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Incidents" radius={[0, 4, 4, 0]} fill="#8b5cf6" opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Region Risk Scores */}
      <div className="glass-card chart-card">
        <div className="chart-card-header">
          <div>
            <div className="chart-card-title">
              <MapPin size={16} style={{ marginRight: 8, color: '#f97316' }} />
              Region Risk Assessment
            </div>
            <div className="chart-card-subtitle">Composite safety index by area</div>
          </div>
        </div>
        {regionData?.regions && (
          <div style={{ maxHeight: 280, overflowY: 'auto', paddingRight: 8 }}>
            {regionData.regions.map((region, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 0',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 120 }}>
                  {region.region}
                </span>
                <div style={{ flex: 1 }}>
                  <div className="confidence-bar">
                    <div
                      className="confidence-fill"
                      style={{
                        width: `${region.risk_score}%`,
                        background: region.risk_score >= 75 ? '#ef4444'
                          : region.risk_score >= 50 ? '#f97316'
                          : region.risk_score >= 25 ? '#eab308' : '#22c55e',
                      }}
                    />
                  </div>
                </div>
                <span style={{
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'JetBrains Mono, monospace',
                  color: getSeverityColor(region.risk_level),
                  minWidth: 32,
                  textAlign: 'right',
                }}>
                  {region.risk_score}
                </span>
                <span className={`badge severity-${region.risk_level}`}>
                  {capitalize(region.risk_level)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Anomalies */}
      <div className="glass-card chart-card">
        <div className="chart-card-header">
          <div>
            <div className="chart-card-title">
              <AlertTriangle size={16} style={{ marginRight: 8, color: '#ef4444' }} />
              Detected Anomalies
            </div>
            <div className="chart-card-subtitle">AI-flagged unusual patterns</div>
          </div>
        </div>
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          {anomalies && anomalies.length > 0 ? anomalies.map((anomaly, i) => (
            <div key={i} style={{
              padding: '12px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 8,
              marginBottom: 8,
              borderLeft: `3px solid ${getSeverityColor(anomaly.severity)}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className={`badge severity-${anomaly.severity}`}>{anomaly.severity}</span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  {anomaly.type.replace(/_/g, ' ')}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {anomaly.message}
              </p>
            </div>
          )) : (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
              <ShieldAlert size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
              <p style={{ fontSize: 13 }}>No anomalies detected</p>
              <p style={{ fontSize: 11 }}>System is monitoring for unusual patterns</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
