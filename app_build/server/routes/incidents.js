// ============================================================
// CRIMESCOPE AI — Incident API Routes
// ============================================================

const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// GET /api/incidents — List incidents with filters
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { type, severity, region, source, status, limit = 200, offset = 0, sort = 'timestamp', order = 'DESC' } = req.query;

    let sql = 'SELECT * FROM incidents WHERE merged_with IS NULL';
    const params = {};

    if (type) {
      sql += ' AND crime_type = @type';
      params.type = type;
    }
    if (severity) {
      sql += ' AND severity = @severity';
      params.severity = severity;
    }
    if (region) {
      sql += ' AND region = @region';
      params.region = region;
    }
    if (source) {
      sql += ' AND source = @source';
      params.source = source;
    }
    if (status) {
      sql += ' AND status = @status';
      params.status = status;
    }

    const allowedSorts = ['timestamp', 'severity', 'crime_type', 'confidence'];
    const sortCol = allowedSorts.includes(sort) ? sort : 'timestamp';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    sql += ` ORDER BY ${sortCol} ${sortOrder} LIMIT @limit OFFSET @offset`;
    params.limit = parseInt(limit);
    params.offset = parseInt(offset);

    const incidents = db.prepare(sql).all(params);
    const total = db.prepare('SELECT COUNT(*) as count FROM incidents WHERE merged_with IS NULL').get().count;

    res.json({ incidents, total, limit: params.limit, offset: params.offset });
  } catch (err) {
    console.error('Error fetching incidents:', err);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// GET /api/incidents/heatmap — Heatmap data
router.get('/heatmap', (req, res) => {
  try {
    const db = getDb();
    const incidents = db.prepare(`
      SELECT latitude, longitude, severity, crime_type
      FROM incidents
      WHERE merged_with IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL
      ORDER BY timestamp DESC
      LIMIT 2000
    `).all();

    const heatmapData = incidents.map(i => {
      const intensityMap = { critical: 1.0, high: 0.75, medium: 0.5, low: 0.25 };
      return [i.latitude, i.longitude, intensityMap[i.severity] || 0.5];
    });

    res.json({ heatmapData, count: heatmapData.length });
  } catch (err) {
    console.error('Error fetching heatmap data:', err);
    res.status(500).json({ error: 'Failed to fetch heatmap data' });
  }
});

// GET /api/incidents/:id — Get single incident
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id);

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Get related incidents (same region, same type, nearby time)
    const related = db.prepare(`
      SELECT * FROM incidents
      WHERE id != @id AND crime_type = @type AND region = @region
      AND merged_with IS NULL
      ORDER BY ABS(julianday(timestamp) - julianday(@timestamp)) ASC
      LIMIT 5
    `).all({
      id: incident.id,
      type: incident.crime_type,
      region: incident.region,
      timestamp: incident.timestamp,
    });

    res.json({ incident, related });
  } catch (err) {
    console.error('Error fetching incident:', err);
    res.status(500).json({ error: 'Failed to fetch incident' });
  }
});

module.exports = router;
