// ============================================================
// KSP CRIME INTELLIGENCE — Karnataka Reference Data
// ------------------------------------------------------------
// Real Karnataka geography (districts + police stations), the
// IPC/BNS/NDPS/IT act-section taxonomy grouped under crime heads,
// and the socio-demographic master tables. All master rows are
// inserted by insertReferenceData(); the generator consumes the
// exported structures to build coherent synthetic FIRs.
// ============================================================

// ---------- STATE ----------
const STATE = { StateID: 29, StateName: 'Karnataka', NationalityID: 1 };

// ---------- DISTRICTS (4-digit IDs; approx. HQ coordinates) ----------
const DISTRICTS = [
  { DistrictID: 1001, DistrictName: 'Bengaluru City',      lat: 12.9716, lng: 77.5946 },
  { DistrictID: 1002, DistrictName: 'Bengaluru Rural',     lat: 13.2846, lng: 77.6900 },
  { DistrictID: 1003, DistrictName: 'Mysuru',              lat: 12.2958, lng: 76.6394 },
  { DistrictID: 1004, DistrictName: 'Dakshina Kannada',    lat: 12.9141, lng: 74.8560 },
  { DistrictID: 1005, DistrictName: 'Belagavi',            lat: 15.8497, lng: 74.4977 },
  { DistrictID: 1006, DistrictName: 'Kalaburagi',          lat: 17.3297, lng: 76.8343 },
  { DistrictID: 1007, DistrictName: 'Dharwad',             lat: 15.4589, lng: 75.0078 },
  { DistrictID: 1008, DistrictName: 'Ballari',             lat: 15.1394, lng: 76.9214 },
  { DistrictID: 1009, DistrictName: 'Vijayapura',          lat: 16.8302, lng: 75.7100 },
  { DistrictID: 1010, DistrictName: 'Davanagere',          lat: 14.4644, lng: 75.9218 },
  { DistrictID: 1011, DistrictName: 'Shivamogga',          lat: 13.9299, lng: 75.5681 },
  { DistrictID: 1012, DistrictName: 'Tumakuru',            lat: 13.3379, lng: 77.1173 },
  { DistrictID: 1013, DistrictName: 'Udupi',               lat: 13.3409, lng: 74.7421 },
  { DistrictID: 1014, DistrictName: 'Hassan',              lat: 13.0072, lng: 76.0962 },
  { DistrictID: 1015, DistrictName: 'Raichur',             lat: 16.2076, lng: 77.3463 },
  { DistrictID: 1016, DistrictName: 'Mandya',              lat: 12.5223, lng: 76.8954 },
];

