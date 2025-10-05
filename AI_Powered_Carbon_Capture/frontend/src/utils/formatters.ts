// Date and time formatters
export const formatDate = (date: string | Date, options?: Intl.DateTimeFormatOptions): string => {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
};

export const formatTime = (date: string | Date, options?: Intl.DateTimeFormatOptions): string => {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
};

export const formatDateTime = (date: string | Date): string => {
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatRelativeTime = (date: string | Date): string => {
  const d = new Date(date);
  const now = new Date();
  const diffInMs = now.getTime() - d.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return formatDate(d);
};

export const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

// Number formatters
export const formatNumber = (num: number, decimals: number = 2): string => {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${(value * 100).toFixed(decimals)}%`;
};

export const formatCompactNumber = (num: number): string => {
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

// Unit conversions
export const formatTemperature = (celsius: number, unit: 'C' | 'F' = 'C'): string => {
  if (unit === 'F') {
    const fahrenheit = (celsius * 9/5) + 32;
    return `${formatNumber(fahrenheit)}°F`;
  }
  return `${formatNumber(celsius)}°C`;
};

export const formatPressure = (kpa: number, unit: 'kPa' | 'psi' | 'bar' = 'kPa'): string => {
  switch (unit) {
    case 'psi':
      return `${formatNumber(kpa * 0.145038)} psi`;
    case 'bar':
      return `${formatNumber(kpa * 0.01)} bar`;
    default:
      return `${formatNumber(kpa)} kPa`;
  }
};

export const formatFlowRate = (litersPerMin: number, unit: 'L/min' | 'm³/h' | 'GPM' = 'L/min'): string => {
  switch (unit) {
    case 'm³/h':
      return `${formatNumber(litersPerMin * 0.06)} m³/h`;
    case 'GPM':
      return `${formatNumber(litersPerMin * 0.264172)} GPM`;
    default:
      return `${formatNumber(litersPerMin)} L/min`;
  }
};

export const formatEnergy = (kwh: number, unit: 'kWh' | 'MWh' | 'BTU' = 'kWh'): string => {
  switch (unit) {
    case 'MWh':
      return `${formatNumber(kwh / 1000)} MWh`;
    case 'BTU':
      return `${formatCompactNumber(kwh * 3412)} BTU`;
    default:
      return `${formatNumber(kwh)} kWh`;
  }
};

export const formatCO2 = (tons: number, unit: 'tons' | 'kg' | 'lbs' = 'tons'): string => {
  switch (unit) {
    case 'kg':
      return `${formatCompactNumber(tons * 1000)} kg`;
    case 'lbs':
      return `${formatCompactNumber(tons * 2204.62)} lbs`;
    default:
      return `${formatNumber(tons)} tons`;
  }
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Status and quality formatters
export const formatSensorQuality = (quality: 'good' | 'warning' | 'critical'): { text: string; color: string } => {
  switch (quality) {
    case 'good':
      return { text: 'Good', color: '#4caf50' };
    case 'warning':
      return { text: 'Warning', color: '#ff9800' };
    case 'critical':
      return { text: 'Critical', color: '#f44336' };
    default:
      return { text: 'Unknown', color: '#9e9e9e' };
  }
};

export const formatUnitStatus = (status: string): { text: string; color: string } => {
  switch (status) {
    case 'active':
      return { text: 'Active', color: '#4caf50' };
    case 'inactive':
      return { text: 'Inactive', color: '#9e9e9e' };
    case 'maintenance':
      return { text: 'Maintenance', color: '#ff9800' };
    case 'offline':
      return { text: 'Offline', color: '#f44336' };
    default:
      return { text: status, color: '#9e9e9e' };
  }
};

export const formatCreditStatus = (status: string): { text: string; color: string } => {
  switch (status) {
    case 'active':
      return { text: 'Active', color: '#4caf50' };
    case 'transferred':
      return { text: 'Transferred', color: '#2196f3' };
    case 'retired':
      return { text: 'Retired', color: '#9e9e9e' };
    case 'pending':
      return { text: 'Pending', color: '#ff9800' };
    case 'rejected':
      return { text: 'Rejected', color: '#f44336' };
    default:
      return { text: status, color: '#9e9e9e' };
  }
};

export const formatAlertSeverity = (severity: string): { text: string; color: string; icon: string } => {
  switch (severity) {
    case 'low':
      return { text: 'Low', color: '#4caf50', icon: 'ℹ️' };
    case 'medium':
      return { text: 'Medium', color: '#ff9800', icon: '⚠️' };
    case 'high':
      return { text: 'High', color: '#ff5722', icon: '🚨' };
    case 'critical':
      return { text: 'Critical', color: '#f44336', icon: '🔴' };
    default:
      return { text: severity, color: '#9e9e9e', icon: '❓' };
  }
};

// Address and location formatters
export const formatAddress = (location: {
  address?: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string;
}): string => {
  const parts = [];
  if (location.address) parts.push(location.address);
  parts.push(location.city);
  if (location.state) parts.push(location.state);
  parts.push(location.country);
  if (location.postalCode) parts.push(location.postalCode);
  return parts.join(', ');
};

export const formatCoordinates = (latitude: number, longitude: number, precision: number = 6): string => {
  return `${latitude.toFixed(precision)}, ${longitude.toFixed(precision)}`;
};

// ID and reference formatters
export const formatUnitId = (id: string): string => {
  return id.toUpperCase();
};

export const formatSensorId = (id: string): string => {
  return id.toUpperCase();
};

export const formatCreditId = (id: string): string => {
  // Format as XXXX-XX-XXXXXXXXXX
  return id.replace(/(.{4})(.{2})(.{10})/, '$1-$2-$3');
};

// Performance formatters
export const formatEfficiency = (efficiency: number): string => {
  return `${formatNumber(efficiency)}%`;
};

export const formatUptime = (uptime: number): string => {
  return `${formatNumber(uptime)}%`;
};

export const formatROI = (roi: number): string => {
  const color = roi >= 0 ? '#4caf50' : '#f44336';
  const sign = roi >= 0 ? '+' : '';
  return { text: `${sign}${formatNumber(roi)}%`, color };
};

// Chart data formatters
export const formatChartValue = (value: number, type: string): string => {
  switch (type) {
    case 'currency':
      return formatCurrency(value);
    case 'percentage':
      return formatPercentage(value / 100);
    case 'energy':
      return formatEnergy(value);
    case 'co2':
      return formatCO2(value);
    case 'temperature':
      return formatTemperature(value);
    case 'fileSize':
      return formatFileSize(value);
    default:
      return formatCompactNumber(value);
  }
};

export const formatChartLabel = (label: string, type: string): string => {
  switch (type) {
    case 'date':
      return formatDate(label);
    case 'time':
      return formatTime(label);
    case 'datetime':
      return formatDateTime(label);
    default:
      return label;
  }
};

// Validation formatters
export const formatValidationError = (error: string): string => {
  // Capitalize first letter and add period if missing
  const formatted = error.charAt(0).toUpperCase() + error.slice(1);
  return formatted.endsWith('.') ? formatted : formatted + '.';
};

export const formatValidationErrors = (errors: string[]): string => {
  return errors.map(formatValidationError).join(' ');
};

// Search and filter formatters
export const formatSearchQuery = (query: string): string => {
  return query.trim().toLowerCase();
};

export const formatFilterLabel = (key: string, value: any): string => {
  const labels: Record<string, string> = {
    status: 'Status',
    type: 'Type',
    efficiency: 'Efficiency',
    location: 'Location',
    dateRange: 'Date Range',
    sensorType: 'Sensor Type',
    severity: 'Severity',
    unitId: 'Unit ID',
  };

  const label = labels[key] || key.charAt(0).toUpperCase() + key.slice(1);
  return `${label}: ${value}`;
};

// Export utilities
export const formatExportFilename = (prefix: string, extension: string = 'csv'): string => {
  const timestamp = new Date().toISOString().split('T')[0];
  return `${prefix}_${timestamp}.${extension}`;
};
