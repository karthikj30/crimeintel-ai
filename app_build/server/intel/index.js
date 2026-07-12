// ============================================================
// KSP INTEL — Aggregator for investigative engines
// ============================================================
const { findLinkages } = require('./linkage');
const { profileSeries } = require('./geographic');
const { nearRepeatAlerts } = require('./nearRepeat');
const { detectMules } = require('./muleNetwork');
const { solvabilityTriage } = require('./solvability');
const { prolificWatchlist } = require('./prolific');
const { safeguardingAlerts } = require('./safeguarding');
const { solveSeries } = require('./loopClosure');
const { reopenColdCases } = require('./coldCase');

function overview() {
  const linkage = findLinkages({ limit: 5 });
  const near = nearRepeatAlerts({ limit: 8 });
  const mules = detectMules({ limit: 5 });
  const solv = solvabilityTriage({ limit: 5 });
  const iom = prolificWatchlist({ limit: 5 });
  const marac = safeguardingAlerts({ limit: 5 });
  const cold = reopenColdCases({ limit: 5 });
  let geo = null;
  let solved = null;
  try { geo = profileSeries(null); } catch { /* empty */ }
  try { solved = solveSeries(null); } catch { /* empty */ }

  return {
    engines: [
      { id: 'linkage', name: 'Serial-Crime Linkage', badge: `${linkage.summary.clusters} series`, blurb: 'ViCAP/ViCLAS-style MO clustering across stations' },
      { id: 'geographic', name: 'Geographic Profiling', badge: geo?.peak ? `${geo.peak.huntRadiusKm} km` : '—', blurb: 'Rossmo CGT — neighbourhood hunt zone' },
      { id: 'solve', name: 'Solve Loop', badge: solved?.verdict?.topSuspect ? solved.verdict.topSuspect.name.split(' ')[0] : 'lead', blurb: 'Series → hunt zone → suspect fit (end-to-end)' },
      { id: 'nearrepeat', name: 'Near-Repeat Warning', badge: `${near.summary.activeWindows} windows`, blurb: '400 m / 14-day elevated risk after each FIR' },
      { id: 'mules', name: 'Mule & Layering', badge: `${mules.summary.freezeList} freeze`, blurb: 'Fan-out / structuring on UPI money trails' },
      { id: 'solvability', name: 'Solvability Triage', badge: `${solv.summary.pursue} pursue`, blurb: 'Rank all open FIRs by investigative payoff' },
      { id: 'prolific', name: 'Prolific Offenders (IOM)', badge: `${iom.summary.reoffenseAlerts} alerts`, blurb: 'Watch-list + re-offense early-warning' },
      { id: 'safeguarding', name: 'Repeat-Victim Safeguarding', badge: `${marac.summary.maracPriority} MARAC`, blurb: 'MARAC-style alerts for repeat victims' },
      { id: 'coldcase', name: 'Cold-Case Re-opener', badge: `${cold.summary.freshLeads} leads`, blurb: 'Undetected FIRs re-scored against live links' },
    ],
    snapshots: {
      linkage: linkage.summary,
      nearRepeat: near.summary,
      mules: mules.summary,
      solvability: solv.summary,
      prolific: iom.summary,
      safeguarding: marac.summary,
      geographic: geo?.peak || null,
      solve: solved?.verdict || null,
      coldCase: cold.summary,
    },
  };
}

module.exports = {
  overview,
  findLinkages,
  profileSeries,
  nearRepeatAlerts,
  detectMules,
  solvabilityTriage,
  prolificWatchlist,
  safeguardingAlerts,
  solveSeries,
  reopenColdCases,
};
