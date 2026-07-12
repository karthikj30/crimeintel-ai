'use client';
// ============================================================
// KSP INTEL — 7 Investigative Engines Dashboard
// ============================================================

import { useEffect, useState } from 'react';
import {
  Dna, MapPin, Timer, Banknote, Target, Repeat, ShieldAlert,
  Loader2, AlertTriangle, ChevronRight, Sparkles,
} from 'lucide-react';
import {
  getIntelOverview, getIntelLinkage, getIntelGeographic, getIntelNearRepeat,
  getIntelMules, getIntelSolvability, getIntelProlific, getIntelSafeguarding,
  getIntelSolve, getIntelColdCase,
} from '@/lib/api';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Sparkles },
  { id: 'linkage', label: 'Serial Linkage', icon: Dna },
  { id: 'geographic', label: 'Geo Profile', icon: MapPin },
  { id: 'solve', label: 'Solve Loop', icon: Target },
  { id: 'nearrepeat', label: 'Near-Repeat', icon: Timer },
  { id: 'mules', label: 'Mule Network', icon: Banknote },
  { id: 'solvability', label: 'Solvability', icon: Target },
  { id: 'prolific', label: 'IOM Watchlist', icon: Repeat },
  { id: 'safeguarding', label: 'Safeguarding', icon: ShieldAlert },
  { id: 'coldcase', label: 'Cold Cases', icon: AlertTriangle },
];

function Band({ band }) {
  return <span className={`ix-band ix-band-${band}`}>{band}</span>;
}

function RiskPill({ level }) {
  return <span className={`ix-pill ix-pill-${level}`}>{level}</span>;
}

function Loading() {
  return (
    <div className="ix-loading">
      <Loader2 size={22} className="ix-spin" />
      <span>Running investigative engines…</span>
    </div>
  );
}

function Err({ msg }) {
  return (
    <div className="ix-error">
      <AlertTriangle size={16} />
      {msg || 'Intel unavailable. Is the backend running on :3000?'}
    </div>
  );
}

function OverviewPane({ data, onOpen }) {
  if (!data) return null;
  return (
    <div className="ix-overview">
      <p className="ix-lead">
        Investigator-grade engines for KSP — linkage, Rossmo hunt zones, near-repeat, mules, solvability, IOM, MARAC —
        plus solve-loop (series → suspect) and cold-case re-opener. Ask the Assistant the same questions.
      </p>
      <div className="ix-engine-grid">
        {data.engines.map((e) => (
          <button key={e.id} type="button" className="ix-engine-card" onClick={() => onOpen(e.id)}>
            <div className="ix-engine-top">
              <strong>{e.name}</strong>
              <span className="ix-badge">{e.badge}</span>
            </div>
            <p>{e.blurb}</p>
            <span className="ix-open">Open <ChevronRight size={14} /></span>
          </button>
        ))}
      </div>
      <div className="ix-kpi-row">
        <div className="ix-kpi"><em>{data.snapshots.linkage?.clusters ?? 0}</em><span>Linked series</span></div>
        <div className="ix-kpi"><em>{data.snapshots.nearRepeat?.activeWindows ?? 0}</em><span>Near-repeat windows</span></div>
        <div className="ix-kpi"><em>{data.snapshots.mules?.freezeList ?? 0}</em><span>Freeze-list accounts</span></div>
        <div className="ix-kpi"><em>{data.snapshots.solvability?.pursue ?? 0}</em><span>High-solvability FIRs</span></div>
        <div className="ix-kpi"><em>{data.snapshots.prolific?.reoffenseAlerts ?? 0}</em><span>IOM re-offense alerts</span></div>
        <div className="ix-kpi"><em>{data.snapshots.safeguarding?.maracPriority ?? 0}</em><span>MARAC priority victims</span></div>
        <div className="ix-kpi"><em>{data.snapshots.coldCase?.freshLeads ?? 0}</em><span>Cold-case leads</span></div>
        <div className="ix-kpi"><em>{data.snapshots.geographic?.huntRadiusKm ?? '—'} km</em><span>Hunt zone</span></div>
      </div>
    </div>
  );
}

