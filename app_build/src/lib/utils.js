// ============================================================
// CRIMESCOPE AI — Utility Functions
// ============================================================

export function formatTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

export function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export function getSeverityColor(severity) {
  const colors = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
  };
  return colors[severity] || '#64748b';
}

export function getCrimeColor(type) {
  const colors = {
    theft: '#f59e0b',
    assault: '#ef4444',
    burglary: '#8b5cf6',
    cybercrime: '#06b6d4',
    accident: '#f97316',
    violence: '#dc2626',
    fraud: '#ec4899',
    drug: '#84cc16',
    missing: '#6366f1',
  };
  return colors[type] || '#64748b';
}

export function getConfidenceLabel(confidence) {
  if (confidence >= 0.9) return 'Very High';
  if (confidence >= 0.75) return 'High';
  if (confidence >= 0.6) return 'Medium';
  if (confidence >= 0.4) return 'Low';
  return 'Very Low';
}

export function getConfidenceColor(confidence) {
  if (confidence >= 0.9) return '#22c55e';
  if (confidence >= 0.75) return '#eab308';
  if (confidence >= 0.6) return '#f97316';
  return '#ef4444';
}

export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

export function truncate(str, maxLen = 80) {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '…';
}

export function generateGradientStyle(color, opacity = 0.15) {
  return `linear-gradient(135deg, ${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}, transparent)`;
}

export function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
