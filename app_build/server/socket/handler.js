// ============================================================
// CRIMESCOPE AI — WebSocket Event Handler
// ============================================================

const { v4: uuidv4 } = require('uuid');
const { generateRealtimeIncident } = require('../services/dataGenerator');
const { analyzeText } = require('../services/nlpClassifier');
const { insertIncident, insertAlert } = require('../database');

function setupSocketHandler(io) {
  let connectionCount = 0;
  let simulationInterval = null;

  io.on('connection', (socket) => {
    connectionCount++;
    console.log(`   🔌 Client connected (${connectionCount} active)`);

    socket.emit('connected', { status: 'ok', timestamp: new Date().toISOString() });

    // Start simulation if first client
    if (connectionCount === 1 && !simulationInterval) {
      startSimulation(io);
    }

    socket.on('alert:acknowledge', (data) => {
      try {
        const { getDb } = require('../database');
        getDb().prepare('UPDATE alerts SET acknowledged = 1 WHERE id = ?').run(data.alertId);
        io.emit('alert:acknowledged', { alertId: data.alertId });
      } catch (err) {
        console.error('Error acknowledging alert:', err);
      }
    });

    socket.on('disconnect', () => {
      connectionCount--;
      console.log(`   🔌 Client disconnected (${connectionCount} active)`);

      if (connectionCount === 0 && simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
      }
    });
  });

  function startSimulation(io) {
    console.log('   🔄 Starting real-time crime simulation...');

    simulationInterval = setInterval(() => {
      try {
        // Generate a new incident
        const rawIncident = generateRealtimeIncident();

        // Run through NLP pipeline
        const nlpResult = analyzeText(rawIncident.title);

        // Enrich with NLP data
        const incident = {
          ...rawIncident,
          crime_type: nlpResult.crimeType,
          severity: nlpResult.severity || rawIncident.severity,
          confidence: nlpResult.confidence,
          nlp_entities: JSON.stringify(nlpResult.entities),
        };

        // Store in database
        insertIncident(incident);

        // Create alert
        const alert = {
          id: uuidv4(),
          incident_id: incident.id,
          alert_type: 'new_incident',
          priority: incident.severity,
          message: incident.title,
          created_at: incident.timestamp,
        };
        insertAlert(alert);

        // Broadcast to all clients
        io.emit('incident:new', incident);
        io.emit('alert:new', {
          ...alert,
          crime_type: incident.crime_type,
          location_name: incident.location_name,
          latitude: incident.latitude,
          longitude: incident.longitude,
        });
        io.emit('heatmap:update', {
          point: [incident.latitude, incident.longitude, incident.severity === 'critical' ? 1.0 : incident.severity === 'high' ? 0.75 : 0.5],
        });

        // Periodically refresh analytics
        if (Math.random() < 0.3) {
          io.emit('analytics:refresh', { timestamp: new Date().toISOString() });
        }

      } catch (err) {
        console.error('Simulation error:', err);
      }
    }, randomInterval(5000, 15000)); // New incident every 5-15 seconds
  }
}

function randomInterval(min, max) {
  return Math.floor(min + Math.random() * (max - min));
}

module.exports = { setupSocketHandler };