function LinkagePane({ data }) {
  if (!data) return null;
  return (
    <div className="ix-pane">
      <div className="ix-method">{data.summary.method}</div>
      <div className="ix-kpi-row compact">
        <div className="ix-kpi"><em>{data.summary.scanned}</em><span>FIRs scanned</span></div>
        <div className="ix-kpi"><em>{data.summary.clusters}</em><span>Series found</span></div>
        <div className="ix-kpi"><em>{data.summary.largest}</em><span>Largest series</span></div>
      </div>
      <div className="ix-list">
        {data.clusters.map((c) => (
          <article key={c.id} className="ix-card">
            <header>
              <h3>{c.label}</h3>
              <span className="ix-badge">{c.strength}% link strength</span>
            </header>
            <div className="ix-meta">
              <span>{c.crimeSubHead}</span>
              <span>{c.stations.length} stations</span>
              <span>{c.districts.join(', ')}</span>
            </div>
            <div className="ix-tags">{c.reasons.map((r) => <span key={r}>{r}</span>)}</div>
            <table className="ix-table">
              <thead><tr><th>FIR</th><th>Station</th><th>Date</th><th>Status</th></tr></thead>
              <tbody>
                {c.cases.slice(0, 6).map((x) => (
                  <tr key={x.CrimeNo}>
                    <td className="mono">{x.CrimeNo}</td>
                    <td>{x.station}</td>
                    <td>{(x.date || '').slice(0, 10)}</td>
                    <td>{x.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        ))}
        {!data.clusters.length && <p className="ix-empty">No cross-station series detected at current threshold.</p>}
      </div>
    </div>
  );
}

function GeographicPane({ data, onSeries }) {
  if (!data) return null;
  const peak = data.peak;
  const maxI = Math.max(...(data.grid || []).map((g) => g.intensity), 0.01);
  return (
    <div className="ix-pane">
      <div className="ix-method">{data.method}</div>
      {data.availableSeries?.length > 0 && (
        <div className="ix-series-pick">
          {data.availableSeries.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`ix-chip ${data.series?.id === s.id ? 'active' : ''}`}
              onClick={() => onSeries(s.id)}
            >
              {s.crimeSubHead} · {s.size} FIRs
            </button>
          ))}
        </div>
      )}
      {peak && (
        <div className="ix-peak">
          <MapPin size={18} />
          <div>
            <strong>{peak.narrative}</strong>
            <p>
              Peak [{peak.lat}, {peak.lng}]
              {peak.nearestStation ? ` · ${peak.nearestStation}` : peak.nearestDistrict ? ` · near ${peak.nearestDistrict}` : ''}
              {' '}· hunt zone {peak.huntRadiusKm} km ({peak.huntAreaKm2} km²) · top {peak.massPct}% mass
            </p>
          </div>
        </div>
      )}
      <div className="ix-geo-layout">
        <div className="ix-geo-grid" title="Rossmo probability surface (schematic)">
          {(data.grid || []).slice(0, 400).map((cell, i) => (
            <span
              key={i}
              className="ix-geo-cell"
              style={{
                left: `${((cell.lng - (data.bounds?.minLng || cell.lng)) / ((data.bounds?.maxLng || cell.lng + 0.01) - (data.bounds?.minLng || cell.lng) || 1)) * 100}%`,
                top: `${(1 - (cell.lat - (data.bounds?.minLat || cell.lat)) / ((data.bounds?.maxLat || cell.lat + 0.01) - (data.bounds?.minLat || cell.lat) || 1)) * 100}%`,
                opacity: 0.25 + 0.75 * (cell.intensity / maxI),
                transform: `scale(${0.6 + cell.intensity})`,
              }}
            />
          ))}
          {(data.crimes || []).map((c) => (
            <span
              key={c.CrimeNo}
              className="ix-geo-crime"
              style={{
                left: `${((c.lng - (data.bounds?.minLng || c.lng)) / ((data.bounds?.maxLng || c.lng + 0.01) - (data.bounds?.minLng || c.lng) || 1)) * 100}%`,
                top: `${(1 - (c.lat - (data.bounds?.minLat || c.lat)) / ((data.bounds?.maxLat || c.lat + 0.01) - (data.bounds?.minLat || c.lat) || 1)) * 100}%`,
              }}
              title={c.CrimeNo}
            />
          ))}
          {peak && (
            <span
              className="ix-geo-peak"
              style={{
                left: `${((peak.lng - (data.bounds?.minLng || peak.lng)) / ((data.bounds?.maxLng || peak.lng + 0.01) - (data.bounds?.minLng || peak.lng) || 1)) * 100}%`,
                top: `${(1 - (peak.lat - (data.bounds?.minLat || peak.lat)) / ((data.bounds?.maxLat || peak.lat + 0.01) - (data.bounds?.minLat || peak.lat) || 1)) * 100}%`,
              }}
            />
          )}
        </div>
        <div className="ix-list tight">
          <h4>Crime sites in series ({data.series?.size || data.crimes?.length || 0})</h4>
          {(data.crimes || []).map((c) => (
            <div key={c.CrimeNo} className="ix-row">
              <span className="mono">{c.CrimeNo}</span>
              <span>{c.station}</span>
              <span>{c.subhead}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NearRepeatPane({ data }) {
  if (!data) return null;
  return (
    <div className="ix-pane">
      <div className="ix-method">{data.theory}</div>
      <div className="ix-kpi-row compact">
        <div className="ix-kpi"><em>{data.summary.activeWindows}</em><span>Active windows</span></div>
        <div className="ix-kpi"><em>{data.summary.critical}</em><span>Critical</span></div>
        <div className="ix-kpi"><em>{data.summary.stationsOnAlert}</em><span>Stations on alert</span></div>
      </div>
      <div className="ix-list">
        {data.active.map((a) => (
          <article key={a.id} className="ix-card">
            <header>
              <h3>{a.seedSubhead} · {a.station}</h3>
              <RiskPill level={a.riskLevel} />
            </header>
            <p>{a.message}</p>
            <div className="ix-meta">
              <span className="mono">{a.seedCrimeNo}</span>
              <span>{a.daysSince}d since</span>
              <span>until {a.windowEnds}</span>
              <span>{a.radiusM} m radius</span>
              <span>{a.urgency}% urgency</span>
            </div>
          </article>
        ))}
        {!data.active.length && <p className="ix-empty">No active near-repeat windows in the lookback period.</p>}
      </div>
    </div>
  );
}

function MulesPane({ data }) {
  if (!data) return null;
  return (
    <div className="ix-pane">
      <div className="ix-method">{data.summary.method}</div>
      <div className="ix-kpi-row compact">
        <div className="ix-kpi"><em>{data.summary.muleCandidates}</em><span>Mule candidates</span></div>
        <div className="ix-kpi"><em>{data.summary.freezeList}</em><span>Freeze recommended</span></div>
        <div className="ix-kpi"><em>{data.summary.transactions}</em><span>Txns scanned</span></div>
      </div>
      <h4 className="ix-subh">Freeze list</h4>
      <table className="ix-table">
        <thead><tr><th>Account</th><th>Bank</th><th>Person</th><th>Score</th><th>Signals</th></tr></thead>
        <tbody>
          {data.freezeList.map((m) => (
            <tr key={m.accountNo}>
              <td className="mono">{m.accountNo}</td>
              <td>{m.bank}</td>
              <td>{m.person}</td>
              <td><span className="ix-badge danger">{m.muleScore}</span></td>
              <td className="ix-signals">{(m.signals || []).join(' · ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4 className="ix-subh">Money trails (victim → mule → next)</h4>
      <div className="ix-list tight">
        {data.trails.map((t, i) => (
          <div key={i} className="ix-trail">
            <span>{t.from.person || t.from.account}</span>
            <ChevronRight size={14} />
            <span className="mule">{t.mule.person || t.mule.account}</span>
            {t.next && <><ChevronRight size={14} /><span>{t.next.person || t.next.account}</span></>}
            <em>₹{Number(t.amount).toLocaleString('en-IN')} · {t.channel}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

function SolvabilityPane({ data }) {
  if (!data) return null;
  return (
    <div className="ix-pane">
      <div className="ix-method">{data.method}</div>
      <div className="ix-kpi-row compact">
        <div className="ix-kpi"><em>{data.summary.pursue}</em><span>Pursue</span></div>
        <div className="ix-kpi"><em>{data.summary.develop}</em><span>Develop</span></div>
        <div className="ix-kpi"><em>{data.summary.screen}</em><span>Screen</span></div>
      </div>
      <table className="ix-table sticky">
        <thead>
          <tr><th>Score</th><th>Band</th><th>FIR</th><th>Crime</th><th>Station</th><th>Age</th><th>Why</th></tr>
        </thead>
        <tbody>
          {data.worklist.map((c) => (
            <tr key={c.CrimeNo}>
              <td><strong>{c.solvability}</strong></td>
              <td><Band band={c.band} /></td>
              <td className="mono">{c.CrimeNo}</td>
              <td>{c.subhead}</td>
              <td>{c.station}</td>
              <td>{c.ageDays}d</td>
              <td className="ix-signals">{c.factors.slice(0, 3).map((f) => f.label).join(' · ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProlificPane({ data }) {
  if (!data) return null;
  return (
    <div className="ix-pane">
      <div className="ix-method">{data.framing}</div>
      <div className="ix-kpi-row compact">
        <div className="ix-kpi"><em>{data.summary.tier1}</em><span>Tier-1</span></div>
        <div className="ix-kpi"><em>{data.summary.reoffenseAlerts}</em><span>Re-offense alerts</span></div>
        <div className="ix-kpi"><em>{data.summary.highAlerts}</em><span>High alerts</span></div>
      </div>
      <div className="ix-list">
        {data.watchlist.map((w) => (
          <article key={w.id} className="ix-card">
            <header>
              <h3>{w.name} <small>#{w.id}</small></h3>
              <span className={`ix-tier ix-tier-${w.tier}`}>{w.tier}</span>
            </header>
            <div className="ix-meta">
              <span>Risk {w.risk}</span>
              <span>{w.cases} FIRs</span>
              <span>{w.heinous} heinous</span>
              <span>{w.district}</span>
              <span>{w.daysSinceLast}d since last</span>
              {w.avgGapDays && <span>~{w.avgGapDays}d cadence</span>}
            </div>
            <div className="ix-tags">{(w.modus || []).map((m) => <span key={m}>{m}</span>)}</div>
            {w.alert && (
              <div className={`ix-alert ix-alert-${w.alert.level}`}>{w.alert.message}</div>
            )}
            <p className="ix-ethics">{w.ethicsNote}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function SolvePane({ data, onSeries }) {
  if (!data) return null;
  return (
    <div className="ix-pane">
      <div className="ix-method">{data.chain} — end-to-end investigative lead</div>
      {data.availableSeries?.length > 0 && (
        <div className="ix-series-pick">
          {data.availableSeries.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`ix-chip ${data.series?.id === s.id ? 'active' : ''}`}
              onClick={() => onSeries(s.id)}
            >
              {s.crimeSubHead} · {s.size} FIRs
            </button>
          ))}
        </div>
      )}
      {data.verdict && (
        <div className="ix-peak">
          <Target size={18} />
          <div>
            <strong>{data.verdict.summary}</strong>
            <p className="ix-ethics" style={{ marginTop: 6 }}>{data.verdict.ethicsNote}</p>
          </div>
        </div>
      )}
      <div className="ix-kpi-row compact">
        <div className="ix-kpi"><em>{data.series?.size || 0}</em><span>Linked FIRs</span></div>
        <div className="ix-kpi"><em>{data.series?.stations?.length || 0}</em><span>Stations</span></div>
        <div className="ix-kpi"><em>{data.huntZone?.huntRadiusKm || '—'} km</em><span>Hunt zone</span></div>
      </div>
      <h4 className="ix-subh">Suggested suspects (MO + home-zone fit)</h4>
      <div className="ix-list">
        {(data.suspects || []).map((s) => (
          <article key={s.id} className="ix-card">
            <header>
              <h3>{s.name} <small>fit {s.fit}%</small></h3>
              <span className={`ix-tier ix-tier-${s.tier}`}>{s.tier}</span>
            </header>
            <div className="ix-meta">
              <span>Risk {s.risk}</span>
              <span>{s.cases} FIRs</span>
              <span>{s.district}</span>
            </div>
            <div className="ix-tags">{(s.modus || []).map((m) => <span key={m}>{m}</span>)}</div>
            <div className="ix-tags">{(s.reasons || []).map((r) => <span key={r}>{r}</span>)}</div>
          </article>
        ))}
        {!data.suspects?.length && <p className="ix-empty">No strong suspect fit — expand canvass in the hunt zone.</p>}
      </div>
    </div>
  );
}

function ColdCasePane({ data }) {
  if (!data) return null;
  return (
    <div className="ix-pane">
      <div className="ix-method">{data.framing} · as of {data.asOf}</div>
      <div className="ix-kpi-row compact">
        <div className="ix-kpi"><em>{data.summary.scanned}</em><span>Undetected scanned</span></div>
        <div className="ix-kpi"><em>{data.summary.freshLeads}</em><span>Fresh leads</span></div>
        <div className="ix-kpi"><em>{data.summary.withSeries}</em><span>Series matches</span></div>
      </div>
      <div className="ix-list">
        {(data.leads || []).map((l) => (
          <article key={l.CrimeNo} className="ix-card">
            <header>
              <h3 className="mono">{l.CrimeNo}</h3>
              <span className="ix-badge">lead {l.leadScore}</span>
            </header>
            <p>{l.action}</p>
            <div className="ix-meta">
              <span>{l.subhead}</span>
              <span>{l.station}</span>
              <span>{l.ageDays}d cold</span>
            </div>
            <div className="ix-tags">{(l.reasons || []).map((r) => <span key={r}>{r}</span>)}</div>
            {l.suggestedSuspects?.length > 0 && (
              <div className="ix-meta">Suspects: {l.suggestedSuspects.map((s) => s.name).join(', ')}</div>
            )}
          </article>
        ))}
        {!data.leads?.length && <p className="ix-empty">No fresh cold-case leads at current thresholds.</p>}
      </div>
    </div>
  );
}

function SafeguardingPane({ data }) {
  if (!data) return null;
  return (
    <div className="ix-pane">
      <div className="ix-method">{data.framing}</div>
      <div className="ix-kpi-row compact">
        <div className="ix-kpi"><em>{data.summary.maracPriority}</em><span>MARAC priority</span></div>
        <div className="ix-kpi"><em>{data.summary.elevated}</em><span>Elevated</span></div>
        <div className="ix-kpi"><em>{data.summary.crimesAgainstWomen}</em><span>Crimes vs women</span></div>
      </div>
      <div className="ix-list">
        {data.alerts.map((a) => (
          <article key={a.id} className="ix-card">
            <header>
              <h3>{a.name}</h3>
              <RiskPill level={a.safeguardingRisk} />
            </header>
            <p>{a.action}</p>
            <div className="ix-meta">
              <span>{a.firCount} FIRs</span>
              <span>{a.againstWomenCases} against-women</span>
              <span>{a.district}</span>
              <span>{a.gender}/{a.age}</span>
            </div>
            <div className="ix-tags">{(a.crimes || []).map((c) => <span key={c}>{c}</span>)}</div>
            <div className="ix-meta mono">{(a.crimeNos || []).join(' · ')}</div>
          </article>
        ))}
        {!data.alerts.length && <p className="ix-empty">No repeat-victim patterns detected (needs PersonMaster links on Victim rows).</p>}
      </div>
    </div>
  );
}

export default function IntelView() {
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cache, setCache] = useState({});

  const load = async (id) => {
    if (cache[id]) return cache[id];
    const loaders = {
      overview: getIntelOverview,
      linkage: getIntelLinkage,
      geographic: () => getIntelGeographic(),
      solve: () => getIntelSolve(),
      nearrepeat: getIntelNearRepeat,
      mules: getIntelMules,
      solvability: getIntelSolvability,
      prolific: getIntelProlific,
      safeguarding: getIntelSafeguarding,
      coldcase: getIntelColdCase,
    };
    const fn = loaders[id];
    if (!fn) return null;
    const data = await fn();
    setCache((c) => ({ ...c, [id]: data }));
    return data;
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    load(tab)
      .then(() => { if (!cancelled) setLoading(false); })
      .catch((e) => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const openTab = (id) => setTab(id);

  const onSeries = async (seriesId) => {
    setLoading(true);
    try {
      if (tab === 'solve') {
        const data = await getIntelSolve(seriesId);
        setCache((c) => ({ ...c, solve: data }));
      } else {
        const data = await getIntelGeographic(seriesId);
        setCache((c) => ({ ...c, geographic: data }));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ix-root">
      <header className="ix-header">
        <div>
          <h1>Investigative Intelligence</h1>
          <p>Serial linkage · geographic profiling · near-repeat · mule networks · solvability · IOM · safeguarding</p>
        </div>
      </header>

      <nav className="ix-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`ix-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </nav>

      <div className="ix-body">
        {loading && <Loading />}
        {!loading && error && <Err msg={error} />}
        {!loading && !error && tab === 'overview' && <OverviewPane data={cache.overview} onOpen={openTab} />}
        {!loading && !error && tab === 'linkage' && <LinkagePane data={cache.linkage} />}
        {!loading && !error && tab === 'geographic' && <GeographicPane data={cache.geographic} onSeries={onSeries} />}
        {!loading && !error && tab === 'solve' && <SolvePane data={cache.solve} onSeries={onSeries} />}
        {!loading && !error && tab === 'nearrepeat' && <NearRepeatPane data={cache.nearrepeat} />}
        {!loading && !error && tab === 'mules' && <MulesPane data={cache.mules} />}
        {!loading && !error && tab === 'solvability' && <SolvabilityPane data={cache.solvability} />}
        {!loading && !error && tab === 'prolific' && <ProlificPane data={cache.prolific} />}
        {!loading && !error && tab === 'safeguarding' && <SafeguardingPane data={cache.safeguarding} />}
        {!loading && !error && tab === 'coldcase' && <ColdCasePane data={cache.coldcase} />}
      </div>
    </div>
  );
}
