// ============================================================
// KSP CRIME INTELLIGENCE — Synthetic FIR Generator
// ------------------------------------------------------------
// Produces a coherent, interconnected synthetic dataset on the
// KSP FIR schema: a population (PersonMaster) with realistic
// demographics, co-offending gangs and repeat offenders, victims/
// complainants, officers, FIRs with act-sections, arrests,
// chargesheets, and financial money-trails. Deterministic given a
// seed so FIR numbers stay stable across runs (good for demos).
// ============================================================

const { insertReferenceData } = require('./referenceData');

// ---------- Seedable PRNG (mulberry32) ----------
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeHelpers(rng) {
  const rand = () => rng();
  const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const chance = (p) => rand() < p;
  const weightedPick = (items, weightFn) => {
    const total = items.reduce((s, it) => s + weightFn(it), 0);
    let r = rand() * total;
    for (const it of items) { r -= weightFn(it); if (r <= 0) return it; }
    return items[items.length - 1];
  };
  const jitter = (v, amt) => +(v + (rand() - 0.5) * amt).toFixed(5);
  return { rand, randInt, pick, chance, weightedPick, jitter };
}

// ---------- Distribution weights ----------
const SUBHEAD_WEIGHTS = {
  'Theft': 22, 'House Burglary': 10, 'Motor Vehicle Theft': 12, 'Robbery': 5, 'Dacoity': 1.5, 'Extortion': 3,
  'Hurt / Assault': 12, 'Grievous Hurt': 4, 'Attempt to Murder': 2, 'Murder': 1.2, 'Culpable Homicide': 0.6, 'Kidnapping': 1.5,
  'Cruelty by Husband/Relatives': 8, 'Outraging Modesty': 4, 'Rape': 1.5, 'Sexual Harassment': 3, 'Dowry Death': 0.6,
  'Cheating': 9, 'Criminal Breach of Trust': 3, 'Forgery': 2,
  'Online Financial Fraud': 11, 'Identity Theft': 3, 'Hacking / Data Theft': 2, 'Cyber Stalking': 1.5,
  'Rioting': 3, 'Criminal Intimidation': 4, 'Unlawful Assembly': 2,
  'Drug Possession': 4, 'Drug Trafficking': 1.5, 'Illegal Arms Possession': 1.5,
  'Fatal Road Accident': 5, 'Non-Fatal Road Accident': 8, 'Person Missing': 4,
};

const DISTRICT_WEIGHTS = {
  1001: 30, 1003: 8, 1004: 7, 1005: 7, 1006: 6, 1007: 6, 1008: 5, 1009: 4,
  1010: 4, 1011: 4, 1012: 4, 1013: 4, 1014: 4, 1015: 4, 1016: 4, 1002: 4,
};

// crimes that skew to night-time hours
const NIGHT_CRIMES = new Set(['Theft', 'House Burglary', 'Motor Vehicle Theft', 'Robbery', 'Dacoity', 'Murder', 'Drug Trafficking', 'Drug Possession']);
// crimes typically committed by groups (bias toward gang co-offending)
const GROUP_CRIMES = new Set(['Dacoity', 'Robbery', 'Rioting', 'Unlawful Assembly', 'Drug Trafficking', 'Kidnapping']);
// crimes with a female victim
const FEMALE_VICTIM_CRIMES = new Set(['Cruelty by Husband/Relatives', 'Outraging Modesty', 'Rape', 'Sexual Harassment', 'Dowry Death']);
// crimes that generate financial money-trails
const FINANCIAL_CRIMES = new Set(['Online Financial Fraud', 'Identity Theft', 'Cheating', 'Criminal Breach of Trust', 'Extortion', 'Drug Trafficking']);
// crimes with no named accused at registration (undetected / victimless-registrant)
const OFTEN_UNKNOWN_ACCUSED = new Set(['Theft', 'House Burglary', 'Motor Vehicle Theft', 'Person Missing']);

const CASE_STATUS_WEIGHTS = {
  1: 32, // Under Investigation
  2: 24, // Charge Sheeted
  7: 10, // Pending Trial
  3: 7,  // Convicted
  4: 4,  // Acquitted
  5: 15, // Closed - Undetected
  6: 8,  // Disposed - B Report
};

