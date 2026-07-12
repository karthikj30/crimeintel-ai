// ============================================================
// KSP CRIME INTELLIGENCE — Offline Intent Engine
// ------------------------------------------------------------
// Deterministic, zero-dependency NL understanding used when no LLM
// is configured. Maps a curated set of investigator intents to safe
// prebuilt SQL and templated, evidence-cited answers so the platform
// always demos, even without an API key.
// ============================================================

const { getFirDb } = require('../fir/db');
const { getCaseFull } = require('../fir/queries');

const columnsOf = (rows) => (rows.length ? Object.keys(rows[0]) : []);
const crimeNos = (rows) => rows.map((r) => r.CrimeNo).filter(Boolean).slice(0, 12);
const fmt = (rows, sql, answer, followups, extra = {}) => ({
  mode: 'offline', answer, sql, rows, columns: columnsOf(rows),
  evidence: crimeNos(rows).map((c) => `FIR ${c}`), followups, ...extra,
});

// Kannada → English tokens for offline intent matching (OpenSLR / in-app kn-IN speech).
const KN_DISTRICTS = [
  [/ಬೆಂಗಳೂರು\s*ನಗರ|ಬೆಂಗಳೂರು\s*ಸಿಟಿ/i, 'Bengaluru City'],
  [/ಬೆಂಗಳೂರು\s*ಗ್ರಾಮೀಣ|ಬೆಂಗಳೂರು\s*ರೂರಲ್/i, 'Bengaluru Rural'],
  [/ಬೆಂಗಳೂರಿನಲ್ಲಿ|ಬೆಂಗಳೂರ್/i, 'Bengaluru City'],
  [/ಮೈಸೂರು|ಮೈಸೂರ್|ಮೈಸೂರಿನಲ್ಲಿ/i, 'Mysuru'],
  [/ಮಂಗಳೂರು|ದಕ್ಷಿಣ\s*ಕನ್ನಡ/i, 'Dakshina Kannada'],
  [/ಬೆಳಗಾವಿ|ಬೆಲಗಾವಿ/i, 'Belagavi'],
  [/ಕಲಬುರಗಿ|ಗುಲ್ಬರ್ಗ/i, 'Kalaburagi'],
  [/ಧಾರವಾಡ/i, 'Dharwad'],
  [/ಬಳ್ಳಾರಿ|ಬಲ್ಲಾರಿ/i, 'Ballari'],
  [/ವಿಜಯಪುರ|ಬಿಜಾಪುರ/i, 'Vijayapura'],
  [/ದಾವಣಗೆರೆ/i, 'Davanagere'],
  [/ಶಿವಮೊಗ್ಗ|ಶಿವಮೊಗ್ಗಾ/i, 'Shivamogga'],
  [/ತುಮಕೂರು/i, 'Tumakuru'],
  [/ಉಡುಪಿ/i, 'Udupi'],
  [/ಹಾಸನ/i, 'Hassan'],
  [/ರಾಯಚೂರು/i, 'Raichur'],
  [/ಮಂಡ್ಯ/i, 'Mandya'],
];

const KN_CRIME = [
  [/ಸೈಬರ್|ಆನ್‌ಲೈನ್|ಐಟಿ\s*ಅಪರಾಧ/i, 'cyber'],
  [/ಕಳ್ಳಸಾಗಣೆ|ಕಳ್ಳತನ/i, 'theft'],
  [/ಕೊಲೆ/i, 'murder'],
  [/ದೊಂಬತಿ|ಕಳ್ಳಸಾಗಣೆ/i, 'robbery'],
  [/ಅತ್ಯಾಚಾರ/i, 'rape'],
  [/ವಂಚನೆ/i, 'fraud'],
  [/ಅಮ್ಲೀಕೃತ\s*ಪದಾರ್ಥ|ಡ್ರಗ್|ನಾರ್ಕೋ/i, 'drug'],
  [/ಕಿಡ್ನಾಪ್|ಅಪಹರಣ/i, 'kidnap'],
  [/ಹಣಕಾಸು|ಹಣ\s*ಹರಿವು|ಹಣ/i, 'financial'],
  [/ಸಂದೇಹಾಸ್ಪದ/i, 'suspicious'],
];

