'use client';
// ============================================================
// KSP CRIME INTELLIGENCE — Criminal Network View
// Force-directed graph of accused persons linked by co-accusation,
// shared phones and money trails, with gang-cluster detection and
// an investigator ego-network drill-down.
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { Share2, Users, ShieldAlert, Phone, Landmark, X, Crosshair, Skull } from 'lucide-react';
import { getNetworkGraph, getNetworkGangs, getPerson } from '@/lib/api';

const PALETTE = ['#6366f1', '#06b6d4', '#f59e0b', '#22c55e', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6', '#eab308', '#f97316', '#a855f7', '#3b82f6'];
const EDGE_COLOR = { co_accused: '#6366f1', shared_phone: '#06b6d4', money: '#f59e0b' };
const W = 900, H = 640;

export default function NetworkView() {
  const [graph, setGraph] = useState(null);
  const [gangs, setGangs] = useState([]);
  const [pos, setPos] = useState({});
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [ego, setEgo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const dragRef = useRef(null);
  const svgRef = useRef(null);

  useEffect(() => {
    Promise.all([getNetworkGraph(110), getNetworkGangs()])
      .then(([g, gg]) => { setGraph(g); setGangs(gg.gangs || []); })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  // neighbor adjacency for hover highlighting
  const neighbors = useMemo(() => {
    const map = new Map();
    if (!graph) return map;
    for (const n of graph.nodes) map.set(n.id, new Set());
    for (const e of graph.edges) { map.get(e.source)?.add(e.target); map.get(e.target)?.add(e.source); }
    return map;
  }, [graph]);

  const nodeById = useMemo(() => new Map((graph?.nodes || []).map((n) => [n.id, n])), [graph]);

  // force-directed layout (settles with an animated cool-down)
  useEffect(() => {
    if (!graph) return;
    const nodes = graph.nodes.map((n, i) => ({
      id: n.id, degree: n.degree,
      x: W / 2 + Math.cos((i / graph.nodes.length) * 6.28) * 240 + (Math.random() - 0.5) * 40,
      y: H / 2 + Math.sin((i / graph.nodes.length) * 6.28) * 200 + (Math.random() - 0.5) * 40,
      vx: 0, vy: 0,
    }));
    const idx = new Map(nodes.map((n, i) => [n.id, i]));
    const links = graph.edges.map((e) => ({ s: idx.get(e.source), t: idx.get(e.target) })).filter((l) => l.s != null && l.t != null);
    let alpha = 1, frame = 0, raf;
    const tick = () => {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          let dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
          const d2 = dx * dx + dy * dy || 1; const d = Math.sqrt(d2);
          const f = 1600 / d2; nodes[i].vx += (dx / d) * f; nodes[i].vy += (dy / d) * f; nodes[j].vx -= (dx / d) * f; nodes[j].vy -= (dy / d) * f;
        }
      }
      for (const l of links) {
        const a = nodes[l.s], b = nodes[l.t];
        const dx = b.x - a.x, dy = b.y - a.y; const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - 58) * 0.025; a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      }
      for (const n of nodes) {
        n.vx += (W / 2 - n.x) * 0.004; n.vy += (H / 2 - n.y) * 0.004;
        n.vx *= 0.86; n.vy *= 0.86;
        n.x = Math.max(20, Math.min(W - 20, n.x + n.vx * alpha));
        n.y = Math.max(20, Math.min(H - 20, n.y + n.vy * alpha));
      }
      alpha *= 0.985; frame++;
      const p = {}; for (const n of nodes) p[n.id] = { x: n.x, y: n.y };
      setPos(p);
      dragRef.current = { nodes, idx };
      if (frame < 260 && alpha > 0.015) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [graph]);

  function selectPerson(id) {
    setSelected(id); setEgo(null);
    getPerson(id).then(setEgo).catch(() => setEgo(null));
  }

  function focusGang(g) {
    // select the highest-risk member to anchor the drill-down
    if (g.members && g.members[0]) selectPerson(g.members[0].id);
  }

  const active = hovered || selected;
  const activeSet = active ? neighbors.get(active) : null;

  return (
    <div className="net-view">
      <div className="net-header">
        <div className="net-header-title">
          <div className="net-header-icon"><Share2 size={18} /></div>
          <div>
            <h2>Criminal Network Analysis</h2>
            <p>Co-offender links, shared phones &amp; money trails · {graph ? `${graph.stats.totalLinkedPersons} linked persons, ${gangs.length} gangs detected` : 'loading…'}</p>
          </div>
        </div>
        <div className="net-legend">
          <span><i style={{ background: EDGE_COLOR.co_accused }} /> Co-accused</span>
          <span><i style={{ background: EDGE_COLOR.shared_phone }} /> Shared phone</span>
          <span><i style={{ background: EDGE_COLOR.money }} /> Money trail</span>
          <span><i className="ring" /> Habitual offender</span>
        </div>
      </div>

      <div className="net-body">
        <div className="net-canvas">
          {loading && <div className="net-status">Building criminal network…</div>}
          {err && <div className="net-status err">Network unavailable ({err}). Is the backend running on :3000?</div>}
          {graph && (
            <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="net-svg" preserveAspectRatio="xMidYMid meet">
              <g>
                {graph.edges.map((e, i) => {
                  const a = pos[e.source], b = pos[e.target];
                  if (!a || !b) return null;
                  const dim = active && !(e.source === active || e.target === active);
                  return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={EDGE_COLOR[e.type] || '#475569'}
                    strokeWidth={e.type === 'co_accused' ? Math.min(3, 1 + (e.weight || 1) * 0.4) : 1}
                    strokeOpacity={dim ? 0.04 : 0.28} />;
                })}
              </g>
              <g>
                {graph.nodes.map((n) => {
                  const p = pos[n.id]; if (!p) return null;
                  const r = 5 + Math.min(11, n.degree * 0.5) + (n.risk > 80 ? 2 : 0);
                  const dim = active && n.id !== active && !(activeSet && activeSet.has(n.id));
                  const isSel = selected === n.id;
                  return (
                    <g key={n.id} transform={`translate(${p.x},${p.y})`} style={{ cursor: 'pointer', opacity: dim ? 0.18 : 1 }}
                      onMouseEnter={() => setHovered(n.id)} onMouseLeave={() => setHovered(null)}
                      onClick={() => selectPerson(n.id)}>
                      <circle r={r} fill={PALETTE[n.community % PALETTE.length]}
                        stroke={n.habitual ? '#fff' : 'rgba(255,255,255,0.25)'} strokeWidth={n.habitual ? 2 : 1}
                        className={isSel ? 'net-node-sel' : ''} />
                      {(active === n.id || isSel) && (
                        <text y={-r - 5} textAnchor="middle" className="net-node-label">{n.name}</text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
        </div>

        <div className="net-side">
          <div className="net-side-head"><ShieldAlert size={14} /> Detected Gangs</div>
          <div className="net-gangs">
            {gangs.map((g) => (
              <button key={g.id} className="net-gang" onClick={() => focusGang(g)}>
                <div className="net-gang-top">
                  <span className="net-gang-name"><Skull size={12} /> {g.kingpin}'s network</span>
                  <span className="net-gang-size">{g.size}</span>
                </div>
                <div className="net-gang-meta">
                  <span>{g.cases} cases</span>
                  <span className="net-gang-heinous">{g.heinous} heinous</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {selected != null && (
        <div className="net-drawer">
          <button className="net-drawer-close" onClick={() => { setSelected(null); setEgo(null); }}><X size={16} /></button>
          {!ego && <div className="net-status">Loading profile…</div>}
          {ego && (
            <>
              <div className="net-profile-head">
                <div className="net-avatar" style={{ background: PALETTE[(nodeById.get(selected)?.community || 0) % PALETTE.length] }}>
                  {ego.person.FullName.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                </div>
                <div>
                  <h3>{ego.person.FullName}</h3>
                  <p>{ego.person.Gender} · {ego.person.AgeYear} yrs · {ego.person.district}</p>
                </div>
                <div className={`net-risk ${ego.person.RiskScore > 70 ? 'high' : ego.person.RiskScore > 40 ? 'med' : 'low'}`}>
                  <span>{ego.person.RiskScore}</span>risk
                </div>
              </div>
              {ego.person.IsHabitualOffender ? <div className="net-flag"><ShieldAlert size={12} /> Flagged habitual offender</div> : null}

              <div className="net-profile-tags">
                <span>{ego.person.caste}</span><span>{ego.person.religion}</span><span>{ego.person.occupation}</span>
              </div>

              <div className="net-sec-title"><Crosshair size={12} /> Criminal history ({ego.cases.length} FIRs)</div>
              <div className="net-cases">
                {ego.cases.slice(0, 8).map((c, i) => (
                  <div key={i} className="net-case">
                    <span className="net-case-no">{c.CrimeNo}</span>
                    <span className="net-case-crime">{c.crime}</span>
                    <span className={`net-case-grav ${c.gravity === 'Heinous' ? 'heinous' : ''}`}>{c.gravity}</span>
                    <span className="net-case-status">{c.status}</span>
                  </div>
                ))}
              </div>

              <div className="net-sec-title"><Users size={12} /> Known associates ({ego.coAccused.length})</div>
              <div className="net-assoc">
                {ego.coAccused.slice(0, 8).map((a) => (
                  <button key={a.id} className="net-assoc-chip" onClick={() => selectPerson(a.id)}>
                    {a.name} <b>×{a.shared}</b>
                  </button>
                ))}
              </div>

              <div className="net-links">
                <div><Phone size={12} /> {ego.phones.length} phone(s)</div>
                <div><Landmark size={12} /> {ego.accounts.length} account(s){ego.accounts.some((a) => a.IsFlagged) ? ' · flagged' : ''}</div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