const BRIEF_FACTS = {
  'Theft': (o) => `Complainant reports theft of ${o.item} near ${o.place}. Unidentified accused fled the scene. MO: opportunistic ${o.night ? 'night-time' : 'daytime'} theft.`,
  'House Burglary': (o) => `House-breaking reported at ${o.place}. Accused gained entry ${o.night ? 'at night' : ''} and decamped with gold ornaments and cash. Neighbour eyewitness; lane CCTV may have footage. MO: ground-floor entry via rear door.`,
  'Motor Vehicle Theft': (o) => `Two-wheeler bearing registration KA-${o.reg} stolen from ${o.place}. Parking CCTV covers approach. MO: master-key theft from parking area.`,
  'Robbery': (o) => `Complainant waylaid near ${o.place} by ${o.n} persons who robbed cash and mobile at knife-point. Eyewitness noted bike number. MO: motorcycle-borne chain/mobile robbery.`,
  'Dacoity': (o) => `Armed gang of ${o.n} committed dacoity at ${o.place}, threatening inmates and looting valuables. MO: masked, armed, late-night.`,
  'Extortion': (o) => `Complainant received threatening calls demanding money at ${o.place}. Amount demanded: Rs.${o.amt}. MO: telephonic extortion.`,
  'Hurt / Assault': (o) => `Quarrel at ${o.place} escalated; accused assaulted complainant causing simple injuries. MO: sudden fight over prior dispute.`,
  'Grievous Hurt': (o) => `Accused assaulted victim with a weapon at ${o.place} causing grievous injuries. Victim hospitalised.`,
  'Attempt to Murder': (o) => `Accused attacked victim with intent to kill at ${o.place}. Victim survived with serious injuries.`,
  'Murder': (o) => `Dead body of victim found at ${o.place} with injuries. Homicide suspected. MO under investigation.`,
  'Culpable Homicide': (o) => `Altercation at ${o.place} resulted in the death of the victim. Case registered.`,
  'Kidnapping': (o) => `Victim reported kidnapped from ${o.place} by ${o.n} persons. Search underway.`,
  'Cruelty by Husband/Relatives': (o) => `Married woman complains of cruelty and harassment for dowry by husband and in-laws at ${o.place}.`,
  'Outraging Modesty': (o) => `Accused outraged the modesty of the complainant at ${o.place}. Case registered.`,
  'Rape': (o) => `Complaint of sexual assault registered at ${o.place}. Victim medically examined. Investigation in progress.`,
  'Sexual Harassment': (o) => `Complainant reports sexual harassment at ${o.place}. Case registered.`,
  'Dowry Death': (o) => `Unnatural death of married woman within 7 years of marriage at ${o.place}. Dowry harassment alleged.`,
  'Cheating': (o) => `Complainant cheated of Rs.${o.amt} by accused on false promise at ${o.place}. MO: advance-fee fraud.`,
  'Criminal Breach of Trust': (o) => `Accused entrusted with funds misappropriated Rs.${o.amt} at ${o.place}.`,
  'Forgery': (o) => `Forged documents used to defraud complainant at ${o.place}. Documents seized.`,
  'Online Financial Fraud': (o) => `Complainant defrauded of Rs.${o.amt} via fake ${o.channel} link/OTP scam. MO: phishing + mule-account layering.`,
  'Identity Theft': (o) => `Complainant's identity/KYC misused to open accounts and avail credit. MO: document-based identity theft.`,
  'Hacking / Data Theft': (o) => `Unauthorised access to complainant's account/system reported at ${o.place}.`,
  'Cyber Stalking': (o) => `Complainant reports persistent online stalking and obscene messaging.`,
  'Rioting': (o) => `Group of ${o.n} indulged in rioting at ${o.place} damaging property. Situation brought under control.`,
  'Criminal Intimidation': (o) => `Accused criminally intimidated complainant with threats at ${o.place}.`,
  'Unlawful Assembly': (o) => `Unlawful assembly of ${o.n} persons at ${o.place} defying prohibitory orders.`,
  'Drug Possession': (o) => `Accused found in possession of contraband (${o.drug}) at ${o.place}. Substance seized for FSL.`,
  'Drug Trafficking': (o) => `Organised trafficking of ${o.drug} intercepted at ${o.place}. ${o.n} accused; consignment seized.`,
  'Illegal Arms Possession': (o) => `Accused found in illegal possession of a country-made firearm at ${o.place}. Weapon seized.`,
  'Fatal Road Accident': (o) => `Rash and negligent driving at ${o.place} caused a fatal accident. Victim died on the spot.`,
  'Non-Fatal Road Accident': (o) => `Rash driving at ${o.place} caused a road accident with injuries. Vehicle seized.`,
  'Person Missing': (o) => `Complainant reports ${o.who} missing from ${o.place}. Man-missing case registered; search initiated.`,
};