// ---------- POLICE STATIONS (Units) per district ----------
// [name, latOffset, lngOffset] — offset from district HQ (~city spread).
const STATIONS_BY_DISTRICT = {
  1001: [ // Bengaluru City
    ['Banashankari PS', -0.03, -0.02], ['Jayanagar PS', -0.02, 0.01], ['Koramangala PS', -0.01, 0.03],
    ['Whitefield PS', 0.02, 0.14], ['Indiranagar PS', 0.01, 0.05], ['Malleshwaram PS', 0.03, -0.01],
    ['KR Puram PS', 0.02, 0.10], ['Electronic City PS', -0.10, 0.06], ['Yelahanka PS', 0.12, 0.00],
    ['Vijayanagar PS', 0.00, -0.05], ['Ulsoor PS', 0.01, 0.03], ['Hebbal PS', 0.07, 0.01],
  ],
  1002: [ ['Devanahalli PS', 0.05, 0.02], ['Doddaballapura PS', 0.10, -0.05], ['Nelamangala PS', -0.02, -0.12], ['Hoskote PS', -0.05, 0.15] ],
  1003: [ ['Devaraja PS', 0.00, 0.01], ['Lashkar PS', 0.01, -0.01], ['Vijayanagar PS Mysuru', -0.02, -0.02], ['Nazarbad PS', -0.01, 0.02], ['Krishnaraja PS', 0.02, 0.00] ],
  1004: [ ['Mangaluru North PS', 0.02, 0.01], ['Mangaluru South PS', -0.02, 0.00], ['Kadri PS', 0.01, 0.02], ['Panambur PS', 0.06, -0.02], ['Bunder PS', -0.01, -0.03] ],
  1005: [ ['Belagavi City PS', 0.00, 0.01], ['Camp PS', 0.02, 0.02], ['Market PS', -0.01, 0.00], ['Tilakwadi PS', 0.01, -0.02] ],
  1006: [ ['Kalaburagi City PS', 0.00, 0.01], ['Station Bazar PS', 0.01, -0.01], ['Brahmpur PS', -0.01, 0.02], ['Farhatabad PS', 0.05, 0.03] ],
  1007: [ ['Hubballi City PS', -0.05, -0.10], ['Dharwad Town PS', 0.01, 0.01], ['Vidyanagar PS', -0.03, -0.06], ['Keshwapur PS', -0.04, -0.09] ],
  1008: [ ['Ballari City PS', 0.00, 0.01], ['Cowl Bazar PS', 0.01, 0.00], ['Gandhi Nagar PS Ballari', -0.01, 0.02] ],
  1009: [ ['Vijayapura City PS', 0.00, 0.01], ['Gandhi Chowk PS', 0.01, -0.01], ['Adarsh Nagar PS', -0.02, 0.02] ],
  1010: [ ['Davanagere City PS', 0.00, 0.01], ['Vidyanagar PS Davanagere', 0.02, 0.02], ['Azad Nagar PS', -0.01, -0.01] ],
  1011: [ ['Shivamogga Town PS', 0.00, 0.01], ['Doddapet PS', 0.01, 0.00], ['Vinoba Nagar PS', -0.02, 0.02] ],
  1012: [ ['Tumakuru Town PS', 0.00, 0.01], ['Batawadi PS', 0.02, -0.01], ['Kyathsandra PS', -0.03, 0.04] ],
  1013: [ ['Udupi Town PS', 0.00, 0.01], ['Malpe PS', 0.01, -0.04], ['Manipal PS', 0.02, 0.03] ],
  1014: [ ['Hassan Town PS', 0.00, 0.01], ['Pension Mohalla PS', 0.01, 0.00], ['Sathyamangala PS', -0.02, 0.03] ],
  1015: [ ['Raichur City PS', 0.00, 0.01], ['Sadar Bazar PS', 0.01, -0.01], ['Netaji Nagar PS', -0.01, 0.02] ],
  1016: [ ['Mandya Town PS', 0.00, 0.01], ['V V Nagar PS', 0.02, 0.01], ['Holalu PS', -0.03, 0.02] ],
};

// Flatten stations to Units with sequential 4-digit UnitIDs (<= 9999).
const POLICE_STATIONS = [];
{
  let unitId = 2001;
  for (const d of DISTRICTS) {
    const list = STATIONS_BY_DISTRICT[d.DistrictID] || [];
    for (const [name, dLat, dLng] of list) {
      POLICE_STATIONS.push({
        UnitID: unitId++,
        UnitName: name,
        DistrictID: d.DistrictID,
        StateID: STATE.StateID,
        latitude: +(d.lat + dLat).toFixed(5),
        longitude: +(d.lng + dLng).toFixed(5),
      });
    }
  }
}

