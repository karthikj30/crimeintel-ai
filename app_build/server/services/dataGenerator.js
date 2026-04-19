const { v4: uuidv4 } = require('uuid');

const CRIME_TYPES = ['theft', 'assault', 'burglary', 'cybercrime', 'accident', 'violence', 'fraud', 'drug', 'missing'];

const SEVERITY_LEVELS = ['critical', 'high', 'medium', 'low'];

const LOCATIONS = [
  { name: 'Connaught Place', region: 'Central Delhi', lat: 28.6328, lng: 77.2197 },
  { name: 'Sarojini Nagar', region: 'South Delhi', lat: 28.5667, lng: 77.2083 },
  { name: 'Karol Bagh', region: 'Central Delhi', lat: 28.6500, lng: 77.1833 },
  { name: 'Lajpat Nagar', region: 'South Delhi', lat: 28.5667, lng: 77.2333 },
  { name: 'Dwarka', region: 'West Delhi', lat: 28.5921, lng: 77.0465 },
  { name: 'Rohini', region: 'North Delhi', lat: 28.7408, lng: 77.3249 },
  { name: 'Vasant Kunj', region: 'South Delhi', lat: 28.5167, lng: 77.1500 },
  { name: 'Mayur Vihar', region: 'East Delhi', lat: 28.5378, lng: 77.3153 },
  { name: 'Paharganj', region: 'Central Delhi', lat: 28.6419, lng: 77.2194 },
  { name: 'Chandni Chowk', region: 'North Delhi', lat: 28.6500, lng: 77.2333 },
  { name: 'Nehru Place', region: 'South Delhi', lat: 28.5500, lng: 77.2500 },
  { name: 'Janakpuri', region: 'West Delhi', lat: 28.6167, lng: 77.0833 },
  { name: 'Pitampura', region: 'North Delhi', lat: 28.6833, lng: 77.3000 },
  { name: 'Okhla', region: 'South East Delhi', lat: 28.5667, lng: 77.3000 },
  { name: 'Shahdara', region: 'East Delhi', lat: 28.6667, lng: 77.3167 },
];

const SOURCES = ['news', 'twitter', 'government', 'web'];

const INCIDENT_TEMPLATES = {
  theft: [
    'Mobile phone snatching near {location}',
    'Bag snatching incident at {location}',
    'Chain snatching in broad daylight at {location}',
    'Pickpocket incident reported at {location}',
    'Two-wheeler theft from {location}',
    'Burglary at residential complex in {location}',
    'Cargo theft from parked truck near {location}',
  ],
  assault: [
    'Mob attack near {location}',
    'Physical assault reported at {location}',
    'Group clash near {location}',
    'Assault victim found near {location}',
    'Road rage incident at {location}',
  ],
  burglary: [
    'House break-in at {location}',
    'Burglary at shop in {location}',
    'Office break-in near {location}',
    'Warehouse robbery at {location}',
    'Break-in at residential society in {location}',
  ],
  cybercrime: [
    'Online fraud reported in {location}',
    'Cybercrime complaint from {location}',
    'UPI fraud in {location}',
    'Identity theft case in {location}',
    'Phishing attack targeting residents of {location}',
  ],
  accident: [
    'Road accident near {location}',
    'Bike accident at {location}',
    'Hit and run incident at {location}',
    'Multiple vehicle collision at {location}',
    'Pedestrian accident near {location}',
  ],
  violence: [
    'Gang war near {location}',
    'Firing incident at {location}',
    'Violent protest at {location}',
    'Stone pelting near {location}',
    'Arson attack at {location}',
  ],
  fraud: [
    'Investment fraud in {location}',
    'Loan fraud case in {location}',
    'Insurance fraud near {location}',
    'Chit fund scam in {location}',
    'Bank fraud at {location}',
  ],
  drug: [
    'Drug peddling near {location}',
    'Drug bust at {location}',
    'Narcotics seized near {location}',
    'Drug raid at {location}',
    'Contraband seizure at {location}',
  ],
  missing: [
    'Missing person from {location}',
    'Child missing near {location}',
    'Abduction incident at {location}',
    'Missing elderly person from {location}',
    'Kidnapping complaint from {location}',
  ],
};

const DESCRIPTIONS = {
  theft: 'Victim reported theft of personal belongings. Incident under investigation.',
  assault: 'Victim sustained injuries and was taken to hospital. Police have registered a case.',
  burglary: 'Unidentified accused entered premises and fled with valuables. Investigation underway.',
  cybercrime: 'Investigation into online fraud and data breach is ongoing.',
  accident: 'Emergency services responded. Traffic was affected temporarily.',
  violence: 'Police have arrived at the scene. Further investigation is in progress.',
  fraud: 'Case registered. Investigation into financial irregularities underway.',
  drug: 'Seized substances sent for forensic analysis. Accused in police custody.',
  missing: 'Search operations initiated. Public assistance requested.',
};

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSeverity() {
  const weights = { critical: 0.08, high: 0.2, medium: 0.45, low: 0.27 };
  const rand = Math.random();
  let cumulative = 0;
  for (const [severity, weight] of Object.entries(weights)) {
    cumulative += weight;
    if (rand <= cumulative) return severity;
  }
  return 'medium';
}

function generateIncident() {
  const crimeType = randomElement(CRIME_TYPES);
  const location = randomElement(LOCATIONS);
  const severity = randomSeverity();
  const source = randomElement(SOURCES);
  const template = randomElement(INCIDENT_TEMPLATES[crimeType]);
  
  const now = new Date();
  const hoursAgo = Math.floor(Math.random() * 168);
  const timestamp = new Date(now - hoursAgo * 3600000);

  return {
    id: uuidv4(),
    title: template.replace('{location}', location.name),
    description: DESCRIPTIONS[crimeType],
    crime_type: crimeType,
    severity,
    latitude: location.lat + (Math.random() - 0.5) * 0.02,
    longitude: location.lng + (Math.random() - 0.5) * 0.02,
    location_name: location.name,
    region: location.region,
    timestamp: timestamp.toISOString(),
    source,
    source_url: `https://example.com/news/${uuidv4()}`,
    confidence: 0.7 + Math.random() * 0.25,
    status: 'active',
    nlp_entities: JSON.stringify({ detected_location: location.name }),
    merged_with: null,
  };
}

function generateSeedData(count = 500) {
  const incidents = [];
  for (let i = 0; i < count; i++) {
    incidents.push(generateIncident());
  }
  return incidents;
}

function generateRealtimeIncident() {
  return generateIncident();
}

module.exports = { generateSeedData, generateRealtimeIncident };