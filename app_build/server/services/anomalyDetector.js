// ============================================================
// CRIMESCOPE AI — Anomaly Detection Engine
// ============================================================

/**
 * Detect anomalies in incident data using statistical methods
 */
function detectAnomalies(incidents, timeWindowHours = 24) {
  const anomalies = [];
  const now = new Date();
  const windowStart = new Date(now - timeWindowHours * 3600000);

  // Filter recent incidents
  const recent = incidents.filter(i => new Date(i.timestamp) >= windowStart);

  // Group by region
  const regionCounts = {};
  const regionBaselines = {};

  for (const incident of incidents) {
    const region = incident.region || 'Unknown';
    if (!regionCounts[region]) regionCounts[region] = 0;
    if (!regionBaselines[region]) regionBaselines[region] = [];

    if (new Date(incident.timestamp) >= windowStart) {
      regionCounts[region]++;
    }
    regionBaselines[region].push(incident);
  }

  // Calculate mean and standard deviation per region
  for (const [region, count] of Object.entries(regionCounts)) {
    const baseline = regionBaselines[region] || [];
    const totalDays = 7; // Assume 7 days of data
    const dailyAverage = baseline.length / totalDays;
    const hourlyAverage = dailyAverage / 24;
    const expectedInWindow = hourlyAverage * timeWindowHours;

    // Z-score based anomaly detection
    const stdDev = Math.sqrt(expectedInWindow); // Poisson approximation
    const zScore = stdDev > 0 ? (count - expectedInWindow) / stdDev : 0;

    if (zScore > 1.5) {
      anomalies.push({
        type: 'regional_spike',
        region,
        severity: zScore > 3 ? 'critical' : zScore > 2 ? 'high' : 'medium',
        message: `Unusual spike in ${region}: ${count} incidents in last ${timeWindowHours}h (expected ~${Math.round(expectedInWindow)})`,
        zScore: Math.round(zScore * 100) / 100,
        count,
        expected: Math.round(expectedInWindow),
        timestamp: now.toISOString(),
      });
    }
  }

  // Group by crime type and detect spikes
  const typeCounts = {};
  for (const incident of recent) {
    const type = incident.crime_type;
    if (!typeCounts[type]) typeCounts[type] = 0;
    typeCounts[type]++;
  }

  const totalRecent = recent.length;
  for (const [type, count] of Object.entries(typeCounts)) {
    const proportion = count / totalRecent;
    // Normal proportions
    const normalProportions = {
      theft: 0.25, assault: 0.12, burglary: 0.10, cybercrime: 0.10,
      accident: 0.15, violence: 0.08, fraud: 0.08, drug: 0.07, missing: 0.05,
    };
    const expected = normalProportions[type] || 0.1;

    if (proportion > expected * 2 && count >= 5) {
      anomalies.push({
        type: 'crime_type_spike',
        crimeType: type,
        severity: proportion > expected * 3 ? 'high' : 'medium',
        message: `${type.charAt(0).toUpperCase() + type.slice(1)} incidents are ${Math.round(proportion / expected)}x above normal levels`,
        proportion: Math.round(proportion * 100),
        expected: Math.round(expected * 100),
        count,
        timestamp: now.toISOString(),
      });
    }
  }

  // Time-of-day anomaly
  const hourCounts = new Array(24).fill(0);
  for (const incident of recent) {
    const hour = new Date(incident.timestamp).getHours();
    hourCounts[hour]++;
  }

  const avgHourly = totalRecent / 24;
  for (let hour = 0; hour < 24; hour++) {
    if (hourCounts[hour] > avgHourly * 3 && hourCounts[hour] >= 5) {
      const period = hour < 6 ? 'late night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
      anomalies.push({
        type: 'temporal_spike',
        hour,
        severity: 'medium',
        message: `Unusual activity spike during ${period} hours (${hour}:00): ${hourCounts[hour]} incidents vs avg ${Math.round(avgHourly)}`,
        count: hourCounts[hour],
        expected: Math.round(avgHourly),
        timestamp: now.toISOString(),
      });
    }
  }

  return anomalies.sort((a, b) => {
    const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return (sevOrder[a.severity] || 3) - (sevOrder[b.severity] || 3);
  });
}

/**
 * Calculate risk score for a region (0-100)
 */
function calculateRiskScore(regionIncidents, allIncidents) {
  if (!regionIncidents.length) return 0;

  const now = new Date();
  const last24h = regionIncidents.filter(
    i => (now - new Date(i.timestamp)) < 24 * 3600000
  );
  const last7d = regionIncidents.filter(
    i => (now - new Date(i.timestamp)) < 7 * 24 * 3600000
  );

  // Factors
  const recencyScore = Math.min(last24h.length * 8, 30); // Max 30 points
  const volumeScore = Math.min(last7d.length * 2, 25);   // Max 25 points

  const severityScore = last7d.reduce((sum, i) => {
    const weights = { critical: 10, high: 6, medium: 3, low: 1 };
    return sum + (weights[i.severity] || 1);
  }, 0);
  const normalizedSeverity = Math.min(severityScore, 25); // Max 25 points

  // Trend: increasing or decreasing
  const firstHalf = last7d.filter(
    i => (now - new Date(i.timestamp)) > 3.5 * 24 * 3600000
  ).length;
  const secondHalf = last7d.length - firstHalf;
  const trendScore = secondHalf > firstHalf ? 10 : secondHalf < firstHalf ? -5 : 0;

  // Diversity of crime types
  const types = new Set(last7d.map(i => i.crime_type));
  const diversityScore = Math.min(types.size * 2.5, 10); // Max 10 points

  const raw = recencyScore + volumeScore + normalizedSeverity + Math.max(0, trendScore) + diversityScore;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

module.exports = { detectAnomalies, calculateRiskScore };
