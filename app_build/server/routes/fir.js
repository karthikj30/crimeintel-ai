// ============================================================
// KSP CRIME INTELLIGENCE — FIR Geo + Analytics API
//   /api/fir/stations   real Karnataka police stations (OSM)
//   /api/fir/heatmap     FIR incident points
//   /api/fir/districts   district aggregates (map circles)
//   /api/fir/overview | temporal | categories | demographics | hourly | forecast | offenders
// ============================================================

const express = require('express');
const A = require('../fir/analytics');
const { overviewStats } = require('../fir/queries');

const router = express.Router();

router.get('/stations', (req, res) => res.json(A.stations()));
router.get('/heatmap', (req, res) => res.json(A.heatmapPoints()));
router.get('/districts', (req, res) => res.json(A.districtAgg()));
router.get('/overview', (req, res) => res.json(overviewStats()));
router.get('/temporal', (req, res) => res.json(A.temporal()));
router.get('/categories', (req, res) => res.json(A.categories()));
router.get('/demographics', (req, res) => res.json(A.demographics()));
router.get('/hourly', (req, res) => res.json(A.hourly()));
router.get('/forecast', (req, res) => res.json(A.forecast()));
router.get('/offenders', (req, res) => res.json(A.offenders()));

module.exports = router;
