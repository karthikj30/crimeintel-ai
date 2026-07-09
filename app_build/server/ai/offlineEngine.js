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

function handle(question) {
  const db = getFirDb();
  const q = (question || '').toLowerCase();
  const run = (sql, ...p) => db.prepare(sql).all(...p);

  // 1) FIR lookup by crime number
  const mNo = question.match(/\b(\d{12,20})\b/) || question.match(/(?:fir|crime)\s*(?:no\.?|number|#)?\s*([0-9]{6,})/i);
  if (mNo) {
    const full = getCaseFull(mNo[1]);
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

  // 2) Repeat / habitual offenders
  if (/\b(repeat|habitual|recidivis|multiple\s+fir|most\s+cases|frequent\s+offend)/.test(q)) {
    const sql = `SELECT p.FullName name, p.RiskScore riskScore, COUNT(a.CaseMasterID) cases,
        d.DistrictName district
      FROM PersonMaster p JOIN Accused a ON a.PersonMasterID=p.PersonMasterID
      LEFT JOIN District d ON d.DistrictID=p.DistrictID
      WHERE p.IsHabitualOffender=1
      GROUP BY p.PersonMasterID ORDER BY cases DESC, riskScore DESC LIMIT 15`;
    const rows = run(sql);
    return fmt(rows, sql,
      `Found ${rows.length} habitual offenders (linked to 3+ FIRs). Top: ${rows.slice(0, 3).map((r) => `${r.name} (${r.cases} cases, risk ${r.riskScore})`).join('; ')}.`,
      ['Show the criminal history of the top offender', 'Which districts have the most repeat offenders?', 'List heinous cases by habitual offenders'],
      { evidence: [`${rows.length} habitual offenders`] });
  }

  // 3) Suspicious financial transactions / money trail
  if (/\b(financ|transaction|money|laundering|suspicious\s+txn|bank|mule)/.test(q)) {
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
  const foundDistrict = districtRows.find((d) => {
    const dl = d.toLowerCase();
    const first = dl.split(' ')[0];
    return q.includes(dl) || (first.length > 3 && q.includes(first));
  });
  const SYN = { ndps: 'drug', narcotic: 'drug', abduction: 'kidnap', molest: 'modesty', harassment: 'harassment' };
  const CRIME_TERMS = ['cyber', 'theft', 'murder', 'robbery', 'burglary', 'burglar', 'dacoity', 'rape', 'dowry', 'cruelty', 'grievous', 'assault', 'hurt', 'drug', 'ndps', 'narcotic', 'fraud', 'cheating', 'forgery', 'accident', 'missing', 'kidnap', 'abduction', 'riot', 'extortion', 'arms', 'harassment', 'women'];
  let crimeTerm = CRIME_TERMS.find((t) => q.includes(t));
  if (crimeTerm && SYN[crimeTerm]) crimeTerm = SYN[crimeTerm];
  if (foundDistrict || crimeTerm) {
    const where = [];
    const params = [];
    if (crimeTerm) { where.push('(lower(sh.CrimeHeadName) LIKE ? OR lower(h.CrimeGroupName) LIKE ?)'); params.push(`%${crimeTerm}%`, `%${crimeTerm}%`); }
    if (foundDistrict) { where.push('lower(d.DistrictName)=?'); params.push(foundDistrict.toLowerCase()); }
    const whereSql = 'WHERE ' + where.join(' AND ');
    const base = `FROM CaseMaster c
      JOIN CrimeSubHead sh ON sh.CrimeSubHeadID=c.CrimeMinorHeadID
      JOIN CrimeHead h ON h.CrimeHeadID=c.CrimeMajorHeadID
      JOIN Unit u ON u.UnitID=c.PoliceStationID JOIN District d ON d.DistrictID=u.DistrictID`;
    const isCount = /\b(how many|count|number of|total)\b/.test(q);
    if (isCount) {
      const sql = `SELECT COUNT(*) cases ${base} ${whereSql}`;
      const n = db.prepare(sql).get(...params).cases;
      const label = `${crimeTerm || ''}${crimeTerm ? ' ' : ''}${foundDistrict ? `in ${foundDistrict} ` : ''}`.trim();
      return fmt([{ crime: crimeTerm || 'all', district: foundDistrict || 'all', cases: n }], sql,
        `There ${n === 1 ? 'is' : 'are'} ${n} ${label} case(s) recorded.`,
        ['Break these down by police station', 'Show their case status', 'List the most recent ones'],
        { evidence: [`${n} cases`] });
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
    return fmt(rows, sql,
      `Crime hotspots by district: ${rows.slice(0, 5).map((r) => `${r.district} (${r.cases})`).join(', ')}. ${rows[0].district} has the highest FIR volume.`,
      ['Break down Bengaluru City crimes by type', 'Show the crime trend over the last 6 months', 'Which crime type is most common?'],
      { chart: { type: 'bar', x: 'district', y: 'cases' }, evidence: [`${rows.length} districts`] });
  }

  // 5) Count / breakdown by crime type
  if (/\b(crime\s+type|by\s+type|category|breakdown|kind\s+of\s+crime|which\s+crime)/.test(q)) {
    const sql = `SELECT h.CrimeGroupName crimeHead, COUNT(*) cases
      FROM CaseMaster c JOIN CrimeHead h ON h.CrimeHeadID=c.CrimeMajorHeadID
      GROUP BY h.CrimeGroupName ORDER BY cases DESC`;
    const rows = run(sql);
    return fmt(rows, sql,
      `Crime distribution: ${rows.slice(0, 5).map((r) => `${r.crimeHead} (${r.cases})`).join(', ')}.`,
      ['Show property crimes by district', 'What is the case disposal status?', 'Trend of cybercrime over time'],
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
    answer: `I can answer questions about FIRs, accused, victims, districts/hotspots, crime types, case status, repeat offenders, and financial links. Try: "How many cybercrime cases in Bengaluru?", "Show repeat offenders", or "Look up FIR <number>". (Optionally connect a free local LLM via Ollama for open-ended questions — see RUN.md.)`,
    sql: null, rows: [], columns: [], evidence: [], followups: ['Which districts are crime hotspots?', 'Show repeat offenders', 'Break down cases by crime type'],
  };
}

module.exports = { handle };