/** Normalize Kannada (and mixed) questions into English tokens for intent rules. */
function normalizeQuestion(question) {
  const raw = question || '';
  const replyKn = /[\u0C80-\u0CFF]/.test(raw);
  let q = raw.toLowerCase();
  let districtHint = null;
  let crimeHint = null;

  if (replyKn) {
  // Count / how-many patterns
    if (/ಎಷ್ಟು|ಎಷ್ಟೊ|ಎಷ್ಟು\s*ಪ್ರಕರಣ|ಎಷ್ಟು\s*ಎಫ್\s*ಐ\s*ಆರ್/i.test(raw)) {
      q += ' how many count total';
    }
    if (/ಪ್ರಕರಣ|ಎಫ್\s*ಐ\s*ಆರ್|ಎಫ್ಐಆರ್/i.test(raw)) q += ' cases fir';
    if (/ಜಿಲ್ಲೆ|ಹಾಟ್‌?ಸ್ಪಾಟ್/i.test(raw)) q += ' district hotspot';
    if (/ಪುನರಾವರ್ತಿತ|ಸಾಮಾನ್ಯ\s*ಅಪರಾಧಿ/i.test(raw)) q += ' repeat habitual offender';
    if (/ಪ್ರಕಾರ|ವಿಭಾಗ/i.test(raw)) q += ' crime type breakdown category';
    if (/ಸ್ಥಿತಿ|ವಿಚಾರಣೆ/i.test(raw)) q += ' status investigation disposal';
    if (/ಇತ್ತೀಚಿನ|ಇತ್ತೀಚೆಗೆ|ಕಳೆದ/i.test(raw)) q += ' recent trend monthly';
    if (/ಒಟ್ಟು|ಸಾರಾಂಶ/i.test(raw)) q += ' total overview summary';

    for (const [re, district] of KN_DISTRICTS) {
      if (re.test(raw)) { districtHint = district; q += ` ${district.toLowerCase()}`; break; }
    }
    for (const [re, crime] of KN_CRIME) {
      if (re.test(raw)) { crimeHint = crime; q += ` ${crime}`; break; }
    }
  }

  return { q, replyKn, districtHint, crimeHint, raw };
}

function knCountAnswer(n, crimeTerm, district, sampleCrimeNo) {
  const crimeKn = crimeTerm === 'cyber' ? 'ಸೈಬರ್ ಅಪರಾಧ' : (crimeTerm || 'ಎಲ್ಲಾ');
  const distKn = district || 'ಕರ್ನಾಟಕ';
  const tail = sampleCrimeNo ? ` ಇತ್ತೀಚಿನ ಉದಾಹರಣೆ: FIR ${sampleCrimeNo}.` : '';
  return `${distKn}ನಲ್ಲಿ ${crimeKn} ಪ್ರಕರಣಗಳು ${n} ದಾಖಲಾಗಿವೆ.${tail}`;
}

function knFollowups(en) {
  const map = {
    'Break these down by police station': 'ಪೊಲೀಸ್ ಠಾಣೆಯವಾರು ವಿಭಜಿಸಿ',
    'Show their case status': 'ಪ್ರಕರಣದ ಸ್ಥಿತಿ ತೋರಿಸಿ',
    'List the most recent ones': 'ಇತ್ತೀಚಿನ ಪ್ರಕರಣಗಳನ್ನು ಪಟ್ಟಿ ಮಾಡಿ',
    'Which districts are crime hotspots?': 'ಯಾವ ಜಿಲ್ಲೆಗಳು ಅಪರಾಧ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು?',
    'Show repeat offenders': 'ಪುನರಾವರ್ತಿತ ಅಪರಾಧಿಗಳನ್ನು ತೋರಿಸಿ',
    'Break down cases by crime type': 'ಅಪರಾಧ ಪ್ರಕಾರವಾರು ವಿಭಜಿಸಿ',
  };
  return en.map((f) => map[f] || f);
}

