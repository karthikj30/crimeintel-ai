// ============================================================
// KSP CRIME INTELLIGENCE — Schema Context for NL->SQL
// ------------------------------------------------------------
// Produces a compact, accurate description of the FIR schema, its
// join map, enums, and grounded reference values (real districts,
// crime heads, statuses, acts) so the LLM writes correct SQLite.
// Cached after first build.
// ============================================================

const { getFirDb } = require('../fir/db');

let cached = null;

const STATIC = `
You translate natural-language questions from Karnataka State Police (KSP) investigators
into a SINGLE read-only SQLite SELECT query over the FIR (crime records) database, then
help explain the results. This is a Karnataka Police FIR schema.

CORE TABLES (one row per FIR unless noted):
- CaseMaster(CaseMasterID PK, CrimeNo, CaseNo, CrimeRegisteredDate DATE, PolicePersonID->Employee,
    PoliceStationID->Unit, CaseCategoryID->CaseCategory, GravityOffenceID->GravityOffence,
    CrimeMajorHeadID->CrimeHead, CrimeMinorHeadID->CrimeSubHead, CaseStatusID->CaseStatusMaster,
    CourtID->Court, IncidentFromDate DATETIME, IncidentToDate DATETIME, latitude, longitude, BriefFacts)
    -- CrimeNo is the PUBLIC FIR number investigators refer to (a string). ALWAYS select it when listing FIRs.
- Accused(AccusedMasterID PK, CaseMasterID->CaseMaster, AccusedName, AgeYear, GenderID, PersonID 'A1'/'A2',
    PersonMasterID->PersonMaster)   -- many accused per FIR
- Victim(VictimMasterID PK, CaseMasterID, VictimName, AgeYear, GenderID, VictimPolice, PersonMasterID)
- ComplainantDetails(ComplainantID PK, CaseMasterID, ComplainantName, AgeYear, OccupationID->OccupationMaster,
    ReligionID->ReligionMaster, CasteID->CasteMaster, GenderID, PersonMasterID)
- ArrestSurrender(ArrestSurrenderID PK, CaseMasterID, ArrestSurrenderTypeID (1=Arrest,2=Surrender),
    ArrestSurrenderDate, PoliceStationID->Unit, IOID->Employee, CourtID, AccusedMasterID->Accused)
- ActSectionAssociation(CaseMasterID, ActID->Act.ActCode, SectionID->Section.SectionID)  -- charges per FIR
- ChargesheetDetails(CSID PK, CaseMasterID, csdate, cstype (A=Chargesheet,B=False,C=Undetected), PolicePersonID)

PERSON / NETWORK / FINANCIAL (analytics extensions):
- PersonMaster(PersonMasterID PK, FullName, Gender 'M'/'F'/'T', AgeYear, CasteID, ReligionID, OccupationID,
    DistrictID->District, IsHabitualOffender 0/1, RiskScore 0-100)
    -- CANONICAL identity. Accused/Victim/Complainant.PersonMasterID link the SAME person across many FIRs.
    -- Repeat/habitual offenders: PersonMaster.IsHabitualOffender=1, or COUNT FIRs per Accused.PersonMasterID.
- PhoneNumber(PhoneID PK, PersonMasterID, Number, Imei)   -- shared Number => network link
- BankAccount(AccountID PK, PersonMasterID, BankName, AccountNo, IFSC, IsFlagged 0/1)
- FinancialTransaction(TxnID PK, FromAccountID->BankAccount, ToAccountID->BankAccount, Amount, TxnDate,
    Channel, CaseMasterID, IsSuspicious 0/1)   -- money trails

MASTERS / LOOKUPS:
- Unit(UnitID PK, UnitName [police station], DistrictID->District, latitude, longitude)
- District(DistrictID PK, DistrictName, StateID)   -- CaseMaster has NO direct district; join via Unit.
- Employee(EmployeeID PK, FirstName, UnitID, RankID->Rank, DistrictID)   -- police officers / IOs
- CrimeHead(CrimeHeadID PK, CrimeGroupName)         -- major head e.g. 'Crimes Against Property'
- CrimeSubHead(CrimeSubHeadID PK, CrimeHeadID, CrimeHeadName)  -- e.g. 'Theft','Murder'
- Act(ActCode PK, ActDescription, ShortName), Section(SectionID PK, ActCode, SectionCode, SectionDescription)
- CaseStatusMaster(CaseStatusID PK, CaseStatusName), GravityOffence(GravityOffenceID PK, LookupValue),
  CaseCategory(CaseCategoryID PK, LookupValue), Court(CourtID PK, CourtName, DistrictID)
- CasteMaster(caste_master_id PK, caste_master_name), ReligionMaster(ReligionID PK, ReligionName),
  OccupationMaster(OccupationID PK, OccupationName), Rank(RankID PK, RankName)

KEY JOINS:
  CaseMaster c JOIN Unit u ON u.UnitID=c.PoliceStationID JOIN District d ON d.DistrictID=u.DistrictID
  c JOIN CrimeSubHead sh ON sh.CrimeSubHeadID=c.CrimeMinorHeadID JOIN CrimeHead h ON h.CrimeHeadID=c.CrimeMajorHeadID
  c JOIN CaseStatusMaster st ON st.CaseStatusID=c.CaseStatusID
  Accused a JOIN CaseMaster c ON c.CaseMasterID=a.CaseMasterID
  ActSectionAssociation asa JOIN Section s ON s.SectionID=asa.SectionID

ENUMS: GenderID 1=Male,2=Female,3=Transgender. cstype A=Chargesheet,B=False Case,C=Undetected.

RULES:
1. Output ONE SQLite SELECT (or WITH) statement only. No writes, no PRAGMA, no semicolons, no comments.
2. Dates are ISO text. CrimeRegisteredDate is 'YYYY-MM-DD'. Use SQLite date() functions
   (e.g. WHERE c.CrimeRegisteredDate >= date('now','-1 month')). Current data spans ~2 years to today.
3. When listing FIRs, SELECT c.CrimeNo plus readable columns (join to names, not raw IDs).
4. Prefer aggregates for "how many / count / trend / top". Add GROUP BY + ORDER BY + LIMIT.
5. District filters must join Unit->District. Match names case-insensitively (use LIKE or lower()).
6. Keep result sets small (LIMIT 50 unless aggregating). Never SELECT *.
`;

function buildSchemaContext() {
  if (cached) return cached;
  const db = getFirDb();
  const list = (sql) => db.prepare(sql).all().map((r) => Object.values(r)[0]);

  const districts = list('SELECT DistrictName FROM District ORDER BY DistrictName');
  const subheads = list('SELECT CrimeHeadName FROM CrimeSubHead ORDER BY CrimeHeadName');
  const heads = list('SELECT CrimeGroupName FROM CrimeHead');
  const statuses = list('SELECT CaseStatusName FROM CaseStatusMaster');
  const acts = db.prepare('SELECT ActCode, ShortName FROM Act').all().map((r) => `${r.ActCode} (${r.ShortName})`);

  const grounded = `
GROUNDED VALUES (use these exact spellings):
- Districts: ${districts.join(', ')}
- Crime heads: ${heads.join('; ')}
- Crime sub-heads: ${subheads.join(', ')}
- Case statuses: ${statuses.join(', ')}
- Acts: ${acts.join(', ')}
`;

  cached = STATIC + grounded;
  return cached;
}

module.exports = { buildSchemaContext };