// ---------- CRIME TAXONOMY (heads -> sub-heads -> act/sections) ----------
// gravity: 'Heinous' | 'Non-Heinous'. moTemplates seed BriefFacts + MO clustering.
const CRIME_TAXONOMY = [
  { head: 'Crimes Against Body', subheads: [
    { name: 'Murder',             gravity: 'Heinous',     acts: [['IPC', '302', 'Punishment for murder'], ['BNS', '103', 'Punishment for murder']] },
    { name: 'Attempt to Murder',  gravity: 'Heinous',     acts: [['IPC', '307', 'Attempt to murder']] },
    { name: 'Culpable Homicide',  gravity: 'Heinous',     acts: [['IPC', '304', 'Culpable homicide not amounting to murder']] },
    { name: 'Grievous Hurt',      gravity: 'Non-Heinous', acts: [['IPC', '326', 'Voluntarily causing grievous hurt by dangerous weapons']] },
    { name: 'Hurt / Assault',     gravity: 'Non-Heinous', acts: [['IPC', '323', 'Punishment for voluntarily causing hurt'], ['IPC', '324', 'Hurt by dangerous weapons']] },
    { name: 'Kidnapping',         gravity: 'Heinous',     acts: [['IPC', '363', 'Punishment for kidnapping'], ['IPC', '365', 'Kidnapping to secretly confine']] },
  ]},
  { head: 'Crimes Against Property', subheads: [
    { name: 'Theft',                 gravity: 'Non-Heinous', acts: [['IPC', '379', 'Punishment for theft']] },
    { name: 'House Burglary',        gravity: 'Non-Heinous', acts: [['IPC', '457', 'Lurking house-trespass by night'], ['IPC', '380', 'Theft in dwelling house']] },
    { name: 'Robbery',               gravity: 'Heinous',     acts: [['IPC', '392', 'Punishment for robbery']] },
    { name: 'Dacoity',               gravity: 'Heinous',     acts: [['IPC', '395', 'Punishment for dacoity']] },
    { name: 'Motor Vehicle Theft',   gravity: 'Non-Heinous', acts: [['IPC', '379', 'Punishment for theft']] },
    { name: 'Extortion',             gravity: 'Non-Heinous', acts: [['IPC', '384', 'Punishment for extortion']] },
  ]},
  { head: 'Crimes Against Women', subheads: [
    { name: 'Dowry Death',                  gravity: 'Heinous',     acts: [['IPC', '304B', 'Dowry death'], ['DP', '3', 'Penalty for giving/taking dowry']] },
    { name: 'Cruelty by Husband/Relatives', gravity: 'Non-Heinous', acts: [['IPC', '498A', 'Husband or relative subjecting woman to cruelty']] },
    { name: 'Rape',                         gravity: 'Heinous',     acts: [['IPC', '376', 'Punishment for rape']] },
    { name: 'Outraging Modesty',            gravity: 'Non-Heinous', acts: [['IPC', '354', 'Assault to outrage modesty of woman']] },
    { name: 'Sexual Harassment',            gravity: 'Non-Heinous', acts: [['IPC', '354A', 'Sexual harassment']] },
  ]},
  { head: 'Economic Offences', subheads: [
    { name: 'Cheating',                gravity: 'Non-Heinous', acts: [['IPC', '420', 'Cheating and dishonestly inducing delivery of property']] },
    { name: 'Criminal Breach of Trust', gravity: 'Non-Heinous', acts: [['IPC', '406', 'Punishment for criminal breach of trust'], ['IPC', '409', 'Breach of trust by public servant']] },
    { name: 'Forgery',                 gravity: 'Non-Heinous', acts: [['IPC', '468', 'Forgery for cheating'], ['IPC', '465', 'Punishment for forgery']] },
  ]},
  { head: 'Cyber Crimes', subheads: [
    { name: 'Online Financial Fraud', gravity: 'Non-Heinous', acts: [['IT', '66D', 'Cheating by personation using computer resource'], ['IPC', '420', 'Cheating']] },
    { name: 'Identity Theft',         gravity: 'Non-Heinous', acts: [['IT', '66C', 'Identity theft']] },
    { name: 'Hacking / Data Theft',   gravity: 'Non-Heinous', acts: [['IT', '66', 'Computer related offences'], ['IT', '43', 'Damage to computer/system']] },
    { name: 'Cyber Stalking',         gravity: 'Non-Heinous', acts: [['IPC', '354D', 'Stalking'], ['IT', '67', 'Publishing obscene material']] },
  ]},
  { head: 'Public Order & Violence', subheads: [
    { name: 'Rioting',              gravity: 'Non-Heinous', acts: [['IPC', '147', 'Punishment for rioting'], ['IPC', '148', 'Rioting armed with deadly weapon']] },
    { name: 'Criminal Intimidation', gravity: 'Non-Heinous', acts: [['IPC', '506', 'Punishment for criminal intimidation']] },
    { name: 'Unlawful Assembly',    gravity: 'Non-Heinous', acts: [['IPC', '143', 'Punishment for unlawful assembly']] },
  ]},
  { head: 'Narcotic Drugs (NDPS)', subheads: [
    { name: 'Drug Possession',   gravity: 'Non-Heinous', acts: [['NDPS', '20', 'Contravention re cannabis'], ['NDPS', '22', 'Contravention re psychotropic substances']] },
    { name: 'Drug Trafficking',  gravity: 'Heinous',     acts: [['NDPS', '21', 'Contravention re manufactured drugs'], ['NDPS', '29', 'Abetment and criminal conspiracy']] },
  ]},
  { head: 'Arms Offences', subheads: [
    { name: 'Illegal Arms Possession', gravity: 'Non-Heinous', acts: [['ARMS', '25', 'Punishment for illegal possession'], ['ARMS', '27', 'Punishment for using arms']] },
  ]},
  { head: 'Road Accidents', subheads: [
    { name: 'Fatal Road Accident',    gravity: 'Non-Heinous', acts: [['IPC', '304A', 'Causing death by negligence'], ['IPC', '279', 'Rash driving on public way']] },
    { name: 'Non-Fatal Road Accident', gravity: 'Non-Heinous', acts: [['IPC', '279', 'Rash driving on public way'], ['MV', '184', 'Driving dangerously']] },
  ]},
  { head: 'Missing Persons', subheads: [
    { name: 'Person Missing', gravity: 'Non-Heinous', acts: [] },
  ]},
];

