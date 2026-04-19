// ============================================================
// CRIMESCOPE AI — Database Setup & Seed
// ============================================================

const Database = require('better-sqlite3');
const path = require('path');
const { generateSeedData } = require('./services/dataGenerator');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'crimescope.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      crime_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      location_name TEXT,
      region TEXT,
      timestamp TEXT NOT NULL,
      source TEXT NOT NULL,
      source_url TEXT,
      confidence REAL DEFAULT 0.85,
      status TEXT DEFAULT 'active',
      nlp_entities TEXT,
      merged_with TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      incident_id TEXT,
      alert_type TEXT NOT NULL,
      priority TEXT NOT NULL,
      message TEXT NOT NULL,
      acknowledged INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (incident_id) REFERENCES incidents(id)
    );

    CREATE TABLE IF NOT EXISTS analytics_cache (
      id TEXT PRIMARY KEY,
      metric_type TEXT NOT NULL,
      region TEXT,
      data TEXT NOT NULL,
      computed_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS regions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      center_lat REAL,
      center_lng REAL,
      risk_score REAL DEFAULT 0.5,
      incident_count INTEGER DEFAULT 0,
      last_incident_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_incidents_type ON incidents(crime_type);
    CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
    CREATE INDEX IF NOT EXISTS idx_incidents_region ON incidents(region);
    CREATE INDEX IF NOT EXISTS idx_incidents_timestamp ON incidents(timestamp);
    CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
    CREATE INDEX IF NOT EXISTS idx_alerts_priority ON alerts(priority);
    CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(acknowledged);
  `);
}

function seedDatabase() {
  const existingCount = db.prepare('SELECT COUNT(*) as count FROM incidents').get().count;

  if (existingCount > 0) {
    console.log(`   Database already has ${existingCount} incidents. Skipping seed.`);
    return;
  }

  console.log('   Seeding database with 500 incidents...');

  const incidents = generateSeedData(500);

  const insertStmt = db.prepare(`
    INSERT INTO incidents (id, title, description, crime_type, severity, latitude, longitude,
      location_name, region, timestamp, source, source_url, confidence, status, nlp_entities, merged_with)
    VALUES (@id, @title, @description, @crime_type, @severity, @latitude, @longitude,
      @location_name, @region, @timestamp, @source, @source_url, @confidence, @status, @nlp_entities, @merged_with)
  `);

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insertStmt.run(item);
    }
  });

  insertMany(incidents);

  // Generate some initial alerts
  const recentIncidents = incidents.slice(-30);
  const alertStmt = db.prepare(`
    INSERT INTO alerts (id, incident_id, alert_type, priority, message, created_at)
    VALUES (@id, @incident_id, @alert_type, @priority, @message, @created_at)
  `);

  const alertInsert = db.transaction((items) => {
    for (const item of items) {
      alertStmt.run(item);
    }
  });

  const alerts = recentIncidents.map(inc => ({
    id: uuidv4(),
    incident_id: inc.id,
    alert_type: 'new_incident',
    priority: inc.severity,
    message: inc.title,
    created_at: inc.timestamp,
  }));

  alertInsert(alerts);

  // Seed regions
  const regionMap = {};
  for (const inc of incidents) {
    if (!regionMap[inc.region]) {
      regionMap[inc.region] = {
        id: uuidv4(),
        name: inc.region,
        center_lat: inc.latitude,
        center_lng: inc.longitude,
        risk_score: 50,
        incident_count: 0,
        last_incident_at: inc.timestamp,
      };
    }
    regionMap[inc.region].incident_count++;
    regionMap[inc.region].last_incident_at = inc.timestamp;
  }

  const regionStmt = db.prepare(`
    INSERT OR REPLACE INTO regions (id, name, center_lat, center_lng, risk_score, incident_count, last_incident_at)
    VALUES (@id, @name, @center_lat, @center_lng, @risk_score, @incident_count, @last_incident_at)
  `);

  const regionInsert = db.transaction((items) => {
    for (const item of items) {
      regionStmt.run(item);
    }
  });

  regionInsert(Object.values(regionMap));

  console.log(`   ✓ Seeded ${incidents.length} incidents, ${alerts.length} alerts, ${Object.keys(regionMap).length} regions`);
}

function insertIncident(incident) {
  const stmt = getDb().prepare(`
    INSERT INTO incidents (id, title, description, crime_type, severity, latitude, longitude,
      location_name, region, timestamp, source, source_url, confidence, status, nlp_entities, merged_with)
    VALUES (@id, @title, @description, @crime_type, @severity, @latitude, @longitude,
      @location_name, @region, @timestamp, @source, @source_url, @confidence, @status, @nlp_entities, @merged_with)
  `);
  stmt.run(incident);

  // Update region count
  getDb().prepare(`
    UPDATE regions SET incident_count = incident_count + 1, last_incident_at = @timestamp
    WHERE name = @region
  `).run({ region: incident.region, timestamp: incident.timestamp });

  return incident;
}

function insertAlert(alert) {
  const stmt = getDb().prepare(`
    INSERT INTO alerts (id, incident_id, alert_type, priority, message, created_at)
    VALUES (@id, @incident_id, @alert_type, @priority, @message, @created_at)
  `);
  stmt.run(alert);
  return alert;
}

module.exports = { getDb, seedDatabase, insertIncident, insertAlert };
