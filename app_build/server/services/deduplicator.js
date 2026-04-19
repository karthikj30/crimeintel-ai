// ============================================================
// CRIMESCOPE AI — Deduplication & Intelligence Fusion
// ============================================================

/**
 * Calculate similarity between two incident texts
 */
function textSimilarity(text1, text2) {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size; // Jaccard similarity
}

/**
 * Calculate geographic distance between two points (km)
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if two incidents might be duplicates
 */
function areDuplicates(incident1, incident2) {
  // Must be same crime type
  if (incident1.crime_type !== incident2.crime_type) return false;

  // Must be within 2km of each other
  const distance = haversineDistance(
    incident1.latitude, incident1.longitude,
    incident2.latitude, incident2.longitude
  );
  if (distance > 2) return false;

  // Must be within 6 hours of each other
  const timeDiff = Math.abs(
    new Date(incident1.timestamp) - new Date(incident2.timestamp)
  );
  if (timeDiff > 6 * 3600000) return false;

  // Must have text similarity > 0.3
  const similarity = textSimilarity(
    incident1.title || '',
    incident2.title || ''
  );
  if (similarity < 0.3) return false;

  return true;
}

/**
 * Find potential duplicates for a new incident
 */
function findDuplicates(newIncident, existingIncidents) {
  const duplicates = [];

  for (const existing of existingIncidents) {
    if (existing.id === newIncident.id) continue;
    if (existing.merged_with) continue;

    if (areDuplicates(newIncident, existing)) {
      duplicates.push({
        id: existing.id,
        similarity: textSimilarity(newIncident.title, existing.title),
        distance: haversineDistance(
          newIncident.latitude, newIncident.longitude,
          existing.latitude, existing.longitude
        ),
      });
    }
  }

  return duplicates;
}

module.exports = { textSimilarity, haversineDistance, areDuplicates, findDuplicates };