// ---------- ACTS ----------
const ACT_DESCRIPTIONS = {
  IPC:  ['Indian Penal Code, 1860', 'IPC'],
  BNS:  ['Bharatiya Nyaya Sanhita, 2023', 'BNS'],
  NDPS: ['Narcotic Drugs and Psychotropic Substances Act, 1985', 'NDPS'],
  IT:   ['Information Technology Act, 2000', 'IT Act'],
  DP:   ['Dowry Prohibition Act, 1961', 'DP Act'],
  ARMS: ['Arms Act, 1959', 'Arms Act'],
  MV:   ['Motor Vehicles Act, 1988', 'MV Act'],
  POCSO:['Protection of Children from Sexual Offences Act, 2012', 'POCSO'],
  KP:   ['Karnataka Police Act, 1963', 'KP Act'],
};

// Derive Act + Section master tables (deduped) from the taxonomy.
function buildActsAndSections() {
  const acts = new Set();
  const sectionMap = new Map(); // key `${act}|${code}` -> { SectionID, ActCode, SectionCode, SectionDescription }
  let sectionId = 1;
  for (const h of CRIME_TAXONOMY) {
    for (const sh of h.subheads) {
      for (const [act, code, desc] of sh.acts) {
        acts.add(act);
        const key = `${act}|${code}`;
        if (!sectionMap.has(key)) {
          sectionMap.set(key, { SectionID: sectionId++, ActCode: act, SectionCode: code, SectionDescription: desc });
        }
      }
    }
  }
  const actRows = [...acts].map(a => ({
    ActCode: a,
    ActDescription: (ACT_DESCRIPTIONS[a] || [a, a])[0],
    ShortName: (ACT_DESCRIPTIONS[a] || [a, a])[1],
  }));
  return { actRows, sectionRows: [...sectionMap.values()], sectionMap };
}

// ---------- MASTERS ----------
const CASE_CATEGORIES = [
  { CaseCategoryID: 1, LookupValue: 'FIR',      CategoryCode: 1 },
  { CaseCategoryID: 2, LookupValue: 'UDR',      CategoryCode: 3 },
  { CaseCategoryID: 3, LookupValue: 'PAR',      CategoryCode: 4 },
  { CaseCategoryID: 4, LookupValue: 'Zero FIR', CategoryCode: 8 },
];

const GRAVITY = [
  { GravityOffenceID: 1, LookupValue: 'Heinous' },
  { GravityOffenceID: 2, LookupValue: 'Non-Heinous' },
];

