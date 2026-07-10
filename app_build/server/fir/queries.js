// ============================================================
// KSP CRIME INTELLIGENCE — Read-only FIR Query Layer
// Reusable repository functions for the API + AI engine.
// ============================================================
const { getFirDb } = require('./db');

function overviewStats(dbIn) {
  const db = dbIn || getFirDb();
  const one = (sql) => db.prepare(sql).get();
  const all = (sql) => db.prepare(sql).all();
  return {
    totals: {
      cases: one('SELECT COUNT(*) c FROM CaseMaster').c,
      accused: one('SELECT COUNT(*) c FROM Accused').c,
      distinctAccused: one('SELECT COUNT(DISTINCT PersonMasterID) c FROM Accused').c,
      victims: one('SELECT COUNT(*) c FROM Victim').c,
      arrests: one('SELECT COUNT(*) c FROM ArrestSurrender').c,
      chargesheets: one('SELECT COUNT(*) c FROM ChargesheetDetails').c,
      stations: one('SELECT COUNT(*) c FROM Unit').c,
      districts: one('SELECT COUNT(*) c FROM District').c,
      habitualOffenders: one('SELECT COUNT(*) c FROM PersonMaster WHERE IsHabitualOffender=1').c,
      suspiciousTxns: one('SELECT COUNT(*) c FROM FinancialTransaction WHERE IsSuspicious=1').c,
    },
    byStatus: all(`SELECT s.CaseStatusName status, COUNT(*) count
      FROM CaseMaster c JOIN CaseStatusMaster s ON s.CaseStatusID=c.CaseStatusID
      GROUP BY s.CaseStatusName ORDER BY count DESC`),
    byCrimeHead: all(`SELECT h.CrimeGroupName head, COUNT(*) count
      FROM CaseMaster c JOIN CrimeHead h ON h.CrimeHeadID=c.CrimeMajorHeadID
      GROUP BY h.CrimeGroupName ORDER BY count DESC`),
    topDistricts: all(`SELECT d.DistrictName district, COUNT(*) count
      FROM CaseMaster c JOIN Unit u ON u.UnitID=c.PoliceStationID
      JOIN District d ON d.DistrictID=u.DistrictID
      GROUP BY d.DistrictName ORDER BY count DESC LIMIT 8`),
  };
}

