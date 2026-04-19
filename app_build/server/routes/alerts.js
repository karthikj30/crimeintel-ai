// ============================================================
// CRIMESCOPE AI — Alert API Routes
// ============================================================

const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// GET /api/alerts — Get all alerts
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { acknowledged, priority, limit = 100 } = req.query;

    let sql = 'SELECT a.*, i.crime_type, i.location_name, i.severity as incident_severity, i.latitude, i.longitude FROM alerts a LEFT JOIN incidents i ON a.incident_id = i.id WHERE 1=1';
    const params = {};

    if (acknowledged !== undefined) {
      sql += ' AND a.acknowledged = @acknowledged';
      params.acknowledged = parseInt(acknowledged);
    }
    if (priority) {
      sql += ' AND a.priority = @priority';
      params.priority = priority;
    }

    sql += ' ORDER BY a.created_at DESC LIMIT @limit';
    params.limit = parseInt(limit);

    const alerts = db.prepare(sql).all(params);
    const unreadCount = db.prepare('SELECT COUNT(*) as c FROM alerts WHERE acknowledged = 0').get().c;

    res.json({ alerts, unreadCount });
  } catch (err) {
    console.error('Error fetching alerts:', err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// PATCH /api/alerts/:id/acknowledge — Acknowledge an alert
router.patch('/:id/acknowledge', (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE alerts SET acknowledged = 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error acknowledging alert:', err);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

module.exports = router;