const CASE_STATUSES = [
  { CaseStatusID: 1, CaseStatusName: 'Under Investigation' },
  { CaseStatusID: 2, CaseStatusName: 'Charge Sheeted' },
  { CaseStatusID: 3, CaseStatusName: 'Convicted' },
  { CaseStatusID: 4, CaseStatusName: 'Acquitted' },
  { CaseStatusID: 5, CaseStatusName: 'Closed - Undetected' },
  { CaseStatusID: 6, CaseStatusName: 'Disposed - B Report' },
  { CaseStatusID: 7, CaseStatusName: 'Pending Trial' },
];

const UNIT_TYPES = [
  { UnitTypeID: 1, UnitTypeName: 'Police Station', CityDistState: 'City',     Hierarchy: 4 },
  { UnitTypeID: 2, UnitTypeName: 'Circle Office',  CityDistState: 'City',     Hierarchy: 3 },
  { UnitTypeID: 3, UnitTypeName: 'Sub-Division',   CityDistState: 'District', Hierarchy: 2 },
  { UnitTypeID: 4, UnitTypeName: 'District HQ',    CityDistState: 'District', Hierarchy: 1 },
];

const RANKS = [
  { RankID: 1, RankName: 'Police Constable', Hierarchy: 8 },
  { RankID: 2, RankName: 'Head Constable',   Hierarchy: 7 },
  { RankID: 3, RankName: 'Assistant Sub-Inspector', Hierarchy: 6 },
  { RankID: 4, RankName: 'Sub-Inspector',    Hierarchy: 5 },
  { RankID: 5, RankName: 'Police Inspector', Hierarchy: 4 },
  { RankID: 6, RankName: 'Deputy Superintendent of Police', Hierarchy: 3 },
  { RankID: 7, RankName: 'Superintendent of Police', Hierarchy: 2 },
];

const DESIGNATIONS = [
  { DesignationID: 1, DesignationName: 'Investigating Officer', SortOrder: 1 },
  { DesignationID: 2, DesignationName: 'Station House Officer', SortOrder: 2 },
  { DesignationID: 3, DesignationName: 'Beat Officer',          SortOrder: 3 },
  { DesignationID: 4, DesignationName: 'Circle Inspector',      SortOrder: 4 },
];

const CASTES = [
  { caste_master_id: 1, caste_master_name: 'General' },
  { caste_master_id: 2, caste_master_name: 'OBC' },
  { caste_master_id: 3, caste_master_name: 'SC' },
  { caste_master_id: 4, caste_master_name: 'ST' },
];

const RELIGIONS = [
  { ReligionID: 1, ReligionName: 'Hindu' },
  { ReligionID: 2, ReligionName: 'Muslim' },
  { ReligionID: 3, ReligionName: 'Christian' },
  { ReligionID: 4, ReligionName: 'Jain' },
  { ReligionID: 5, ReligionName: 'Other' },
];

const OCCUPATIONS = [
  { OccupationID: 1,  OccupationName: 'Farmer' },
  { OccupationID: 2,  OccupationName: 'Agricultural Labourer' },
  { OccupationID: 3,  OccupationName: 'Daily Wage Labourer' },
  { OccupationID: 4,  OccupationName: 'Construction Worker' },
  { OccupationID: 5,  OccupationName: 'Driver' },
  { OccupationID: 6,  OccupationName: 'Student' },
  { OccupationID: 7,  OccupationName: 'Unemployed' },
  { OccupationID: 8,  OccupationName: 'Homemaker' },
  { OccupationID: 9,  OccupationName: 'Government Employee' },
  { OccupationID: 10, OccupationName: 'Private Employee' },
  { OccupationID: 11, OccupationName: 'Business / Self-employed' },
  { OccupationID: 12, OccupationName: 'Shopkeeper' },
  { OccupationID: 13, OccupationName: 'Factory Worker' },
  { OccupationID: 14, OccupationName: 'Software Employee' },
  { OccupationID: 15, OccupationName: 'Security Guard' },
  { OccupationID: 16, OccupationName: 'Domestic Worker' },
];

