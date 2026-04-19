// ============================================================
// CRIMESCOPE AI — Search API Routes
// ============================================================

const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// GET /api/search?q= — Full-text search
router.get('/', (req, res) => {
  try {
    const { q, limit = 50 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({ results: [], total: 0 });
    }

    const db = getDb();
    const searchTerm = `%${q.trim().toLowerCase()}%`;

    const results = db.prepare(`
      SELECT * FROM incidents
      WHERE merged_with IS NULL
      AND (LOWER(title) LIKE @q OR LOWER(description) LIKE @q
        OR LOWER(location_name) LIKE @q OR LOWER(region) LIKE @q
        OR LOWER(crime_type) LIKE @q)
      ORDER BY timestamp DESC
      LIMIT @limit
    `).all({ q: searchTerm, limit: parseInt(limit) });

    res.json({ results, total: results.length, query: q });
  } catch (err) {
    console.error('Error searching:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
