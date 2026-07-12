// ============================================================
// KSP INTEL API — investigative engines
//   GET /api/intel/overview
//   GET /api/intel/linkage
//   GET /api/intel/geographic?series=<id>
//   GET /api/intel/solve?series=<id>
//   GET /api/intel/near-repeat
//   GET /api/intel/mules
//   GET /api/intel/solvability
//   GET /api/intel/prolific
//   GET /api/intel/safeguarding
//   GET /api/intel/cold-case
// ============================================================
const express = require('express');
const intel = require('../intel');

const router = express.Router();

router.get('/overview', (req, res) => {
  try { res.json(intel.overview()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/linkage', (req, res) => {
  try { res.json(intel.findLinkages({ limit: parseInt(req.query.limit, 10) || 12 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/geographic', (req, res) => {
  try {
    const data = intel.profileSeries(req.query.series || null);
    if (data.error) return res.status(400).json(data);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/near-repeat', (req, res) => {
  try { res.json(intel.nearRepeatAlerts({ limit: parseInt(req.query.limit, 10) || 40 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/mules', (req, res) => {
  try { res.json(intel.detectMules({ limit: parseInt(req.query.limit, 10) || 25 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/solvability', (req, res) => {
  try { res.json(intel.solvabilityTriage({ limit: parseInt(req.query.limit, 10) || 40 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/prolific', (req, res) => {
  try { res.json(intel.prolificWatchlist({ limit: parseInt(req.query.limit, 10) || 30 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/safeguarding', (req, res) => {
  try { res.json(intel.safeguardingAlerts({ limit: parseInt(req.query.limit, 10) || 30 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/solve', (req, res) => {
  try {
    const data = intel.solveSeries(req.query.series || null);
    if (data.error) return res.status(400).json(data);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/cold-case', (req, res) => {
  try { res.json(intel.reopenColdCases({ limit: parseInt(req.query.limit, 10) || 25 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