function handle(question, dbIn) {
  const db = dbIn || getFirDb();
  const { q, replyKn, districtHint, crimeHint, raw } = normalizeQuestion(question);
  const run = (sql, ...p) => db.prepare(sql).all(...p);
  const localize = (enAnswer, knAnswer, followups) => {
    if (!replyKn) return { answer: enAnswer, followups };
    return { answer: knAnswer || enAnswer, followups: knFollowups(followups) };
  };

  // 1) FIR lookup by crime number
  const mNo = question.match(/\b(\d{12,20})\b/) || question.match(/(?:fir|crime)\s*(?:no\.?|number|#)?\s*([0-9]{6,})/i);
  if (mNo) {
    const full = getCaseFull(mNo[1], db);
    if (full) {
      const c = full.case;
      const acc = full.accused.map((a) => a.name).join(', ') || 'unknown / unidentified';
      const secs = full.sections.map((s) => `${s.act} ${s.section}`).join(', ');
      const answer = `FIR ${c.CrimeNo} — ${c.crimeSubHead} (${c.crimeHead}), registered at ${c.station}, ${c.district} on ${c.CrimeRegisteredDate}. Status: ${c.status} (${c.gravity}). Sections: ${secs}. Accused: ${acc}. ${c.BriefFacts}`;
      return fmt([c], `SELECT * FROM CaseMaster WHERE CrimeNo='${c.CrimeNo}'`, answer,
        [`Who are the victims in FIR ${c.CrimeNo}?`, `Arrest details for FIR ${c.CrimeNo}`, `Find cases similar to FIR ${c.CrimeNo}`],
        { detail: full, evidence: [`FIR ${c.CrimeNo}`] });
    }
  }

  // 1.5) Investigative intel engines (before generic habitual/finance so they win)
  if (/\b(solve\s+(this\s+)?series|who\s+fits|suspect\s+(for|fit)|end[\s-]?to[\s-]?end|hunt\s+zone.*suspect|serial\s+theft\s+series|which\s+offender.*series)/.test(q)) {
    const intel = require('../intel');
    const data = intel.solveSeries(null);
    if (data.error) {
      return fmt([], '/* intel.solveSeries */', data.error, ['Show serial crime linkages'], {});
    }
    const top = data.verdict?.topSuspect;
    const en = data.verdict?.summary
      || `Series ${data.series?.label}: hunt zone ${data.huntZone?.huntRadiusKm} km.`;
    return fmt((data.suspects || []).map((s) => ({
      name: s.name, fit: s.fit, risk: s.risk, tier: s.tier, district: s.district,
    })), '/* intel.solveSeries */', en,
      ['Show geographic profile of the top series', 'Open cold-case re-opener', 'Show serial crime linkages'],
      { evidence: [data.series?.label, top ? `suspect ${top.name}` : 'no named suspect'].filter(Boolean) });
  }
  if (/\b(cold[\s-]?case|re[\s-]?open|undetected\s+(fir|case)|fresh\s+lead|stale\s+fir)/.test(q)) {
    const intel = require('../intel');
    const data = intel.reopenColdCases({ limit: 10 });
    const en = `Cold-case re-opener: scanned ${data.summary.scanned} undetected FIRs → ${data.summary.freshLeads} fresh leads (${data.summary.withSeries} series matches).`;
    return fmt((data.leads || []).map((l) => ({
      CrimeNo: l.CrimeNo, lead: l.leadScore, crime: l.subhead, station: l.station, ageDays: l.ageDays,
    })), '/* intel.reopenColdCases */', en,
      ['Solve the top linked series', 'Show solvability worklist'],
      { evidence: [`${data.summary.freshLeads} leads`] });
  }
  if (/\b(serial|linkage|vicap|viclas|linked\s+series|same\s+offender|modus|mo\s+cluster)/.test(q)) {
    const intel = require('../intel');
    const data = intel.findLinkages({ limit: 5 });
    const top = data.clusters[0];
    const en = top
      ? `Serial-crime linkage found ${data.summary.clusters} cross-station series. Top: ${top.label} (${top.strength}% strength). Ask "who fits this series" for end-to-end suspect fit.`
      : `Scanned ${data.summary.scanned} open FIRs — no multi-station series above threshold yet.`;
    const rows = (data.clusters || []).map((c) => ({
      series: c.label, size: c.size, strength: c.strength, crime: c.crimeSubHead, stations: c.stations.length,
    }));
    return fmt(rows, '/* intel.findLinkages */', en,
      ['Who fits this series?', 'Show geographic profile of the top series', 'List near-repeat early warnings'],
      { evidence: [`${data.summary.clusters} series`] });
  }
  if (/\b(rossmo|geographic\s+profil|anchor\s+point|where\s+(does|is)\s+the\s+offender\s+live|offender\s+base|hunt\s+zone)/.test(q)) {
    const intel = require('../intel');
    const data = intel.profileSeries(null);
    const en = data.peak
      ? data.peak.narrative
      : 'Need at least 3 linked crime locations for Rossmo geographic profiling.';
    return fmt(data.crimes || [], '/* intel.profileSeries */', en,
      ['Who fits this series?', 'Show linked serial crime series'],
      { evidence: data.peak ? [`hunt ${data.peak.huntRadiusKm} km`] : [] });
  }
  if (/\b(near[\s-]?repeat|early\s+warning|next\s+burglary|at[\s-]?risk\s+radius|beat\s+alert)/.test(q)) {
    const intel = require('../intel');
    const data = intel.nearRepeatAlerts({ limit: 8 });
    const en = `${data.summary.activeWindows} active near-repeat windows (${data.summary.critical} critical) as of ${data.asOf || 'data max date'}. Top: ${(data.active[0] && data.active[0].message) || 'none'}`;
    return fmt(data.active.map((a) => ({
      CrimeNo: a.seedCrimeNo, station: a.station, risk: a.riskLevel, urgency: a.urgency, until: a.windowEnds,
    })), '/* intel.nearRepeatAlerts */', en,
      ['Show serial crime linkages', 'Show solvability triage'],
      { evidence: [`${data.summary.activeWindows} windows`] });
  }
  if (/\b(mule|layering|freeze\s+list|structuring|fan[\s-]?out|mule\s+ring)/.test(q)) {
    const intel = require('../intel');
    const data = intel.detectMules({ limit: 8 });
    const en = `Mule detector flagged ${data.summary.muleCandidates} accounts; ${data.summary.freezeList} on freeze-list. Top: ${(data.mules[0] && `${data.mules[0].person || data.mules[0].accountNo} (score ${data.mules[0].muleScore})`) || 'n/a'}.`;
    return fmt(data.mules.map((m) => ({
      person: m.person, account: m.accountNo, bank: m.bank, muleScore: m.muleScore, freeze: m.freezeRecommend ? 'Y' : 'N',
    })), '/* intel.detectMules */', en,
      ['Trace the largest money trail', 'Show prolific offenders'],
      { evidence: [`${data.summary.freezeList} freeze`] });
  }
  if (/\b(solvab|triage|worklist|which\s+cases?\s+to\s+(pursue|priorit)|investigator\s+hours)/.test(q)) {
    const intel = require('../intel');
    const data = intel.solvabilityTriage({ limit: 10 });
    const top = data.worklist[0];
    const en = `Solvability triage: ${data.summary.pursue} pursue / ${data.summary.develop} develop / ${data.summary.screen} screen across ${data.summary.openCases || data.summary.scanned || 'all'} open/undetected FIRs. Top FIR ${top ? top.CrimeNo : '—'} scores ${top ? top.solvability : '—'}.`;
    return fmt(data.worklist.map((c) => ({
      CrimeNo: c.CrimeNo, score: c.solvability, band: c.band, crime: c.subhead, station: c.station,
    })), '/* intel.solvabilityTriage */', en,
      ['Show cold-case re-opener', 'Show IOM watchlist'],
      { evidence: [`${data.summary.pursue} pursue`] });
  }
  if (/\b(iom|prolific|watch\s*list|re[\s-]?offen)/.test(q) && !/\brepeat\s+victim/.test(q)) {
    const intel = require('../intel');
    const data = intel.prolificWatchlist({ limit: 10 });
    const en = `IOM watchlist: ${data.summary.onWatchlist} offenders (tier1 ${data.summary.tier1} / tier2 ${data.summary.tier2} / tier3 ${data.summary.tier3}), ${data.summary.reoffenseAlerts} re-offense alerts. Prioritization only — not a sentencing score.`;
    return fmt(data.watchlist.map((w) => ({
      name: w.name, risk: w.risk, cases: w.cases, tier: w.tier, alert: w.alert?.level || '',
    })), '/* intel.prolificWatchlist */', en,
      ['Who fits this series?', 'Show safeguarding alerts'],
      { evidence: [`${data.summary.reoffenseAlerts} alerts`] });
  }
  if (/\b(marac|safeguard|repeat\s+victim|domestic\s+violence|crimes?\s+against\s+women\s+alert)/.test(q)) {
    const intel = require('../intel');
    const data = intel.safeguardingAlerts({ limit: 10 });
    const en = `Safeguarding: ${data.summary.repeatVictims} repeat victims — ${data.summary.maracPriority} MARAC-priority, ${data.summary.elevated} elevated. Protective alerts for investigators only.`;
    return fmt(data.alerts.map((a) => ({
      name: a.name, firs: a.firCount, risk: a.safeguardingRisk, womenCases: a.againstWomenCases, district: a.district,
    })), '/* intel.safeguardingAlerts */', en,
      ['Show solvability worklist', 'Show prolific offenders'],
      { evidence: [`${data.summary.maracPriority} MARAC`] });
  }

  // 2) Repeat / habitual offenders (generic — intel IOM already handled above)
  if (/\b(habitual|recidivis|multiple\s+fir|most\s+cases|frequent\s+offend|repeat\s+offend)/.test(q)
      && !/\brepeat\s+victim/.test(q)) {
    const sql = `SELECT p.FullName name, p.RiskScore riskScore, COUNT(a.CaseMasterID) cases,
        d.DistrictName district
      FROM PersonMaster p JOIN Accused a ON a.PersonMasterID=p.PersonMasterID
      LEFT JOIN District d ON d.DistrictID=p.DistrictID
      WHERE p.IsHabitualOffender=1
      GROUP BY p.PersonMasterID ORDER BY cases DESC, riskScore DESC LIMIT 15`;
    const rows = run(sql);
    const en = `Found ${rows.length} habitual offenders (linked to 3+ FIRs). Top: ${rows.slice(0, 3).map((r) => `${r.name} (${r.cases} cases, risk ${r.riskScore})`).join('; ')}.`;
    const kn = rows.length
      ? `${rows.length} ಪುನರಾವರ್ತಿತ ಅಪರಾಧಿಗಳು ಕಂಡುಬಂದಿವೆ. ಮುಖ್ಯರು: ${rows.slice(0, 3).map((r) => `${r.name} (${r.cases} ಪ್ರಕರಣಗಳು, ಅಪಾಯ ${r.riskScore})`).join('; ')}.`
      : 'ಯಾವುದೇ ಪುನರಾವರ್ತಿತ ಅಪರಾಧಿಗಳು ದಾಖಲಾಗಿಲ್ಲ.';
  const fu = ['Show the criminal history of the top offender', 'Which districts have the most repeat offenders?', 'List heinous cases by habitual offenders'];
    const { answer, followups } = localize(en, kn, fu);
    return fmt(rows, sql, answer, followups, { evidence: [`${rows.length} habitual offenders`] });
  }

  // 3) Suspicious financial transactions / money trail
  if (/\b(financ|transaction|money|laundering|suspicious\s+txn|bank)/.test(q)) {
    const sql = `SELECT ft.Amount amount, ft.Channel channel, ft.TxnDate date,
        pf.FullName fromPerson, pt.FullName toPerson, c.CrimeNo CrimeNo
      FROM FinancialTransaction ft
      JOIN BankAccount fa ON fa.AccountID=ft.FromAccountID
      JOIN BankAccount ta ON ta.AccountID=ft.ToAccountID
      LEFT JOIN PersonMaster pf ON pf.PersonMasterID=fa.PersonMasterID
      LEFT JOIN PersonMaster pt ON pt.PersonMasterID=ta.PersonMasterID
      LEFT JOIN CaseMaster c ON c.CaseMasterID=ft.CaseMasterID
      WHERE ft.IsSuspicious=1 ORDER BY ft.Amount DESC LIMIT 15`;
    const rows = run(sql);
    const total = db.prepare('SELECT COUNT(*) c, SUM(Amount) s FROM FinancialTransaction WHERE IsSuspicious=1').get();
    return fmt(rows, sql,
      `There are ${total.c} suspicious transactions totalling ₹${(total.s || 0).toLocaleString('en-IN')}. Largest flows shown, with money moving between linked persons and mule accounts.`,
      ['Trace the money trail for the largest transaction', 'Which accounts are flagged as mules?', 'Show financial links for a specific FIR'],
      { evidence: [`${total.c} suspicious transactions`] });
  }

  // 3.5) Filtered count / list by crime type and/or district
  const districtRows = db.prepare('SELECT DistrictName FROM District').all().map((r) => r.DistrictName);
  const foundDistrict = districtHint || districtRows.find((d) => {
    const dl = d.toLowerCase();
    const first = dl.split(' ')[0];
    return q.includes(dl) || (first.length > 3 && q.includes(first));
  });
  const SYN = { ndps: 'drug', narcotic: 'drug', abduction: 'kidnap', molest: 'modesty', harassment: 'harassment' };
  const CRIME_TERMS = ['cyber', 'theft', 'murder', 'robbery', 'burglary', 'burglar', 'dacoity', 'rape', 'dowry', 'cruelty', 'grievous', 'assault', 'hurt', 'drug', 'ndps', 'narcotic', 'fraud', 'cheating', 'forgery', 'accident', 'missing', 'kidnap', 'abduction', 'riot', 'extortion', 'arms', 'harassment', 'women', 'financial'];
  let crimeTerm = crimeHint || CRIME_TERMS.find((t) => q.includes(t));
  if (crimeTerm && SYN[crimeTerm]) crimeTerm = SYN[crimeTerm];
  if (foundDistrict || crimeTerm) {
    const where = [];
    const params = [];
    if (crimeTerm === 'cyber') {
      where.push('(lower(h.CrimeGroupName) LIKE ? OR lower(sh.CrimeHeadName) LIKE ? OR lower(h.CrimeGroupName) LIKE ?)');
      params.push('%cyber%', '%cyber%', '%cyber%');
    } else if (crimeTerm) {
      where.push('(lower(sh.CrimeHeadName) LIKE ? OR lower(h.CrimeGroupName) LIKE ?)');
      params.push(`%${crimeTerm}%`, `%${crimeTerm}%`);
    }
    if (foundDistrict) { where.push('lower(d.DistrictName)=?'); params.push(foundDistrict.toLowerCase()); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const base = `FROM CaseMaster c
      JOIN CrimeSubHead sh ON sh.CrimeSubHeadID=c.CrimeMinorHeadID
      JOIN CrimeHead h ON h.CrimeHeadID=c.CrimeMajorHeadID
      JOIN Unit u ON u.UnitID=c.PoliceStationID JOIN District d ON d.DistrictID=u.DistrictID`;
    const isCount = /\b(how many|count|number of|total)\b/.test(q);
    if (isCount) {
      const sql = `SELECT COUNT(*) cases ${base} ${whereSql}`;
      const n = db.prepare(sql).get(...params).cases;
      const label = `${crimeTerm || ''}${crimeTerm ? ' ' : ''}${foundDistrict ? `in ${foundDistrict} ` : ''}`.trim();
      const sample = db.prepare(`SELECT c.CrimeNo ${base} ${whereSql} ORDER BY c.CrimeRegisteredDate DESC LIMIT 1`).get(...params);
      const en = `There ${n === 1 ? 'is' : 'are'} ${n} ${label} case(s) recorded.`;
      const kn = knCountAnswer(n, crimeTerm, foundDistrict, sample?.CrimeNo);
      const fu = ['Break these down by police station', 'Show their case status', 'List the most recent ones'];
      const { answer, followups } = localize(en, kn, fu);
      return fmt([{ crime: crimeTerm || 'all', district: foundDistrict || 'all', cases: n }], sql,
        answer, followups, { evidence: [`${n} cases`] });
    }
    const sql = `SELECT c.CrimeNo, sh.CrimeHeadName crime, d.DistrictName district, c.CrimeRegisteredDate date, st.CaseStatusName status
      ${base} LEFT JOIN CaseStatusMaster st ON st.CaseStatusID=c.CaseStatusID ${whereSql}
      ORDER BY c.CrimeRegisteredDate DESC LIMIT 20`;
    const rows = db.prepare(sql).all(...params);
    if (rows.length) {
      return fmt(rows, sql,
        `Found ${rows.length} matching FIRs${foundDistrict ? ` in ${foundDistrict}` : ''}${crimeTerm ? ` for "${crimeTerm}"` : ''}. Most recent: FIR ${rows[0].CrimeNo} (${rows[0].crime}, ${rows[0].date}).`,
        ['How many is that in total?', 'Filter to heinous cases only', 'Which station has the most of these?']);
    }
  }

  // 4) Count by district (hotspots)
  if (/\b(district|hotspot|which\s+area|top\s+area|most\s+crime)/.test(q)) {
    const sql = `SELECT d.DistrictName district, COUNT(*) cases
      FROM CaseMaster c JOIN Unit u ON u.UnitID=c.PoliceStationID
      JOIN District d ON d.DistrictID=u.DistrictID
      GROUP BY d.DistrictName ORDER BY cases DESC LIMIT 12`;
    const rows = run(sql);
    const en = `Crime hotspots by district: ${rows.slice(0, 5).map((r) => `${r.district} (${r.cases})`).join(', ')}. ${rows[0].district} has the highest FIR volume.`;
    const kn = `ಜಿಲ್ಲೆವಾರು ಅಪರಾಧ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು: ${rows.slice(0, 5).map((r) => `${r.district} (${r.cases})`).join(', ')}. ಅತ್ಯಧಿಕ FIRಗಳು ${rows[0].district}ನಲ್ಲಿ.`;
    const fu = ['Break down Bengaluru City crimes by type', 'Show the crime trend over the last 6 months', 'Which crime type is most common?'];
    const { answer, followups } = localize(en, kn, fu);
    return fmt(rows, sql, answer, followups,
      { chart: { type: 'bar', x: 'district', y: 'cases' }, evidence: [`${rows.length} districts`] });
  }

  // 5) Count / breakdown by crime type
  if (/\b(crime\s+type|by\s+type|category|breakdown|kind\s+of\s+crime|which\s+crime)/.test(q)) {
    const sql = `SELECT h.CrimeGroupName crimeHead, COUNT(*) cases
      FROM CaseMaster c JOIN CrimeHead h ON h.CrimeHeadID=c.CrimeMajorHeadID
      GROUP BY h.CrimeGroupName ORDER BY cases DESC`;
    const rows = run(sql);
    const en = `Crime distribution: ${rows.slice(0, 5).map((r) => `${r.crimeHead} (${r.cases})`).join(', ')}.`;
    const kn = `ಅಪರಾಧ ವಿತರಣೆ: ${rows.slice(0, 5).map((r) => `${r.crimeHead} (${r.cases})`).join(', ')}.`;
    const fu = ['Show property crimes by district', 'What is the case disposal status?', 'Trend of cybercrime over time'];
    const { answer, followups } = localize(en, kn, fu);
    return fmt(rows, sql, answer, followups,
      { chart: { type: 'bar', x: 'crimeHead', y: 'cases' }, evidence: [`${rows.length} crime heads`] });
  }

  // 6) Status / disposal
  if (/\b(status|disposed|chargesheet|charge\s*sheet|pending|convicted|under\s+investigation|disposal)/.test(q)) {
    const sql = `SELECT st.CaseStatusName status, COUNT(*) cases
      FROM CaseMaster c JOIN CaseStatusMaster st ON st.CaseStatusID=c.CaseStatusID
      GROUP BY st.CaseStatusName ORDER BY cases DESC`;
    const rows = run(sql);
    return fmt(rows, sql,
      `Case status breakdown: ${rows.map((r) => `${r.status}: ${r.cases}`).join(', ')}.`,
      ['How many cases are pending trial?', 'Show chargesheeted cases in Mysuru', 'Conviction rate by crime type'],
      { chart: { type: 'bar', x: 'status', y: 'cases' }, evidence: [`${rows.length} statuses`] });
  }

  // 7) Recent / trend over time
  if (/\b(recent|latest|last\s+(month|week|year)|trend|over\s+time|monthly)/.test(q)) {
    const sql = `SELECT substr(c.CrimeRegisteredDate,1,7) month, COUNT(*) cases
      FROM CaseMaster c WHERE c.CrimeRegisteredDate >= date('now','-12 months')
      GROUP BY month ORDER BY month`;
    const rows = run(sql);
    return fmt(rows, sql,
      `Monthly FIR counts over the last 12 months (${rows.length} months of data). Latest month: ${rows.length ? `${rows[rows.length - 1].month} = ${rows[rows.length - 1].cases} cases` : 'n/a'}.`,
      ['Which crime type is rising fastest?', 'Show hotspots for the last month', 'Compare this year vs last year'],
      { chart: { type: 'line', x: 'month', y: 'cases' }, evidence: [`${rows.length} months`] });
  }

  // 8) Total / overview
  if (/\b(how\s+many|total|overview|summary|count)\b/.test(q)) {
    const t = db.prepare('SELECT (SELECT COUNT(*) FROM CaseMaster) cases, (SELECT COUNT(*) FROM Accused) accused, (SELECT COUNT(*) FROM ArrestSurrender) arrests').get();
    return fmt([t], 'SELECT COUNT(*) FROM CaseMaster',
      `The database holds ${t.cases} FIRs, ${t.accused} accused entries, and ${t.arrests} arrests across 16 Karnataka districts.`,
      ['Break down cases by crime type', 'Which districts are hotspots?', 'Show repeat offenders'],
      { evidence: [`${t.cases} FIRs`] });
  }

  // 9) Keyword search fallback over brief facts / crime type
  const kw = q.replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !['show', 'find', 'give', 'list', 'cases', 'crime', 'crimes', 'about', 'which', 'what', 'were', 'have', 'police'].includes(w));
  if (kw.length) {
    const term = `%${kw[0]}%`;
    const sql = `SELECT c.CrimeNo, sh.CrimeHeadName crime, d.DistrictName district, c.CrimeRegisteredDate date, st.CaseStatusName status
      FROM CaseMaster c
      LEFT JOIN CrimeSubHead sh ON sh.CrimeSubHeadID=c.CrimeMinorHeadID
      LEFT JOIN Unit u ON u.UnitID=c.PoliceStationID LEFT JOIN District d ON d.DistrictID=u.DistrictID
      LEFT JOIN CaseStatusMaster st ON st.CaseStatusID=c.CaseStatusID
      WHERE c.BriefFacts LIKE ? OR sh.CrimeHeadName LIKE ? OR d.DistrictName LIKE ?
      ORDER BY c.CrimeRegisteredDate DESC LIMIT 20`;
    const rows = run(sql, term, term, term);
    if (rows.length) {
      return fmt(rows, sql.replace(/\?/g, `'${term}'`),
        `Found ${rows.length} FIRs matching "${kw[0]}". Most recent: FIR ${rows[0].CrimeNo} (${rows[0].crime}, ${rows[0].district}).`,
        ['Filter these by status', 'Show only heinous cases', 'Which district has the most of these?']);
    }
  }

  return {
    mode: 'offline',
    answer: replyKn
      ? 'ನಾನು FIRಗಳು, ಆರೋಪಿಗಳು, ಜಿಲ್ಲೆ/ಹಾಟ್‌ಸ್ಪಾಟ್, ಅಪರಾಧ ಪ್ರಕಾರ, ಪುನರಾವರ್ತಿತ ಅಪರಾಧಿಗಳು ಮತ್ತು ಹಣಕಾಸಿನ ಸಂಬಂಧಗಳ ಬಗ್ಗೆ ಉತ್ತರಿಸಬಹುದು. ಉದಾಹರಣೆ: "ಬೆಂಗಳೂರಿನಲ್ಲಿ ಎಷ್ಟು ಸೈಬರ್ ಅಪರಾಧ ಪ್ರಕರಣಗಳಿವೆ?" ಅಥವಾ "ಪುನರಾವರ್ತಿತ ಅಪರಾಧಿಗಳನ್ನು ತೋರಿಸಿ". (ವಿಶಾಲ ಪ್ರಶ್ನೆಗಳಿಗೆ ಉಚಿತ Ollama LLM ಸಂಪರ್ಕಿಸಿ — RUN.md ನೋಡಿ.)'
      : `I can answer questions about FIRs, accused, victims, districts/hotspots, crime types, case status, repeat offenders, and financial links. Try: "How many cybercrime cases in Bengaluru?", "Show repeat offenders", or "Look up FIR <number>". (Optionally connect a free local LLM via Ollama for open-ended questions — see RUN.md.)`,
    sql: null, rows: [], columns: [], evidence: [], followups: replyKn
      ? knFollowups(['Which districts are crime hotspots?', 'Show repeat offenders', 'Break down cases by crime type'])
      : ['Which districts are crime hotspots?', 'Show repeat offenders', 'Break down cases by crime type'],
  };
}

module.exports = { handle };
