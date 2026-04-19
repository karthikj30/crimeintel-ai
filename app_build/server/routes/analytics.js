// ============================================================
// CRIMESCOPE AI — Analytics API Routes
// ============================================================

const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { detectAnomalies, calculateRiskScore } = require('../services/anomalyDetector');

// GET /api/analytics/overview — KPI summary
router.get('/overview', (req, res) => {
  try {
    const db = getDb();
    const now = new Date();
    const h24 = new Date(now - 24 * 3600000).toISOString();
    const h48 = new Date(now - 48 * 3600000).toISOString();
    const h7d = new Date(now - 7 * 24 * 3600000).toISOString();

    const total = db.prepare('SELECT COUNT(*) as c FROM incidents WHERE merged_with IS NULL').get().c;
    const last24h = db.prepare('SELECT COUNT(*) as c FROM incidents WHERE timestamp >= ? AND merged_with IS NULL').get(h24).c;
    const prev24h = db.prepare('SELECT COUNT(*) as c FROM incidents WHERE timestamp >= ? AND timestamp < ? AND merged_with IS NULL').get(h48, h24).c;

    const activeAlerts = db.prepare('SELECT COUNT(*) as c FROM alerts WHERE acknowledged = 0').get().c;
    const criticalCount = db.prepare('SELECT COUNT(*) as c FROM incidents WHERE severity = ? AND timestamp >= ? AND merged_with IS NULL').get('critical', h7d).c;

    // Top crime type
    const topCrime = db.prepare(`
      SELECT crime_type, COUNT(*) as c FROM incidents
      WHERE timestamp >= ? AND merged_with IS NULL
      GROUP BY crime_type ORDER BY c DESC LIMIT 1
    `).get(h7d);

    // Most affected region
    const topRegion = db.prepare(`
      SELECT region, COUNT(*) as c FROM incidents
      WHERE timestamp >= ? AND merged_with IS NULL
      GROUP BY region ORDER BY c DESC LIMIT 1
    `).get(h7d);

    // Average confidence
    const avgConf = db.prepare('SELECT AVG(confidence) as avg FROM incidents WHERE merged_with IS NULL').get().avg;

    // Hourly trend for last 24h
    const hourlyTrend = [];
    for (let i = 23; i >= 0; i--) {
      const start = new Date(now - (i + 1) * 3600000).toISOString();
      const end = new Date(now - i * 3600000).toISOString();
      const count = db.prepare('SELECT COUNT(*) as c FROM incidents WHERE timestamp >= ? AND timestamp < ? AND merged_with IS NULL').get(start, end).c;
      hourlyTrend.push({
        hour: new Date(now - i * 3600000).getHours(),
        count,
        label: `${new Date(now - i * 3600000).getHours()}:00`,
      });
    }

    res.json({
      totalIncidents: total,
      last24h,
      change24h: prev24h > 0 ? Math.round(((last24h - prev24h) / prev24h) * 100) : 0,
      activeAlerts,
      criticalIncidents: criticalCount,
      topCrimeType: topCrime ? topCrime.crime_type : 'N/A',
      topCrimeCount: topCrime ? topCrime.c : 0,
      topRegion: topRegion ? topRegion.region : 'N/A',
      topRegionCount: topRegion ? topRegion.c : 0,
      avgConfidence: Math.round((avgConf || 0.85) * 100),
      hourlyTrend,
    });
  } catch (err) {
    console.error('Error fetching overview:', err);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

// GET /api/analytics/temporal — Time-series data
router.get('/temporal', (req, res) => {
  try {
    const db = getDb();
    const now = new Date();

    // Daily counts for last 7 days
    const dailyData = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const counts = db.prepare(`
        SELECT crime_type, COUNT(*) as c FROM incidents
        WHERE timestamp >= ? AND timestamp < ? AND merged_with IS NULL
        GROUP BY crime_type
      `).all(dayStart.toISOString(), dayEnd.toISOString());

      const dayLabel = dayStart.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
      const entry = { date: dayLabel, total: 0 };

      for (const row of counts) {
        entry[row.crime_type] = row.c;
        entry.total += row.c;
      }
      dailyData.push(entry);
    }

    // Hourly pattern (aggregate all data by hour of day)
    const hourlyPattern = db.prepare(`
      SELECT CAST(strftime('%H', timestamp) AS INTEGER) as hour, COUNT(*) as count
      FROM incidents WHERE merged_with IS NULL
      GROUP BY hour ORDER BY hour
    `).all();

    // Day of week pattern
    const dowPattern = db.prepare(`
      SELECT CAST(strftime('%w', timestamp) AS INTEGER) as dow, COUNT(*) as count
      FROM incidents WHERE merged_with IS NULL
      GROUP BY dow ORDER BY dow
    `).all();

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dowData = dowPattern.map(d => ({
      day: dayNames[d.dow],
      count: d.count,
    }));

    res.json({ dailyData, hourlyPattern, dowData });
  } catch (err) {
    console.error('Error fetching temporal data:', err);
    res.status(500).json({ error: 'Failed to fetch temporal data' });
  }
});

// GET /api/analytics/categories — Crime type breakdown
router.get('/categories', (req, res) => {
  try {
    const db = getDb();

    const categories = db.prepare(`
      SELECT crime_type, COUNT(*) as count,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low,
        ROUND(AVG(confidence) * 100) as avg_confidence
      FROM incidents WHERE merged_with IS NULL
      GROUP BY crime_type ORDER BY count DESC
    `).all();

    const total = categories.reduce((sum, c) => sum + c.count, 0);
    const result = categories.map(c => ({
      ...c,
      percentage: Math.round((c.count / total) * 1000) / 10,
    }));

    res.json({ categories: result, total });
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/analytics/regions — Region risk scores
router.get('/regions', (req, res) => {
  try {
    const db = getDb();

    const regions = db.prepare(`
      SELECT region, COUNT(*) as incident_count,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_count,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high_count,
        AVG(latitude) as center_lat,
        AVG(longitude) as center_lng,
        MAX(timestamp) as last_incident
      FROM incidents WHERE merged_with IS NULL AND region IS NOT NULL
      GROUP BY region ORDER BY incident_count DESC
    `).all();

    // Calculate risk scores
    const allIncidents = db.prepare('SELECT * FROM incidents WHERE merged_with IS NULL').all();

    const result = regions.map(r => {
      const regionIncidents = allIncidents.filter(i => i.region === r.region);
      const riskScore = calculateRiskScore(regionIncidents, allIncidents);
      return {
        ...r,
        risk_score: riskScore,
        risk_level: riskScore >= 75 ? 'critical' : riskScore >= 50 ? 'high' : riskScore >= 25 ? 'medium' : 'low',
      };
    });

    res.json({ regions: result });
  } catch (err) {
    console.error('Error fetching regions:', err);
    res.status(500).json({ error: 'Failed to fetch regions' });
  }
});

// GET /api/analytics/anomalies — Detected anomalies
router.get('/anomalies', (req, res) => {
  try {
    const db = getDb();
    const incidents = db.prepare('SELECT * FROM incidents WHERE merged_with IS NULL').all();
    const anomalies = detectAnomalies(incidents);
    res.json({ anomalies });
  } catch (err) {
    console.error('Error detecting anomalies:', err);
    res.status(500).json({ error: 'Failed to detect anomalies' });
  }
});

module.exports = router;
