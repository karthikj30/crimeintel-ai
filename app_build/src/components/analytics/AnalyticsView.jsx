'use client';
// ============================================================
// KSP CRIME INTELLIGENCE — Analytics Dashboard (Karnataka FIR)
// Temporal trends, crime categories, socio-demographic insights,
// time-of-day patterns, predictive hotspots and offender risk.
// ============================================================

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { FileText, Users, Gavel, ShieldAlert, Banknote, UserCheck } from 'lucide-react';
import {
  getFirOverview, getFirTemporal, getFirCategories, getFirDemographics,
  getFirHourly, getFirForecast, getFirOffenders,
} from '@/lib/api';

const C = ['#6366f1', '#06b6d4', '#f59e0b', '#22c55e', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6', '#eab308', '#f97316'];
const AXIS = { fill: '#94a3b8', fontSize: 11 };
const TT = { contentStyle: { background: '#131b2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12, color: '#f1f5f9' }, labelStyle: { color: '#94a3b8' }, cursor: { fill: 'rgba(255,255,255,0.04)' } };

function Card({ title, children, wide }) {
  return (
    <div className={`an-card ${wide ? 'an-wide' : ''}`}>
      <div className="an-card-title">{title}</div>
      <div className="an-chart">{children}</div>
    </div>
  );
}

export default function AnalyticsView() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    Promise.all([getFirOverview(), getFirTemporal(), getFirCategories(), getFirDemographics(), getFirHourly(), getFirForecast(), getFirOffenders()])
      .then(([overview, temporal, categories, demographics, hourly, forecast, offenders]) =>
        setD({ overview, temporal, categories, demographics, hourly, forecast, offenders }))
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="an-view"><div className="an-status err">Analytics unavailable ({err}). Is the backend running on :3000?</div></div>;
  if (!d) return <div className="an-view"><div className="an-status">Loading Karnataka crime analytics…</div></div>;

  const t = d.overview.totals;
  const tiles = [
    { icon: FileText, label: 'Total FIRs', value: t.cases, color: '#6366f1' },
    { icon: Users, label: 'Accused', value: t.accused, color: '#06b6d4' },
    { icon: UserCheck, label: 'Arrests', value: t.arrests, color: '#22c55e' },
    { icon: Gavel, label: 'Chargesheets', value: t.chargesheets, color: '#8b5cf6' },
    { icon: ShieldAlert, label: 'Habitual offenders', value: t.habitualOffenders, color: '#ef4444' },
    { icon: Banknote, label: 'Suspicious txns', value: t.suspiciousTxns, color: '#f59e0b' },
  ];

  return (
    <div className="an-view">
      <div className="an-header">
        <div>
          <h2>Crime Analytics &amp; Insights</h2>
          <p>Karnataka State Police · {t.cases.toLocaleString()} FIRs across {t.districts} districts &amp; {t.stations} stations</p>
        </div>
      </div>

      <div className="an-scroll">
        <div className="an-tiles">
          {tiles.map((tile) => (
            <div key={tile.label} className="an-tile">
              <div className="an-tile-icon" style={{ color: tile.color, background: `${tile.color}1e` }}><tile.icon size={18} /></div>
              <div><div className="an-tile-value">{tile.value.toLocaleString()}</div><div className="an-tile-label">{tile.label}</div></div>
            </div>
          ))}
        </div>

        <div className="an-grid">
          <Card title="Crime trend — monthly FIRs (24 months)" wide>
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={d.temporal}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="month" tick={AXIS} axisLine={{ stroke: '#1e293b' }} tickLine={false} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} />
                <Tooltip {...TT} />
                <Line type="monotone" dataKey="cases" stroke="#6366f1" strokeWidth={2.5} dot={false} name="All FIRs" />
                <Line type="monotone" dataKey="heinous" stroke="#ef4444" strokeWidth={2} dot={false} name="Heinous" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Crime categories (major heads)">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={d.categories.heads} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={130} axisLine={false} tickLine={false} />
                <Tooltip {...TT} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {d.categories.heads.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Case disposal status">
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={d.categories.status} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {d.categories.status.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                </Pie>
                <Tooltip {...TT} />
              </PieChart>
            </ResponsiveContainer>
            <div className="an-pie-legend">
              {d.categories.status.map((s, i) => <span key={i}><i style={{ background: C[i % C.length] }} />{s.name}</span>)}
            </div>
          </Card>

          <Card title="Time-of-day pattern (incident hour)">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={d.hourly}>
                <defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.5} /><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="hour" tick={AXIS} axisLine={{ stroke: '#1e293b' }} tickLine={false} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} />
                <Tooltip {...TT} />
                <Area type="monotone" dataKey="cases" stroke="#8b5cf6" strokeWidth={2} fill="url(#hg)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Predicted hotspots — next month (projection)">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={d.forecast}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="district" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={{ stroke: '#1e293b' }} tickLine={false} interval={0} angle={-25} textAnchor="end" height={50} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} />
                <Tooltip {...TT} />
                <Bar dataKey="projected" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Projected FIRs" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Offender age profile">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={d.demographics.byAge}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={AXIS} axisLine={{ stroke: '#1e293b' }} tickLine={false} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} />
                <Tooltip {...TT} />
                <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Socio-economic background (occupation)">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={d.demographics.byOccupation} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} width={120} axisLine={false} tickLine={false} />
                <Tooltip {...TT} />
                <Bar dataKey="value" fill="#22c55e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Top habitual offenders (risk-scored)" wide>
            <div className="an-table-wrap">
              <table className="an-table">
                <thead><tr><th>Offender</th><th>District</th><th>FIRs</th><th>Heinous</th><th>Risk</th></tr></thead>
                <tbody>
                  {d.offenders.map((o, i) => (
                    <tr key={i}>
                      <td>{o.name}</td><td>{o.district}</td><td>{o.cases}</td><td>{o.heinous}</td>
                      <td><span className={`an-risk ${o.risk > 70 ? 'high' : o.risk > 40 ? 'med' : 'low'}`}>{o.risk}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
