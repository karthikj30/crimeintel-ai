// ============================================================
// 7. Repeat-Victim Safeguarding (MARAC-style)
// Flag victims appearing across multiple FIRs — esp. crimes against women
// ============================================================
const { getFirDb } = require('../fir/db');

const WOMEN_CRIME = /dowry|cruelty|rape|modesty|harassment|stalking|women|498a|domestic|molest/i;

function safeguardingAlerts({ limit = 30 } = {}) {
  const db = getFirDb();

  // Victims with canonical identity across 2+ FIRs
  const victims = db.prepare(`
    SELECT p.PersonMasterID id, p.FullName name, p.Gender gender, p.AgeYear age,
           d.DistrictName district,
           COUNT(DISTINCT v.CaseMasterID) firCount,
           GROUP_CONCAT(DISTINCT c.CrimeNo) crimeNos,
           GROUP_CONCAT(DISTINCT sh.CrimeHeadName) crimes,
           GROUP_CONCAT(DISTINCT h.CrimeGroupName) heads,
           MAX(c.CrimeRegisteredDate) lastFir,
           MIN(c.CrimeRegisteredDate) firstFir,
           SUM(CASE WHEN c.GravityOffenceID=1 THEN 1 ELSE 0 END) heinous,
           SUM(CASE WHEN h.CrimeGroupName LIKE '%Women%' OR sh.CrimeHeadName LIKE '%Dowry%'
                     OR sh.CrimeHeadName LIKE '%Cruelty%' OR sh.CrimeHeadName LIKE '%Rape%'
                     OR sh.CrimeHeadName LIKE '%Harassment%' OR sh.CrimeHeadName LIKE '%Modesty%'
                     OR sh.CrimeHeadName LIKE '%Stalking%' THEN 1 ELSE 0 END) againstWomen
    FROM Victim v
    JOIN PersonMaster p ON p.PersonMasterID = v.PersonMasterID
    JOIN CaseMaster c ON c.CaseMasterID = v.CaseMasterID
    JOIN CrimeSubHead sh ON sh.CrimeSubHeadID = c.CrimeMinorHeadID
    JOIN CrimeHead h ON h.CrimeHeadID = c.CrimeMajorHeadID
    LEFT JOIN District d ON d.DistrictID = p.DistrictID
    WHERE v.PersonMasterID IS NOT NULL
    GROUP BY p.PersonMasterID
    HAVING firCount >= 2
    ORDER BY againstWomen DESC, firCount DESC, heinous DESC
    LIMIT 80
  `).all();

  const alerts = victims.map((v) => {
    const crimes = (v.crimes || '').split(',').filter(Boolean);
    const isWomenRisk = v.againstWomen > 0 || crimes.some((c) => WOMEN_CRIME.test(c)) || v.gender === 'F';
    let risk = 'monitor';
    let score = Math.min(100, v.firCount * 18 + v.heinous * 20 + v.againstWomen * 25);
    if (v.againstWomen >= 2 || (v.againstWomen >= 1 && v.firCount >= 3)) risk = 'marac';
    else if (v.againstWomen >= 1 || v.firCount >= 3) risk = 'elevated';

    return {
      id: v.id,
      name: v.name,
      age: v.age,
      gender: v.gender,
      district: v.district,
      firCount: v.firCount,
      heinous: v.heinous,
      againstWomenCases: v.againstWomen,
      crimes: crimes.slice(0, 6),
      crimeNos: (v.crimeNos || '').split(',').filter(Boolean).slice(0, 8),
      firstFir: v.firstFir,
      lastFir: v.lastFir,
      safeguardingRisk: risk,
      score,
      isWomenRisk,
      action: risk === 'marac'
        ? 'MARAC-style multi-agency safeguarding review recommended before escalation.'
        : risk === 'elevated'
          ? 'Proactive welfare check / IO notification — repeat victimization pattern detected.'
          : 'Monitor — victim appears in multiple FIRs.',
    };
  });

  alerts.sort((a, b) => {
    const rank = { marac: 3, elevated: 2, monitor: 1 };
    return (rank[b.safeguardingRisk] || 0) - (rank[a.safeguardingRisk] || 0) || b.score - a.score;
  });

  return {
    framing: 'UK MARAC-inspired repeat-victim safeguarding. Protective alert for investigators / welfare — not a public list.',
    summary: {
      repeatVictims: alerts.length,
      maracPriority: alerts.filter((a) => a.safeguardingRisk === 'marac').length,
      elevated: alerts.filter((a) => a.safeguardingRisk === 'elevated').length,
      crimesAgainstWomen: alerts.filter((a) => a.isWomenRisk).length,
    },
    alerts: alerts.slice(0, limit),
  };
}

module.exports = { safeguardingAlerts };