// ---------- NAME POOLS (by religion for coherent demographics) ----------
const NAMES = {
  Hindu: {
    male: ['Ramesh', 'Suresh', 'Manjunath', 'Prakash', 'Ravi', 'Kiran', 'Girish', 'Naveen', 'Santosh', 'Basavaraj', 'Shivakumar', 'Nagaraj', 'Mahesh', 'Ganesh', 'Anand', 'Lokesh', 'Umesh', 'Prashanth', 'Harish', 'Darshan', 'Sandeep', 'Vijay', 'Arun', 'Karthik', 'Praveen'],
    female: ['Lakshmi', 'Savitha', 'Geetha', 'Bhavya', 'Divya', 'Kavya', 'Ananya', 'Deepa', 'Sushma', 'Rekha', 'Roopa', 'Shwetha', 'Pooja', 'Anitha', 'Sowmya', 'Vidya', 'Nandini', 'Chaitra', 'Meghana', 'Ashwini', 'Sneha', 'Sahana'],
    surnames: ['Gowda', 'Shetty', 'Rao', 'Hegde', 'Naik', 'Reddy', 'Patil', 'Kumar', 'Murthy', 'Bhat', 'Acharya', 'Kulkarni', 'Desai', 'Nayak', 'Prabhu', 'Kamath', 'Poojary', 'Rai', 'Hebbar', 'Setty', 'Angadi'],
  },
  Muslim: {
    male: ['Mohammed', 'Abdul', 'Imran', 'Riyaz', 'Nazeer', 'Faisal', 'Sameer', 'Arshad', 'Salman', 'Ibrahim', 'Yusuf', 'Rehan'],
    female: ['Ayesha', 'Fatima', 'Zainab', 'Shabana', 'Nasreen', 'Rukhsar', 'Samira', 'Farah'],
    surnames: ['Khan', 'Sheikh', 'Syed', 'Pasha', 'Ahmed', 'Baig', 'Hussain'],
  },
  Christian: {
    male: ['Anthony', 'Joseph', 'Thomas', 'Rojer', 'Melwin', 'Ivan', 'Aldrin'],
    female: ['Maria', 'Divya', 'Jessica', 'Anitha', 'Reena', 'Sandra'],
    surnames: ["D'Souza", 'Pinto', 'Lobo', 'Fernandes', 'Saldanha', 'Rodrigues'],
  },
  Jain: {
    male: ['Mahaveer', 'Sumit', 'Naresh', 'Pradeep'], female: ['Sonal', 'Nisha', 'Kiran'],
    surnames: ['Jain', 'Shah', 'Chordia', 'Bhandari'],
  },
  Other: {
    male: ['Tenzin', 'David', 'Robert'], female: ['Dolma', 'Grace'],
    surnames: ['Singh', 'Das', 'Roy'],
  },
};

const BANKS = ['State Bank of India', 'Canara Bank', 'Union Bank of India', 'Bank of Baroda', 'Karnataka Bank', 'ICICI Bank', 'HDFC Bank', 'Axis Bank', 'Kotak Mahindra Bank', 'Punjab National Bank'];

// Two courts per district: magistrate + sessions.
function buildCourts() {
  const courts = [];
  let id = 1;
  for (const d of DISTRICTS) {
    courts.push({ CourtID: id++, CourtName: `JMFC Court, ${d.DistrictName}`, DistrictID: d.DistrictID, StateID: STATE.StateID });
    courts.push({ CourtID: id++, CourtName: `District & Sessions Court, ${d.DistrictName}`, DistrictID: d.DistrictID, StateID: STATE.StateID });
  }
  return courts;
}

