// ============================================================
// CRIMESCOPE AI — NLP Crime Classifier
// ============================================================

const crimePatterns = {
  theft: {
    keywords: ['theft', 'stolen', 'robbed', 'robbery', 'snatch', 'pickpocket', 'shoplifting',
      'larceny', 'burgle', 'mugged', 'mugging', 'looted', 'pilferage', 'heist', 'steal',
      'stole', 'snatched', 'bag snatching', 'mobile snatching', 'chain snatching'],
    weight: 1.0,
  },
  assault: {
    keywords: ['assault', 'attacked', 'beaten', 'punched', 'stabbed', 'stabbing',
      'fight', 'brawl', 'hit', 'slapped', 'injured', 'battery', 'grievous hurt',
      'physical assault', 'mob attack', 'lynching', 'mob violence'],
    weight: 1.0,
  },
  burglary: {
    keywords: ['burglary', 'break-in', 'breaking', 'entered', 'house robbery', 'home invasion',
      'trespassing', 'forced entry', 'ransacked', 'locker broken', 'safe cracked',
      'shop broken', 'office burglary'],
    weight: 1.0,
  },
  cybercrime: {
    keywords: ['cybercrime', 'hacking', 'hacked', 'phishing', 'ransomware', 'malware',
      'data breach', 'identity theft', 'online fraud', 'cyber attack', 'crypto scam',
      'dark web', 'digital fraud', 'upi fraud', 'net banking fraud', 'olx fraud'],
    weight: 1.0,
  },
  accident: {
    keywords: ['accident', 'crash', 'collision', 'hit and run', 'overturned', 'derailed',
      'pile-up', 'road accident', 'vehicle accident', 'bike accident', 'truck accident',
      'car crash', 'bus accident', 'fatal accident', 'mishap'],
    weight: 0.9,
  },
  violence: {
    keywords: ['murder', 'killed', 'homicide', 'shooting', 'shot dead', 'gun violence',
      'riot', 'arson', 'explosion', 'bomb', 'terrorism', 'terror attack', 'blast',
      'stone pelting', 'violent protest', 'gang war', 'encounter'],
    weight: 1.0,
  },
  fraud: {
    keywords: ['fraud', 'scam', 'cheated', 'forgery', 'counterfeit', 'embezzlement',
      'ponzi', 'money laundering', 'tax evasion', 'insurance fraud', 'loan fraud',
      'bank fraud', 'chit fund scam', 'hawala'],
    weight: 0.95,
  },
  drug: {
    keywords: ['drug', 'narcotics', 'cocaine', 'heroin', 'marijuana', 'cannabis', 'ganja',
      'meth', 'amphetamine', 'drug bust', 'drug peddler', 'smuggling', 'contraband',
      'drug racket', 'drug dealer', 'seized drugs', 'opium'],
    weight: 1.0,
  },
  missing: {
    keywords: ['missing', 'disappeared', 'abducted', 'kidnapped', 'kidnapping', 'abduction',
      'missing person', 'child missing', 'woman missing', 'hostage', 'human trafficking',
      'trafficking', 'ransom'],
    weight: 1.0,
  },
};

const severityIndicators = {
  critical: ['killed', 'murder', 'homicide', 'dead', 'fatal', 'terrorism', 'bomb', 'blast',
    'explosion', 'shot dead', 'massacre', 'multiple casualties', 'died', 'death'],
  high: ['stabbed', 'shooting', 'gun', 'riot', 'arson', 'gang', 'kidnapped', 'hostage',
    'critical condition', 'grievous', 'serious injury', 'major'],
  medium: ['robbed', 'stolen', 'assault', 'injured', 'accident', 'crash', 'fraud',
    'burglary', 'scam', 'drug', 'arrested'],
  low: ['attempted', 'minor', 'complaint', 'reported', 'suspected', 'petty',
    'shoplifting', 'pickpocket', 'warning'],
};

function classifyCrimeType(text) {
  const lowerText = text.toLowerCase();
  let bestMatch = null;
  let bestScore = 0;

  for (const [type, config] of Object.entries(crimePatterns)) {
    let score = 0;
    let matchCount = 0;

    for (const keyword of config.keywords) {
      if (lowerText.includes(keyword)) {
        score += config.weight;
        matchCount++;
      }
    }

    if (matchCount > 0) {
      // Bonus for multiple keyword matches
      score *= (1 + (matchCount - 1) * 0.2);
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = type;
    }
  }

  return {
    type: bestMatch || 'theft', // Default fallback
    confidence: Math.min(0.99, bestMatch ? 0.6 + (bestScore * 0.1) : 0.4),
  };
}

function classifySeverity(text) {
  const lowerText = text.toLowerCase();

  for (const [severity, keywords] of Object.entries(severityIndicators)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return severity;
      }
    }
  }

  return 'medium'; // Default
}

function extractEntities(text) {
  const entities = {
    locations: [],
    persons: [],
    organizations: [],
    dates: [],
  };

  // Location patterns (Indian cities, areas)
  const locationPatterns = [
    /(?:in|at|near|from|around)\s+([A-Z][a-zA-Z\s]+(?:Nagar|Colony|Road|Marg|Chowk|Market|Park|Garden|Circle|Gate|Vihar|Enclave|Extension|Phase|Sector|Block|Street|Lane|Gali|Bazaar|Area|Town|City))/g,
    /(?:in|at|near|from)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2})/g,
  ];

  for (const pattern of locationPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const loc = match[1].trim();
      if (loc.length > 2 && loc.length < 50 && !entities.locations.includes(loc)) {
        entities.locations.push(loc);
      }
    }
  }

  return entities;
}

function analyzeText(text) {
  const { type, confidence } = classifyCrimeType(text);
  const severity = classifySeverity(text);
  const entities = extractEntities(text);

  return {
    crimeType: type,
    severity,
    confidence: Math.round(confidence * 100) / 100,
    entities,
    processedAt: new Date().toISOString(),
  };
}

module.exports = { analyzeText, classifyCrimeType, classifySeverity, extractEntities };
