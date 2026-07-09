// ============================================================
// KSP CRIME INTELLIGENCE — Criminal Network API
//   GET /api/network/graph?max=110   -> nodes + edges + stats
//   GET /api/network/gangs           -> detected gang clusters
//   GET /api/network/person/:id      -> ego network + profile
// ============================================================

const express = require('express');
const { buildGraph, listGangs, personEgo } = require('../graph/networkBuilder');

const router = express.Router();

router.get('/graph', (req, res) => {
  const max = Math.min(200, parseInt(req.query.max, 10) || 110);
  res.json(buildGraph({ maxNodes: max }));
});

router.get('/gangs', (req, res) => {
  res.json({ gangs: listGangs({}) });
});

router.get('/person/:id', (req, res) => {
  const ego = personEgo(parseInt(req.params.id, 10));
  if (!ego) return res.status(404).json({ error: 'person not found' });
  res.json(ego);
});

module.exports = router;