// ============================================================
// INSERT all reference/master rows and return the assembled refs
// the generator needs (with DB-assigned IDs baked in).
// ============================================================
function insertReferenceData(db) {
  const { actRows, sectionRows, sectionMap } = buildActsAndSections();
  const courts = buildCourts();

  const insert = (table, cols, rows) => {
    if (!rows.length) return;
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(c => '@' + c).join(', ')})`
    );
    const tx = db.transaction((items) => { for (const it of items) stmt.run(it); });
    tx(rows);
  };

  insert('State', ['StateID', 'StateName', 'NationalityID'], [STATE]);
  insert('District', ['DistrictID', 'DistrictName', 'StateID'],
    DISTRICTS.map(d => ({ DistrictID: d.DistrictID, DistrictName: d.DistrictName, StateID: STATE.StateID })));
  insert('UnitType', ['UnitTypeID', 'UnitTypeName', 'CityDistState', 'Hierarchy'], UNIT_TYPES);
  insert('Unit', ['UnitID', 'UnitName', 'TypeID', 'StateID', 'DistrictID', 'latitude', 'longitude'],
    POLICE_STATIONS.map(u => ({ ...u, TypeID: 1 })));
  insert('Rank', ['RankID', 'RankName', 'Hierarchy'], RANKS);
  insert('Designation', ['DesignationID', 'DesignationName', 'SortOrder'], DESIGNATIONS);
  insert('Court', ['CourtID', 'CourtName', 'DistrictID', 'StateID'], courts);
  insert('CaseCategory', ['CaseCategoryID', 'LookupValue', 'CategoryCode'], CASE_CATEGORIES);
  insert('GravityOffence', ['GravityOffenceID', 'LookupValue'], GRAVITY);
  insert('CaseStatusMaster', ['CaseStatusID', 'CaseStatusName'], CASE_STATUSES);
  insert('CasteMaster', ['caste_master_id', 'caste_master_name'], CASTES);
  insert('ReligionMaster', ['ReligionID', 'ReligionName'], RELIGIONS);
  insert('OccupationMaster', ['OccupationID', 'OccupationName'], OCCUPATIONS);
  insert('Act', ['ActCode', 'ActDescription', 'ShortName'], actRows);
  insert('Section', ['SectionID', 'ActCode', 'SectionCode', 'SectionDescription'], sectionRows);

  // CrimeHead + CrimeSubHead derived from taxonomy (assign IDs).
  const crimeHeads = [];
  const crimeSubHeads = [];
  let headId = 1, subId = 1;
  const taxonomy = []; // enriched with IDs for the generator
  for (const h of CRIME_TAXONOMY) {
    const thisHeadId = headId++;
    crimeHeads.push({ CrimeHeadID: thisHeadId, CrimeGroupName: h.head });
    const subs = [];
    let seq = 1;
    for (const sh of h.subheads) {
      const thisSubId = subId++;
      crimeSubHeads.push({ CrimeSubHeadID: thisSubId, CrimeHeadID: thisHeadId, CrimeHeadName: sh.name, SeqID: seq++ });
      subs.push({
        CrimeSubHeadID: thisSubId,
        name: sh.name,
        gravity: sh.gravity,
        gravityId: sh.gravity === 'Heinous' ? 1 : 2,
        sections: sh.acts.map(([act, code]) => sectionMap.get(`${act}|${code}`)),
      });
    }
    taxonomy.push({ CrimeHeadID: thisHeadId, head: h.head, subheads: subs });
  }
  insert('CrimeHead', ['CrimeHeadID', 'CrimeGroupName'], crimeHeads);
  insert('CrimeSubHead', ['CrimeSubHeadID', 'CrimeHeadID', 'CrimeHeadName', 'SeqID'], crimeSubHeads);

  return {
    state: STATE,
    districts: DISTRICTS,
    stations: POLICE_STATIONS,
    courts,
    caseCategories: CASE_CATEGORIES,
    caseStatuses: CASE_STATUSES,
    gravity: GRAVITY,
    ranks: RANKS,
    designations: DESIGNATIONS,
    castes: CASTES,
    religions: RELIGIONS,
    occupations: OCCUPATIONS,
    acts: actRows,
    sections: sectionRows,
    sectionMap,
    taxonomy,        // [{ CrimeHeadID, head, subheads:[{CrimeSubHeadID,name,gravity,gravityId,sections}] }]
    names: NAMES,
    banks: BANKS,
  };
}

module.exports = {
  STATE, DISTRICTS, POLICE_STATIONS, CRIME_TAXONOMY, CASE_CATEGORIES, CASE_STATUSES,
  GRAVITY, RANKS, DESIGNATIONS, CASTES, RELIGIONS, OCCUPATIONS, NAMES, BANKS,
  buildActsAndSections, buildCourts, insertReferenceData,
};
