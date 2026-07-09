// ============================================================
// KSP CRIME INTELLIGENCE — Police FIR Relational Schema
// ------------------------------------------------------------
// Faithfully modeled on the Karnataka Police "Police FIR System"
// ER diagram (CaseMaster + related tables and lookup masters).
//
// Analytics EXTENSIONS (not in the source ER, added to enable the
// datathon's criminal-network / financial-link / offender-profiling
// features) are grouped separately and clearly marked. The most
// important is PersonMaster: the source ER stores Accused/Victim/
// Complainant as per-FIR rows with no cross-FIR identity, but
// repeat-offender detection and network analysis REQUIRE a canonical
// real-world person. PersonMaster provides that identity and is
// referenced from the per-FIR party rows.
//
// SQLite type mapping: INT -> INTEGER, VARCHAR/NVARCHAR -> TEXT,
// DECIMAL -> REAL, DATE/DATETIME -> TEXT (ISO-8601), BIT -> INTEGER.
// ============================================================

const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

-- ============================================================
-- GEOGRAPHY MASTERS
-- ============================================================
CREATE TABLE IF NOT EXISTS State (
  StateID        INTEGER PRIMARY KEY,
  StateName      TEXT NOT NULL,
  NationalityID  INTEGER,
  Active         INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS District (
  DistrictID     INTEGER PRIMARY KEY,
  DistrictName   TEXT NOT NULL,
  StateID        INTEGER,
  Active         INTEGER DEFAULT 1,
  FOREIGN KEY (StateID) REFERENCES State(StateID)
);

-- ============================================================
-- ORGANISATION / UNIT MASTERS
-- ============================================================
CREATE TABLE IF NOT EXISTS UnitType (
  UnitTypeID     INTEGER PRIMARY KEY,
  UnitTypeName   TEXT NOT NULL,        -- Police Station, Circle Office, ...
  CityDistState  TEXT,                 -- City / District / State
  Hierarchy      INTEGER,              -- lower = higher authority
  Active         INTEGER DEFAULT 1
);

-- Unit = police station (or higher org unit). Self-referencing via ParentUnit.
CREATE TABLE IF NOT EXISTS Unit (
  UnitID         INTEGER PRIMARY KEY,
  UnitName       TEXT NOT NULL,
  TypeID         INTEGER,
  ParentUnit     INTEGER,
  NationalityID  INTEGER,
  StateID        INTEGER,
  DistrictID     INTEGER,
  -- extension: PS location for mapping / hotspot analytics
  latitude       REAL,
  longitude      REAL,
  Active         INTEGER DEFAULT 1,
  FOREIGN KEY (TypeID)     REFERENCES UnitType(UnitTypeID),
  FOREIGN KEY (StateID)    REFERENCES State(StateID),
  FOREIGN KEY (DistrictID) REFERENCES District(DistrictID)
);

CREATE TABLE IF NOT EXISTS Rank (
  RankID         INTEGER PRIMARY KEY,
  RankName       TEXT NOT NULL,        -- Constable, Inspector, DSP, ...
  Hierarchy      INTEGER,
  Active         INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS Designation (
  DesignationID  INTEGER PRIMARY KEY,
  DesignationName TEXT NOT NULL,       -- Investigating Officer, SHO, ...
  SortOrder      INTEGER,
  Active         INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS Employee (
  EmployeeID     INTEGER PRIMARY KEY,
  DistrictID     INTEGER,
  UnitID         INTEGER,
  RankID         INTEGER,
  DesignationID  INTEGER,
  KGID           TEXT,                 -- Karnataka Government ID
  FirstName      TEXT,
  EmployeeDOB    TEXT,
  GenderID       INTEGER,
  BloodGroupID   INTEGER,
  PhysicallyChallenged INTEGER DEFAULT 0,
  AppointmentDate TEXT,
  FOREIGN KEY (DistrictID)    REFERENCES District(DistrictID),
  FOREIGN KEY (UnitID)        REFERENCES Unit(UnitID),
  FOREIGN KEY (RankID)        REFERENCES Rank(RankID),
  FOREIGN KEY (DesignationID) REFERENCES Designation(DesignationID)
);

CREATE TABLE IF NOT EXISTS Court (
  CourtID        INTEGER PRIMARY KEY,
  CourtName      TEXT NOT NULL,
  DistrictID     INTEGER,
  StateID        INTEGER,
  Active         INTEGER DEFAULT 1,
  FOREIGN KEY (DistrictID) REFERENCES District(DistrictID),
  FOREIGN KEY (StateID)    REFERENCES State(StateID)
);

-- ============================================================
-- CRIME CLASSIFICATION MASTERS
-- ============================================================
CREATE TABLE IF NOT EXISTS CaseCategory (
  CaseCategoryID INTEGER PRIMARY KEY,
  LookupValue    TEXT NOT NULL,        -- FIR, UDR, PAR, Zero FIR
  CategoryCode   INTEGER               -- 1 digit code used in CrimeNo
);

CREATE TABLE IF NOT EXISTS GravityOffence (
  GravityOffenceID INTEGER PRIMARY KEY,
  LookupValue      TEXT NOT NULL       -- Heinous, Non-Heinous
);

CREATE TABLE IF NOT EXISTS CrimeHead (
  CrimeHeadID    INTEGER PRIMARY KEY,
  CrimeGroupName TEXT NOT NULL,        -- e.g. Crimes Against Body
  Active         INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS CrimeSubHead (
  CrimeSubHeadID INTEGER PRIMARY KEY,
  CrimeHeadID    INTEGER,
  CrimeHeadName  TEXT NOT NULL,        -- e.g. Murder, Robbery
  SeqID          INTEGER,
  FOREIGN KEY (CrimeHeadID) REFERENCES CrimeHead(CrimeHeadID)
);

CREATE TABLE IF NOT EXISTS Act (
  ActCode        TEXT PRIMARY KEY,     -- e.g. IPC, BNS, NDPS, IT
  ActDescription TEXT,
  ShortName      TEXT,
  Active         INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS Section (
  SectionID      INTEGER PRIMARY KEY,  -- surrogate key (ER keys on ActCode+SectionCode)
  ActCode        TEXT,
  SectionCode    TEXT NOT NULL,        -- e.g. 302, 379, 420
  SectionDescription TEXT,
  Active         INTEGER DEFAULT 1,
  FOREIGN KEY (ActCode) REFERENCES Act(ActCode)
);

CREATE TABLE IF NOT EXISTS CrimeHeadActSection (
  CrimeHeadID    INTEGER,
  ActCode        TEXT,
  SectionCode    TEXT,
  FOREIGN KEY (CrimeHeadID) REFERENCES CrimeHead(CrimeHeadID),
  FOREIGN KEY (ActCode)     REFERENCES Act(ActCode)
);

CREATE TABLE IF NOT EXISTS CaseStatusMaster (
  CaseStatusID   INTEGER PRIMARY KEY,
  CaseStatusName TEXT NOT NULL         -- Under Investigation, Charge Sheeted, Closed
);

-- ============================================================
-- SOCIO-DEMOGRAPHIC MASTERS (used by ComplainantDetails + extensions)
-- ============================================================
CREATE TABLE IF NOT EXISTS CasteMaster (
  caste_master_id   INTEGER PRIMARY KEY,
  caste_master_name TEXT NOT NULL      -- category label (General/OBC/SC/ST)
);

CREATE TABLE IF NOT EXISTS ReligionMaster (
  ReligionID     INTEGER PRIMARY KEY,
  ReligionName   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS OccupationMaster (
  OccupationID   INTEGER PRIMARY KEY,
  OccupationName TEXT NOT NULL
);

-- ============================================================
-- CORE: CASE (FIR) + PARTIES
-- ============================================================
CREATE TABLE IF NOT EXISTS CaseMaster (
  CaseMasterID       INTEGER PRIMARY KEY,
  CrimeNo            TEXT,             -- CaseCat(1)+District(4)+Unit(4)+Year(4)+Serial(5)
  CaseNo             TEXT,             -- YYYY + 5-digit serial (last 9 of CrimeNo)
  CrimeRegisteredDate TEXT,
  PolicePersonID     INTEGER,         -- FK Employee (officer who registered)
  PoliceStationID    INTEGER,         -- FK Unit
  CaseCategoryID     INTEGER,
  GravityOffenceID   INTEGER,
  CrimeMajorHeadID   INTEGER,         -- FK CrimeHead
  CrimeMinorHeadID   INTEGER,         -- FK CrimeSubHead
  CaseStatusID       INTEGER,
  CourtID            INTEGER,
  IncidentFromDate   TEXT,
  IncidentToDate     TEXT,
  InfoReceivedPSDate TEXT,
  latitude           REAL,
  longitude          REAL,
  BriefFacts         TEXT,
  FOREIGN KEY (PolicePersonID)   REFERENCES Employee(EmployeeID),
  FOREIGN KEY (PoliceStationID)  REFERENCES Unit(UnitID),
  FOREIGN KEY (CaseCategoryID)   REFERENCES CaseCategory(CaseCategoryID),
  FOREIGN KEY (GravityOffenceID) REFERENCES GravityOffence(GravityOffenceID),
  FOREIGN KEY (CrimeMajorHeadID) REFERENCES CrimeHead(CrimeHeadID),
  FOREIGN KEY (CrimeMinorHeadID) REFERENCES CrimeSubHead(CrimeSubHeadID),
  FOREIGN KEY (CaseStatusID)     REFERENCES CaseStatusMaster(CaseStatusID),
  FOREIGN KEY (CourtID)          REFERENCES Court(CourtID)
);

CREATE TABLE IF NOT EXISTS ComplainantDetails (
  ComplainantID  INTEGER PRIMARY KEY,
  CaseMasterID   INTEGER,
  ComplainantName TEXT,
  AgeYear        INTEGER,
  OccupationID   INTEGER,
  ReligionID     INTEGER,
  CasteID        INTEGER,
  GenderID       INTEGER,             -- 1=M, 2=F, 3=T
  PersonMasterID INTEGER,             -- extension: canonical identity
  FOREIGN KEY (CaseMasterID) REFERENCES CaseMaster(CaseMasterID),
  FOREIGN KEY (OccupationID) REFERENCES OccupationMaster(OccupationID),
  FOREIGN KEY (ReligionID)   REFERENCES ReligionMaster(ReligionID),
  FOREIGN KEY (CasteID)      REFERENCES CasteMaster(caste_master_id)
);

CREATE TABLE IF NOT EXISTS Victim (
  VictimMasterID INTEGER PRIMARY KEY,
  CaseMasterID   INTEGER,
  VictimName     TEXT,
  AgeYear        INTEGER,
  GenderID       INTEGER,             -- 1=M, 2=F, 3=T
  VictimPolice   INTEGER DEFAULT 0,   -- 1 if victim is police, else 0
  PersonMasterID INTEGER,             -- extension: canonical identity
  FOREIGN KEY (CaseMasterID) REFERENCES CaseMaster(CaseMasterID)
);

CREATE TABLE IF NOT EXISTS Accused (
  AccusedMasterID INTEGER PRIMARY KEY,
  CaseMasterID    INTEGER,
  AccusedName     TEXT,
  AgeYear         INTEGER,
  GenderID        INTEGER,            -- 1=M, 2=F, 3=T
  PersonID        TEXT,               -- ordinal within case: A1, A2, A3
  PersonMasterID  INTEGER,            -- extension: canonical identity (repeat-offender link)
  FOREIGN KEY (CaseMasterID) REFERENCES CaseMaster(CaseMasterID)
);

CREATE TABLE IF NOT EXISTS ArrestSurrender (
  ArrestSurrenderID       INTEGER PRIMARY KEY,
  CaseMasterID            INTEGER,
  ArrestSurrenderTypeID   INTEGER,     -- 1=Arrest, 2=Surrender
  ArrestSurrenderDate     TEXT,
  ArrestSurrenderStateId  INTEGER,
  ArrestSurrenderDistrictId INTEGER,
  PoliceStationID         INTEGER,
  IOID                    INTEGER,     -- Investigating Officer (Employee)
  CourtID                 INTEGER,
  AccusedMasterID         INTEGER,
  IsAccused               INTEGER DEFAULT 1,
  IsComplainantAccused    INTEGER DEFAULT 0,
  FOREIGN KEY (CaseMasterID)     REFERENCES CaseMaster(CaseMasterID),
  FOREIGN KEY (AccusedMasterID)  REFERENCES Accused(AccusedMasterID),
  FOREIGN KEY (IOID)             REFERENCES Employee(EmployeeID),
  FOREIGN KEY (CourtID)          REFERENCES Court(CourtID)
);

CREATE TABLE IF NOT EXISTS ActSectionAssociation (
  ActSectionAssociationID INTEGER PRIMARY KEY,  -- surrogate for convenience
  CaseMasterID   INTEGER,
  ActID          TEXT,                -- FK Act.ActCode
  SectionID      INTEGER,             -- FK Section.SectionID
  ActOrderID     INTEGER,
  SectionOrderID INTEGER,
  FOREIGN KEY (CaseMasterID) REFERENCES CaseMaster(CaseMasterID),
  FOREIGN KEY (ActID)        REFERENCES Act(ActCode),
  FOREIGN KEY (SectionID)    REFERENCES Section(SectionID)
);

CREATE TABLE IF NOT EXISTS ChargesheetDetails (
  CSID           INTEGER PRIMARY KEY,
  CaseMasterID   INTEGER,
  csdate         TEXT,
  cstype         TEXT,                -- A=Chargesheet, B=False Case, C=Undetected
  PolicePersonID INTEGER,
  FOREIGN KEY (CaseMasterID)   REFERENCES CaseMaster(CaseMasterID),
  FOREIGN KEY (PolicePersonID) REFERENCES Employee(EmployeeID)
);

-- ============================================================
-- ANALYTICS EXTENSIONS (not in source ER)
-- Enable criminal-network, financial-link and offender-profiling.
-- ============================================================

-- Canonical real-world person. Accused/Victim/Complainant per-FIR
-- rows reference this to link the same individual across many FIRs.
CREATE TABLE IF NOT EXISTS PersonMaster (
  PersonMasterID INTEGER PRIMARY KEY,
  FullName       TEXT NOT NULL,
  Gender         TEXT,                -- M/F/T
  AgeYear        INTEGER,
  DOB            TEXT,
  CasteID        INTEGER,
  ReligionID     INTEGER,
  OccupationID   INTEGER,
  Address        TEXT,
  DistrictID     INTEGER,
  latitude       REAL,                -- approx residence (network/geo)
  longitude      REAL,
  IsHabitualOffender INTEGER DEFAULT 0,
  RiskScore      REAL DEFAULT 0,      -- 0-100 recidivism/escalation score
  FOREIGN KEY (CasteID)      REFERENCES CasteMaster(caste_master_id),
  FOREIGN KEY (ReligionID)   REFERENCES ReligionMaster(ReligionID),
  FOREIGN KEY (OccupationID) REFERENCES OccupationMaster(OccupationID),
  FOREIGN KEY (DistrictID)   REFERENCES District(DistrictID)
);

CREATE TABLE IF NOT EXISTS PhoneNumber (
  PhoneID        INTEGER PRIMARY KEY,
  PersonMasterID INTEGER,
  Number         TEXT NOT NULL,
  Imei           TEXT,
  FOREIGN KEY (PersonMasterID) REFERENCES PersonMaster(PersonMasterID)
);

CREATE TABLE IF NOT EXISTS BankAccount (
  AccountID      INTEGER PRIMARY KEY,
  PersonMasterID INTEGER,
  BankName       TEXT,
  AccountNo      TEXT,
  IFSC           TEXT,
  IsFlagged      INTEGER DEFAULT 0,   -- suspected mule / laundering hub
  FOREIGN KEY (PersonMasterID) REFERENCES PersonMaster(PersonMasterID)
);

CREATE TABLE IF NOT EXISTS FinancialTransaction (
  TxnID          INTEGER PRIMARY KEY,
  FromAccountID  INTEGER,
  ToAccountID    INTEGER,
  Amount         REAL,
  TxnDate        TEXT,
  Channel        TEXT,                -- UPI, NEFT, IMPS, CASH
  CaseMasterID   INTEGER,             -- linked case, if any
  IsSuspicious   INTEGER DEFAULT 0,
  FOREIGN KEY (FromAccountID) REFERENCES BankAccount(AccountID),
  FOREIGN KEY (ToAccountID)   REFERENCES BankAccount(AccountID),
  FOREIGN KEY (CaseMasterID)  REFERENCES CaseMaster(CaseMasterID)
);

-- ============================================================
-- INDEXES (query performance for chatbot + analytics)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_case_ps        ON CaseMaster(PoliceStationID);
CREATE INDEX IF NOT EXISTS idx_case_regdate   ON CaseMaster(CrimeRegisteredDate);
CREATE INDEX IF NOT EXISTS idx_case_majorhead ON CaseMaster(CrimeMajorHeadID);
CREATE INDEX IF NOT EXISTS idx_case_minorhead ON CaseMaster(CrimeMinorHeadID);
CREATE INDEX IF NOT EXISTS idx_case_status    ON CaseMaster(CaseStatusID);
CREATE INDEX IF NOT EXISTS idx_case_category  ON CaseMaster(CaseCategoryID);
CREATE INDEX IF NOT EXISTS idx_case_crimeno   ON CaseMaster(CrimeNo);
CREATE INDEX IF NOT EXISTS idx_accused_case   ON Accused(CaseMasterID);
CREATE INDEX IF NOT EXISTS idx_accused_person ON Accused(PersonMasterID);
CREATE INDEX IF NOT EXISTS idx_victim_case    ON Victim(CaseMasterID);
CREATE INDEX IF NOT EXISTS idx_complainant_case ON ComplainantDetails(CaseMasterID);
CREATE INDEX IF NOT EXISTS idx_asa_case       ON ActSectionAssociation(CaseMasterID);
CREATE INDEX IF NOT EXISTS idx_arrest_case    ON ArrestSurrender(CaseMasterID);
CREATE INDEX IF NOT EXISTS idx_arrest_accused ON ArrestSurrender(AccusedMasterID);
CREATE INDEX IF NOT EXISTS idx_cs_case        ON ChargesheetDetails(CaseMasterID);
CREATE INDEX IF NOT EXISTS idx_unit_district  ON Unit(DistrictID);
CREATE INDEX IF NOT EXISTS idx_txn_from       ON FinancialTransaction(FromAccountID);
CREATE INDEX IF NOT EXISTS idx_txn_to         ON FinancialTransaction(ToAccountID);
CREATE INDEX IF NOT EXISTS idx_phone_person   ON PhoneNumber(PersonMasterID);
CREATE INDEX IF NOT EXISTS idx_account_person ON BankAccount(PersonMasterID);
`;

// Ordered list of every table the read-only query engine is allowed to touch.
const ALLOWED_TABLES = [
  'State', 'District', 'UnitType', 'Unit', 'Rank', 'Designation', 'Employee', 'Court',
  'CaseCategory', 'GravityOffence', 'CrimeHead', 'CrimeSubHead', 'Act', 'Section',
  'CrimeHeadActSection', 'CaseStatusMaster', 'CasteMaster', 'ReligionMaster', 'OccupationMaster',
  'CaseMaster', 'ComplainantDetails', 'Victim', 'Accused', 'ArrestSurrender',
  'ActSectionAssociation', 'ChargesheetDetails',
  'PersonMaster', 'PhoneNumber', 'BankAccount', 'FinancialTransaction',
];

function initFirSchema(db) {
  db.exec(SCHEMA_SQL);
}

module.exports = { SCHEMA_SQL, ALLOWED_TABLES, initFirSchema };