// Full FIR detail by CrimeNo (string) or CaseMasterID (number).
function getCaseFull(idOrCrimeNo, dbIn) {
  const db = dbIn || getFirDb();
  const byNumber = /^\d+$/.test(String(idOrCrimeNo)) && String(idOrCrimeNo).length <= 8;
  const where = byNumber ? 'c.CaseMasterID = ?' : 'c.CrimeNo = ?';

  const c = db.prepare(`
    SELECT c.*, u.UnitName station, d.DistrictName district,
           st.CaseStatusName status, cat.LookupValue category,
           g.LookupValue gravity, h.CrimeGroupName crimeHead, sh.CrimeHeadName crimeSubHead,
           ct.CourtName court, e.FirstName ioName, r.RankName ioRank
    FROM CaseMaster c
    LEFT JOIN Unit u ON u.UnitID = c.PoliceStationID
    LEFT JOIN District d ON d.DistrictID = u.DistrictID
    LEFT JOIN CaseStatusMaster st ON st.CaseStatusID = c.CaseStatusID
    LEFT JOIN CaseCategory cat ON cat.CaseCategoryID = c.CaseCategoryID
    LEFT JOIN GravityOffence g ON g.GravityOffenceID = c.GravityOffenceID
    LEFT JOIN CrimeHead h ON h.CrimeHeadID = c.CrimeMajorHeadID
    LEFT JOIN CrimeSubHead sh ON sh.CrimeSubHeadID = c.CrimeMinorHeadID
    LEFT JOIN Court ct ON ct.CourtID = c.CourtID
    LEFT JOIN Employee e ON e.EmployeeID = c.PolicePersonID
    LEFT JOIN Rank r ON r.RankID = e.RankID
    WHERE ${where}
  `).get(idOrCrimeNo);

  if (!c) return null;
  const cid = c.CaseMasterID;

  const accused = db.prepare(`
    SELECT a.PersonID label, a.AccusedName name, a.AgeYear age,
           CASE a.GenderID WHEN 1 THEN 'M' WHEN 2 THEN 'F' ELSE 'T' END gender,
           p.IsHabitualOffender habitual, p.RiskScore riskScore, a.PersonMasterID personId
    FROM Accused a LEFT JOIN PersonMaster p ON p.PersonMasterID = a.PersonMasterID
    WHERE a.CaseMasterID = ? ORDER BY a.PersonID`).all(cid);

  const victims = db.prepare(`SELECT VictimName name, AgeYear age,
    CASE GenderID WHEN 1 THEN 'M' WHEN 2 THEN 'F' ELSE 'T' END gender FROM Victim WHERE CaseMasterID = ?`).all(cid);

  const complainant = db.prepare(`
    SELECT cd.ComplainantName name, cd.AgeYear age, o.OccupationName occupation,
           rl.ReligionName religion, ca.caste_master_name caste
    FROM ComplainantDetails cd
    LEFT JOIN OccupationMaster o ON o.OccupationID = cd.OccupationID
    LEFT JOIN ReligionMaster rl ON rl.ReligionID = cd.ReligionID
    LEFT JOIN CasteMaster ca ON ca.caste_master_id = cd.CasteID
    WHERE cd.CaseMasterID = ?`).get(cid);

  const sections = db.prepare(`
    SELECT asa.ActID act, s.SectionCode section, s.SectionDescription description
    FROM ActSectionAssociation asa JOIN Section s ON s.SectionID = asa.SectionID
    WHERE asa.CaseMasterID = ? ORDER BY asa.SectionOrderID`).all(cid);

  const arrests = db.prepare(`
    SELECT ar.ArrestSurrenderDate date, a.AccusedName accused,
           CASE ar.ArrestSurrenderTypeID WHEN 1 THEN 'Arrest' ELSE 'Surrender' END type
    FROM ArrestSurrender ar LEFT JOIN Accused a ON a.AccusedMasterID = ar.AccusedMasterID
    WHERE ar.CaseMasterID = ?`).all(cid);

  const chargesheet = db.prepare(`SELECT csdate date,
    CASE cstype WHEN 'A' THEN 'Chargesheet' WHEN 'B' THEN 'B-Report (False)' ELSE 'C-Report (Undetected)' END type
    FROM ChargesheetDetails WHERE CaseMasterID = ?`).get(cid);

  return { case: c, accused, victims, complainant, sections, arrests, chargesheet };
}

// Person / offender profile with criminal history.
function getPersonProfile(personId) {
  const db = getFirDb();
  const p = db.prepare(`
    SELECT p.*, ca.caste_master_name caste, rl.ReligionName religion, o.OccupationName occupation, d.DistrictName district
    FROM PersonMaster p
    LEFT JOIN CasteMaster ca ON ca.caste_master_id = p.CasteID
    LEFT JOIN ReligionMaster rl ON rl.ReligionID = p.ReligionID
    LEFT JOIN OccupationMaster o ON o.OccupationID = p.OccupationID
    LEFT JOIN District d ON d.DistrictID = p.DistrictID
    WHERE p.PersonMasterID = ?`).get(personId);
  if (!p) return null;

  const cases = db.prepare(`
    SELECT c.CrimeNo, c.CrimeRegisteredDate date, sh.CrimeHeadName crime, g.LookupValue gravity,
           st.CaseStatusName status, u.UnitName station
    FROM Accused a JOIN CaseMaster c ON c.CaseMasterID = a.CaseMasterID
    LEFT JOIN CrimeSubHead sh ON sh.CrimeSubHeadID = c.CrimeMinorHeadID
    LEFT JOIN GravityOffence g ON g.GravityOffenceID = c.GravityOffenceID
    LEFT JOIN CaseStatusMaster st ON st.CaseStatusID = c.CaseStatusID
    LEFT JOIN Unit u ON u.UnitID = c.PoliceStationID
    WHERE a.PersonMasterID = ? ORDER BY c.CrimeRegisteredDate DESC`).all(personId);

  return { person: p, cases };
}

module.exports = { overviewStats, getCaseFull, getPersonProfile };