const THEFT_ITEMS = ['a mobile phone', 'gold ornaments', 'cash', 'a laptop', 'a wallet and documents', 'a bicycle'];
const DRUGS = ['ganja (cannabis)', 'MDMA', 'brown sugar', 'contraband tablets'];
const CHANNELS = ['UPI', 'net-banking', 'credit-card', 'wallet'];

function isoDate(d) { return d.toISOString().slice(0, 10); }
function isoDateTime(d) { return d.toISOString().slice(0, 19).replace('T', ' '); }

function buildCrimeNo(categoryCode, districtId, unitId, year, serial) {
  return `${categoryCode}${String(districtId).padStart(4, '0')}${String(unitId).padStart(4, '0')}${year}${String(serial).padStart(5, '0')}`;
}

// ============================================================
// MAIN
// ============================================================
function generateAndSeed(db, options = {}) {
  const { firCount = 1200, personCount = 1600, seed = 42, years = 2 } = options;
  const rng = makeRng(seed);
  const H = makeHelpers(rng);
  const { rand, randInt, pick, chance, weightedPick, jitter } = H;

  const refs = insertReferenceData(db);
  const { districts, stations, courts, taxonomy, names, banks } = refs;

  const districtById = Object.fromEntries(districts.map(d => [d.DistrictID, d]));
  const stationsByDistrict = {};
  for (const s of stations) (stationsByDistrict[s.DistrictID] ||= []).push(s);
  const courtsByDistrict = {};
  for (const c of courts) (courtsByDistrict[c.DistrictID] ||= []).push(c);

  // Flat weighted list of sub-heads with head + gravity + sections.
  const subheads = [];
  for (const h of taxonomy) {
    for (const sh of h.subheads) {
      subheads.push({ ...sh, headId: h.CrimeHeadID, headName: h.head, weight: SUBHEAD_WEIGHTS[sh.name] || 2 });
    }
  }

  // ---------- Accumulators ----------
  const persons = [], phones = [], accounts = [], txns = [];
  const employees = [], cases = [], accuseds = [], victims = [], complainants = [];
  const arrests = [], actSecAssoc = [], chargesheets = [];

  // ID counters
  let personId = 1, phoneId = 1, accountId = 1, txnId = 1;
  let employeeId = 1, caseId = 1, accusedId = 1, victimId = 1, complainantId = 1;
  let arrestId = 1, asaId = 1, csId = 1;

  const RELIGION_DIST = [[1, 0.83], [2, 0.13], [3, 0.02], [4, 0.01], [5, 0.01]];
  const CASTE_DIST = [[1, 0.30], [2, 0.42], [3, 0.20], [4, 0.08]];
  const pickDist = (dist) => { let r = rand(); for (const [id, p] of dist) { r -= p; if (r <= 0) return id; } return dist[0][0]; };

  function pickName(religionId, genderId) {
    const relKey = { 1: 'Hindu', 2: 'Muslim', 3: 'Christian', 4: 'Jain', 5: 'Other' }[religionId] || 'Hindu';
    const pool = names[relKey];
    const first = genderId === 2 ? pick(pool.female) : pick(pool.male);
    return `${first} ${pick(pool.surnames)}`;
  }

  function pickOccupation(age, genderId) {
    if (age < 22 && chance(0.5)) return 6;              // Student
    if (genderId === 2 && chance(0.35)) return 8;       // Homemaker
    const common = [1, 2, 3, 4, 5, 7, 9, 10, 11, 12, 13, 14, 15, 16];
    return pick(common);
  }

  function makePhoneNumber() {
    return `${pick([6, 7, 8, 9])}${String(randInt(100000000, 999999999)).padStart(9, '0')}`;
  }

  // ---------- Population ----------
  for (let i = 0; i < personCount; i++) {
    const religionId = pickDist(RELIGION_DIST);
    const genderId = chance(0.52) ? 1 : (chance(0.96) ? 2 : 3);
    const age = randInt(16, 70);
    const casteId = pickDist(CASTE_DIST);
    const occupationId = pickOccupation(age, genderId);
    const district = weightedPick(districts, d => DISTRICT_WEIGHTS[d.DistrictID] || 4);
    const p = {
      PersonMasterID: personId++,
      FullName: pickName(religionId, genderId),
      Gender: { 1: 'M', 2: 'F', 3: 'T' }[genderId],
      AgeYear: age,
      CasteID: casteId,
      ReligionID: religionId,
      OccupationID: occupationId,
      Address: `${district.DistrictName}`,
      DistrictID: district.DistrictID,
      latitude: jitter(district.lat, 0.06),
      longitude: jitter(district.lng, 0.06),
      IsHabitualOffender: 0,
      RiskScore: 0,
      _genderId: genderId,
      _firCount: 0,
      _heinous: 0,
      _arrests: 0,
      _gangId: null,
    };
    persons.push(p);
    if (chance(0.9)) phones.push({ PhoneID: phoneId++, PersonMasterID: p.PersonMasterID, Number: makePhoneNumber(), Imei: chance(0.5) ? String(randInt(100000000000000, 999999999999999)) : null });
    if (chance(0.55)) accounts.push({ AccountID: accountId++, PersonMasterID: p.PersonMasterID, BankName: pick(banks), AccountNo: String(randInt(10000000000, 99999999999)), IFSC: `KARB000${randInt(1000, 9999)}`, IsFlagged: 0 });
  }

  const accountByPerson = {};
  for (const a of accounts) (accountByPerson[a.PersonMasterID] ||= []).push(a);
  function ensureAccount(person) {
    if (accountByPerson[person.PersonMasterID]) return accountByPerson[person.PersonMasterID][0];
    const a = { AccountID: accountId++, PersonMasterID: person.PersonMasterID, BankName: pick(banks), AccountNo: String(randInt(10000000000, 99999999999)), IFSC: `KARB000${randInt(1000, 9999)}`, IsFlagged: 0 };
    accounts.push(a); (accountByPerson[person.PersonMasterID] ||= []).push(a);
    return a;
  }

  // ---------- Offender pool, habituals, gangs ----------
  const offenderPool = persons.filter(() => chance(0.35));
  // propensity: base 1, some habituals much higher (they recur -> repeat offenders)
  for (const o of offenderPool) o._propensity = chance(0.15) ? randInt(6, 14) : 1;
  // gangs: cluster some offenders (co-offend + may share a phone)
  const gangs = [];
  const gangCandidates = offenderPool.slice();
  const gangCount = Math.min(28, Math.floor(offenderPool.length / 10));
  for (let g = 0; g < gangCount && gangCandidates.length >= 3; g++) {
    const size = randInt(3, 6);
    const members = [];
    for (let m = 0; m < size && gangCandidates.length; m++) {
      const idx = Math.floor(rand() * gangCandidates.length);
      const member = gangCandidates.splice(idx, 1)[0];
      member._gangId = g;
      members.push(member);
    }
    // shared burner phone for the gang -> creates network edges
    const burner = makePhoneNumber();
    for (const member of members) if (chance(0.5)) phones.push({ PhoneID: phoneId++, PersonMasterID: member.PersonMasterID, Number: burner, Imei: null });
    gangs.push(members);
  }
  const gangOf = (o) => (o._gangId != null ? gangs[o._gangId] : null);

  function pickAccusedPeople(subhead) {
    const isGroup = GROUP_CRIMES.has(subhead.name);
    let n = 1;
    if (subhead.name === 'Dacoity') n = randInt(3, 6);
    else if (subhead.name === 'Rioting' || subhead.name === 'Unlawful Assembly') n = randInt(3, 8);
    else if (isGroup) n = randInt(2, 4);
    else n = weightedPick([1, 1, 1, 1, 2, 2, 3], () => 1); // mostly solo

    // Solo offence: any offender (habitual offenders recur here). Creates no co-accused link.
    if (n === 1) return [weightedPick(offenderPool, (o) => o._propensity)];

    // Multi-accused offence: co-offending happens WITHIN a gang, so the co-accused
    // graph forms separable gang clusters instead of one transitive mega-component.
    const gang = pick(gangs);
    if (!gang || gang.length < 2) {
      const a = weightedPick(offenderPool, (o) => o._propensity);
      const b = weightedPick(offenderPool, (o) => o._propensity);
      return a === b ? [a] : [a, b];
    }
    const shuffled = gang.slice().sort(() => rand() - 0.5);
    return shuffled.slice(0, Math.min(n, gang.length));
  }

  // ---------- Officers per station ----------
  const officersByStation = {};
  for (const st of stations) {
    const count = randInt(4, 8);
    const list = [];
    for (let k = 0; k < count; k++) {
      const rankId = weightedPick([1, 1, 2, 3, 4, 4, 5, 6], x => 1);
      const genderId = chance(0.85) ? 1 : 2;
      const e = {
        EmployeeID: employeeId++,
        DistrictID: st.DistrictID,
        UnitID: st.UnitID,
        RankID: rankId,
        DesignationID: rankId >= 4 ? 1 : (rankId === 5 ? 2 : 3),
        KGID: `KG${randInt(100000, 999999)}`,
        FirstName: pickName(1, genderId).split(' ')[0],
        GenderID: genderId,
        AppointmentDate: isoDate(new Date(Date.UTC(randInt(1998, 2020), randInt(0, 11), randInt(1, 28)))),
      };
      employees.push(e); list.push(e);
    }
    officersByStation[st.UnitID] = list;
  }

  // ---------- Time window ----------
  const now = new Date();
  const windowMs = years * 365 * 24 * 3600 * 1000;

  function randomIncidentDate(subheadName) {
    const t = now.getTime() - Math.floor(rand() * windowMs);
    const d = new Date(t);
    // time-of-day bias
    let hour;
    if (NIGHT_CRIMES.has(subheadName)) hour = weightedPick([22, 23, 0, 1, 2, 3, 19, 20, 21, 14], x => 1);
    else hour = randInt(7, 21);
    d.setUTCHours(hour, randInt(0, 59), 0, 0);
    return d;
  }

  // running serial per (station, category, year)
  const serialCounter = {};
  const nextSerial = (unitId, catCode, year) => {
    const key = `${unitId}|${catCode}|${year}`;
    serialCounter[key] = (serialCounter[key] || 0) + 1;
    return serialCounter[key];
  };

  const serialSeqByStatus = CASE_STATUS_WEIGHTS;

  // ---------- FIR generation ----------
  const repeatVictimPool = []; // small pool reused for MARAC-style repeat victimization
  for (let i = 0; i < firCount; i++) {
    const subhead = weightedPick(subheads, s => s.weight);
    const district = weightedPick(districts, d => DISTRICT_WEIGHTS[d.DistrictID] || 4);
    const station = pick(stationsByDistrict[district.DistrictID]);
    const officers = officersByStation[station.UnitID];
    const io = pick(officers.filter(o => o.RankID >= 3)) || pick(officers);

    const incidentDate = randomIncidentDate(subhead.name);
    const regDelayHrs = randInt(1, 72);
    const regDate = new Date(incidentDate.getTime() + regDelayHrs * 3600 * 1000);
    const year = regDate.getUTCFullYear();

    const categoryCode = 1; // FIR
    const serial = nextSerial(station.UnitID, categoryCode, year);
    const crimeNo = buildCrimeNo(categoryCode, district.DistrictID, station.UnitID, year, serial);
    const caseNo = `${year}${String(serial).padStart(5, '0')}`;

    const statusId = +weightedPick(Object.keys(serialSeqByStatus), k => serialSeqByStatus[k]);
    const chargeSheeted = [2, 3, 4, 7].includes(statusId);
    const court = chargeSheeted ? pick(courtsByDistrict[district.DistrictID]) : null;

    const night = NIGHT_CRIMES.has(subhead.name);
    const amt = randInt(1, 40) * 5000;
    const briefCtx = {
      place: station.UnitName.replace(/ PS.*$/, ''), night, n: 0,
      item: pick(THEFT_ITEMS), reg: `${randInt(1, 59)}${pick(['AB', 'CD', 'EF', 'HK', 'MN'])}${randInt(1000, 9999)}`,
      amt: amt.toLocaleString('en-IN'), drug: pick(DRUGS), channel: pick(CHANNELS),
      who: chance(0.5) ? 'a minor girl' : 'an adult male',
    };

    const caseRow = {
      CaseMasterID: caseId++,
      CrimeNo: crimeNo,
      CaseNo: caseNo,
      CrimeRegisteredDate: isoDate(regDate),
      PolicePersonID: io.EmployeeID,
      PoliceStationID: station.UnitID,
      CaseCategoryID: 1,
      GravityOffenceID: subhead.gravityId,
      CrimeMajorHeadID: subhead.headId,
      CrimeMinorHeadID: subhead.CrimeSubHeadID,
      CaseStatusID: statusId,
      CourtID: court ? court.CourtID : null,
      IncidentFromDate: isoDateTime(incidentDate),
      IncidentToDate: isoDateTime(incidentDate),
      InfoReceivedPSDate: isoDateTime(regDate),
      latitude: jitter(station.latitude, 0.03),
      longitude: jitter(station.longitude, 0.03),
      BriefFacts: '',
    };

    // ----- Accused -----
    const unknownAccused = OFTEN_UNKNOWN_ACCUSED.has(subhead.name) && chance(0.45);
    let accusedPeople = [];
    if (!unknownAccused) {
      accusedPeople = pickAccusedPeople(subhead);
      accusedPeople.forEach((person, idx) => {
        person._firCount++;
        if (subhead.gravity === 'Heinous') person._heinous++;
        accuseds.push({
          AccusedMasterID: accusedId++,
          CaseMasterID: caseRow.CaseMasterID,
          AccusedName: person.FullName,
          AgeYear: person.AgeYear,
          GenderID: person._genderId,
          PersonID: `A${idx + 1}`,
          PersonMasterID: person.PersonMasterID,
        });
      });
    }
    briefCtx.n = accusedPeople.length || randInt(2, 5);

    // ----- Victim (for body/women crimes) -----
    const needsVictim = subhead.headName === 'Crimes Against Body' || FEMALE_VICTIM_CRIMES.has(subhead.name) || subhead.headName === 'Road Accidents';
    let victimPerson = null;
    if (needsVictim) {
      const female = FEMALE_VICTIM_CRIMES.has(subhead.name);
      // Bias ~35% of crimes-against-women onto a small pool → MARAC repeat-victim demos
      if (female && chance(0.35) && repeatVictimPool.length) {
        victimPerson = pick(repeatVictimPool);
      } else {
        victimPerson = female ? weightedPick(persons, (p) => (p._genderId === 2 ? 3 : 0.2)) : pick(persons);
        if (female && victimPerson._genderId === 2 && repeatVictimPool.length < 12
            && !repeatVictimPool.includes(victimPerson)) {
          repeatVictimPool.push(victimPerson);
        }
      }
      victims.push({
        VictimMasterID: victimId++,
        CaseMasterID: caseRow.CaseMasterID,
        VictimName: victimPerson.FullName,
        AgeYear: victimPerson.AgeYear,
        GenderID: victimPerson._genderId,
        VictimPolice: chance(0.02) ? 1 : 0,
        PersonMasterID: victimPerson.PersonMasterID,
      });
    }

    // ----- Complainant -----
    const complainantPerson = victimPerson && chance(0.6) ? victimPerson : pick(persons);
    complainants.push({
      ComplainantID: complainantId++,
      CaseMasterID: caseRow.CaseMasterID,
      ComplainantName: complainantPerson.FullName,
      AgeYear: complainantPerson.AgeYear,
      OccupationID: complainantPerson.OccupationID,
      ReligionID: complainantPerson.ReligionID,
      CasteID: complainantPerson.CasteID,
      GenderID: complainantPerson._genderId,
      PersonMasterID: complainantPerson.PersonMasterID,
    });

    // ----- Act-Section associations -----
    subhead.sections.forEach((sec, idx) => {
      if (!sec) return;
      actSecAssoc.push({
        ActSectionAssociationID: asaId++,
        CaseMasterID: caseRow.CaseMasterID,
        ActID: sec.ActCode,
        SectionID: sec.SectionID,
        ActOrderID: 1,
        SectionOrderID: idx + 1,
      });
    });

    // ----- Arrests (for known accused in serious/charge-sheeted cases) -----
    for (const person of accusedPeople) {
      const arrestProb = subhead.gravity === 'Heinous' ? 0.7 : (chargeSheeted ? 0.6 : 0.25);
      if (chance(arrestProb)) {
        const arrestDate = new Date(regDate.getTime() + randInt(1, 45) * 24 * 3600 * 1000);
        const accusedRow = accuseds[accuseds.length - accusedPeople.length + accusedPeople.indexOf(person)];
        arrests.push({
          ArrestSurrenderID: arrestId++,
          CaseMasterID: caseRow.CaseMasterID,
          ArrestSurrenderTypeID: chance(0.85) ? 1 : 2,
          ArrestSurrenderDate: isoDate(arrestDate),
          ArrestSurrenderStateId: 29,
          ArrestSurrenderDistrictId: district.DistrictID,
          PoliceStationID: station.UnitID,
          IOID: io.EmployeeID,
          CourtID: court ? court.CourtID : null,
          AccusedMasterID: accusedRow ? accusedRow.AccusedMasterID : null,
          IsAccused: 1,
          IsComplainantAccused: 0,
        });
        person._arrests++;
      }
    }

    // ----- Chargesheet -----
    if (chargeSheeted) {
      chargesheets.push({
        CSID: csId++,
        CaseMasterID: caseRow.CaseMasterID,
        csdate: isoDate(new Date(regDate.getTime() + randInt(30, 120) * 24 * 3600 * 1000)),
        cstype: 'A',
        PolicePersonID: io.EmployeeID,
      });
    } else if (statusId === 6) {
      chargesheets.push({ CSID: csId++, CaseMasterID: caseRow.CaseMasterID, csdate: isoDate(new Date(regDate.getTime() + randInt(30, 120) * 86400000)), cstype: 'B', PolicePersonID: io.EmployeeID });
    } else if (statusId === 5) {
      chargesheets.push({ CSID: csId++, CaseMasterID: caseRow.CaseMasterID, csdate: isoDate(new Date(regDate.getTime() + randInt(60, 180) * 86400000)), cstype: 'C', PolicePersonID: io.EmployeeID });
    }

    // ----- Financial money-trail -----
    if (FINANCIAL_CRIMES.has(subhead.name) && accusedPeople.length) {
      const victimAcct = ensureAccount(complainantPerson);
      const mainAccused = accusedPeople[0];
      const primary = ensureAccount(mainAccused);
      const txnDate = new Date(regDate.getTime() - randInt(1, 20) * 86400000);
      // victim -> primary accused (the fraud)
      txns.push({ TxnID: txnId++, FromAccountID: victimAcct.AccountID, ToAccountID: primary.AccountID, Amount: amt, TxnDate: isoDate(txnDate), Channel: pick(CHANNELS).toUpperCase(), CaseMasterID: caseRow.CaseMasterID, IsSuspicious: 1 });
      primary.IsFlagged = 1;
      // layering: primary -> 2-3 mules (split)
      const mules = randInt(2, 3);
      for (let m = 0; m < mules; m++) {
        const mulePerson = pick(offenderPool.length ? offenderPool : persons);
        const muleAcct = ensureAccount(mulePerson);
        muleAcct.IsFlagged = 1;
        txns.push({ TxnID: txnId++, FromAccountID: primary.AccountID, ToAccountID: muleAcct.AccountID, Amount: Math.round(amt / mules * (0.8 + rand() * 0.3)), TxnDate: isoDate(new Date(txnDate.getTime() + randInt(1, 5) * 86400000)), Channel: 'IMPS', CaseMasterID: caseRow.CaseMasterID, IsSuspicious: 1 });
      }
    }

    caseRow.BriefFacts = (BRIEF_FACTS[subhead.name] || ((o) => `Case registered at ${o.place}.`))(briefCtx);
    cases.push(caseRow);
  }

  // ---------- Post-process: habitual flags + percentile risk score ----------
  // Raw score (uncapped) then map to 0–100 by rank percentile so tiers separate.
  const withCases = persons.filter((p) => p._firCount > 0);
  for (const p of persons) {
    if (p._firCount >= 3) p.IsHabitualOffender = 1;
    const youth = p.AgeYear < 30 ? 8 : 0;
    p._rawRisk = p._firCount * 12 + p._heinous * 15 + (p._arrests || 0) * 6 + youth;
  }
  const ranked = [...withCases].sort((a, b) => a._rawRisk - b._rawRisk);
  ranked.forEach((p, i) => {
    // Percentile among offenders (not among all persons) → real tier spread
    p.RiskScore = ranked.length <= 1
      ? 50
      : Math.round((i / (ranked.length - 1)) * 100);
  });
  for (const p of persons) {
    if (p.RiskScore == null) p.RiskScore = 0;
  }

  // ---------- Bulk insert ----------
  const bulk = (table, cols, rows) => {
    if (!rows.length) return;
    const stmt = db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(c => '@' + c).join(', ')})`);
    const clean = rows.map(r => { const o = {}; for (const c of cols) o[c] = r[c] === undefined ? null : r[c]; return o; });
    db.transaction(items => { for (const it of items) stmt.run(it); })(clean);
  };

  bulk('PersonMaster', ['PersonMasterID', 'FullName', 'Gender', 'AgeYear', 'CasteID', 'ReligionID', 'OccupationID', 'Address', 'DistrictID', 'latitude', 'longitude', 'IsHabitualOffender', 'RiskScore'], persons);
  bulk('PhoneNumber', ['PhoneID', 'PersonMasterID', 'Number', 'Imei'], phones);
  bulk('BankAccount', ['AccountID', 'PersonMasterID', 'BankName', 'AccountNo', 'IFSC', 'IsFlagged'], accounts);
  bulk('Employee', ['EmployeeID', 'DistrictID', 'UnitID', 'RankID', 'DesignationID', 'KGID', 'FirstName', 'GenderID', 'AppointmentDate'], employees);
  bulk('CaseMaster', ['CaseMasterID', 'CrimeNo', 'CaseNo', 'CrimeRegisteredDate', 'PolicePersonID', 'PoliceStationID', 'CaseCategoryID', 'GravityOffenceID', 'CrimeMajorHeadID', 'CrimeMinorHeadID', 'CaseStatusID', 'CourtID', 'IncidentFromDate', 'IncidentToDate', 'InfoReceivedPSDate', 'latitude', 'longitude', 'BriefFacts'], cases);
  bulk('Accused', ['AccusedMasterID', 'CaseMasterID', 'AccusedName', 'AgeYear', 'GenderID', 'PersonID', 'PersonMasterID'], accuseds);
  bulk('Victim', ['VictimMasterID', 'CaseMasterID', 'VictimName', 'AgeYear', 'GenderID', 'VictimPolice', 'PersonMasterID'], victims);
  bulk('ComplainantDetails', ['ComplainantID', 'CaseMasterID', 'ComplainantName', 'AgeYear', 'OccupationID', 'ReligionID', 'CasteID', 'GenderID', 'PersonMasterID'], complainants);
  bulk('ArrestSurrender', ['ArrestSurrenderID', 'CaseMasterID', 'ArrestSurrenderTypeID', 'ArrestSurrenderDate', 'ArrestSurrenderStateId', 'ArrestSurrenderDistrictId', 'PoliceStationID', 'IOID', 'CourtID', 'AccusedMasterID', 'IsAccused', 'IsComplainantAccused'], arrests);
  bulk('ActSectionAssociation', ['ActSectionAssociationID', 'CaseMasterID', 'ActID', 'SectionID', 'ActOrderID', 'SectionOrderID'], actSecAssoc);
  bulk('ChargesheetDetails', ['CSID', 'CaseMasterID', 'csdate', 'cstype', 'PolicePersonID'], chargesheets);
  bulk('FinancialTransaction', ['TxnID', 'FromAccountID', 'ToAccountID', 'Amount', 'TxnDate', 'Channel', 'CaseMasterID', 'IsSuspicious'], txns);
  // update flagged accounts (mule/hub) set during trail building
  const flagStmt = db.prepare('UPDATE BankAccount SET IsFlagged = 1 WHERE AccountID = ?');
  db.transaction(() => { for (const a of accounts) if (a.IsFlagged) flagStmt.run(a.AccountID); })();

  return {
    counts: {
      persons: persons.length, employees: employees.length, cases: cases.length,
      accused: accuseds.length, victims: victims.length, complainants: complainants.length,
      arrests: arrests.length, chargesheets: chargesheets.length, transactions: txns.length,
      accounts: accounts.length, phones: phones.length, gangs: gangs.length,
      habitualOffenders: persons.filter(p => p.IsHabitualOffender).length,
    },
  };
}

module.exports = { generateAndSeed };
