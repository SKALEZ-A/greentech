// API Constants
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL ||
  (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/^http/, 'ws');

// Authentication Constants
export const TOKEN_KEY = 'carbon_capture_token';
export const USER_KEY = 'carbon_capture_user';
export const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes

// Pagination Constants
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// Time Constants
export const REFRESH_INTERVALS = {
  SENSOR_DATA: 30000, // 30 seconds
  DASHBOARD: 60000, // 1 minute
  REPORTS: 300000, // 5 minutes
  MARKET_DATA: 120000, // 2 minutes
};

// Sensor Types and Units
export const SENSOR_TYPES = {
  TEMPERATURE: 'temperature',
  PRESSURE: 'pressure',
  FLOW_RATE: 'flow_rate',
  CO2_CONCENTRATION: 'co2_concentration',
  HUMIDITY: 'humidity',
  AIR_QUALITY: 'air_quality',
  ENERGY_CONSUMPTION: 'energy_consumption',
  VIBRATION: 'vibration',
  NOISE_LEVEL: 'noise_level',
  PARTICULATE_MATTER: 'particulate_matter',
} as const;

export const SENSOR_UNITS = {
  [SENSOR_TYPES.TEMPERATURE]: '°C',
  [SENSOR_TYPES.PRESSURE]: 'kPa',
  [SENSOR_TYPES.FLOW_RATE]: 'L/min',
  [SENSOR_TYPES.CO2_CONCENTRATION]: 'ppm',
  [SENSOR_TYPES.HUMIDITY]: '%',
  [SENSOR_TYPES.AIR_QUALITY]: 'AQI',
  [SENSOR_TYPES.ENERGY_CONSUMPTION]: 'kWh',
  [SENSOR_TYPES.VIBRATION]: 'mm/s',
  [SENSOR_TYPES.NOISE_LEVEL]: 'dB',
  [SENSOR_TYPES.PARTICULATE_MATTER]: 'μg/m³',
} as const;

export const SENSOR_RANGES = {
  [SENSOR_TYPES.TEMPERATURE]: { min: -10, max: 60, criticalMin: 0, criticalMax: 50 },
  [SENSOR_TYPES.PRESSURE]: { min: 30, max: 80, criticalMin: 40, criticalMax: 70 },
  [SENSOR_TYPES.FLOW_RATE]: { min: 500, max: 2000, criticalMin: 700, criticalMax: 1800 },
  [SENSOR_TYPES.CO2_CONCENTRATION]: { min: 300, max: 1000, criticalMin: 350, criticalMax: 800 },
  [SENSOR_TYPES.HUMIDITY]: { min: 0, max: 100, criticalMin: 20, criticalMax: 80 },
  [SENSOR_TYPES.AIR_QUALITY]: { min: 0, max: 500, criticalMin: 0, criticalMax: 150 },
  [SENSOR_TYPES.ENERGY_CONSUMPTION]: { min: 0, max: 5000, criticalMin: 0, criticalMax: 4000 },
  [SENSOR_TYPES.VIBRATION]: { min: 0, max: 10, criticalMin: 0, criticalMax: 3 },
  [SENSOR_TYPES.NOISE_LEVEL]: { min: 0, max: 120, criticalMin: 0, criticalMax: 85 },
  [SENSOR_TYPES.PARTICULATE_MATTER]: { min: 0, max: 1000, criticalMin: 0, criticalMax: 150 },
} as const;

// Unit Types
export const UNIT_TYPES = {
  RESIDENTIAL: 'residential',
  COMMERCIAL: 'commercial',
  INDUSTRIAL: 'industrial',
  UTILITY: 'utility',
} as const;

export const UNIT_TYPE_LABELS = {
  [UNIT_TYPES.RESIDENTIAL]: 'Residential',
  [UNIT_TYPES.COMMERCIAL]: 'Commercial',
  [UNIT_TYPES.INDUSTRIAL]: 'Industrial',
  [UNIT_TYPES.UTILITY]: 'Utility',
} as const;

// Status Constants
export const UNIT_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  MAINTENANCE: 'maintenance',
  OFFLINE: 'offline',
} as const;

export const UNIT_STATUS_LABELS = {
  [UNIT_STATUSES.ACTIVE]: 'Active',
  [UNIT_STATUSES.INACTIVE]: 'Inactive',
  [UNIT_STATUSES.MAINTENANCE]: 'Maintenance',
  [UNIT_STATUSES.OFFLINE]: 'Offline',
} as const;

export const SENSOR_QUALITIES = {
  GOOD: 'good',
  WARNING: 'warning',
  CRITICAL: 'critical',
} as const;

export const SENSOR_QUALITY_LABELS = {
  [SENSOR_QUALITIES.GOOD]: 'Good',
  [SENSOR_QUALITIES.WARNING]: 'Warning',
  [SENSOR_QUALITIES.CRITICAL]: 'Critical',
} as const;

export const CREDIT_STATUSES = {
  ACTIVE: 'active',
  TRANSFERRED: 'transferred',
  RETIRED: 'retired',
  PENDING: 'pending',
  REJECTED: 'rejected',
} as const;

export const CREDIT_STATUS_LABELS = {
  [CREDIT_STATUSES.ACTIVE]: 'Active',
  [CREDIT_STATUSES.TRANSFERRED]: 'Transferred',
  [CREDIT_STATUSES.RETIRED]: 'Retired',
  [CREDIT_STATUSES.PENDING]: 'Pending',
  [CREDIT_STATUSES.REJECTED]: 'Rejected',
} as const;

// Alert Constants
export const ALERT_SEVERITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export const ALERT_SEVERITY_LABELS = {
  [ALERT_SEVERITIES.LOW]: 'Low',
  [ALERT_SEVERITIES.MEDIUM]: 'Medium',
  [ALERT_SEVERITIES.HIGH]: 'High',
  [ALERT_SEVERITIES.CRITICAL]: 'Critical',
} as const;

export const ALERT_TYPES = {
  SENSOR: 'sensor',
  MAINTENANCE: 'maintenance',
  SYSTEM: 'system',
  PERFORMANCE: 'performance',
} as const;

// AI Optimization Constants
export const OPTIMIZATION_TYPES = {
  EFFICIENCY: 'efficiency',
  ENERGY: 'energy',
  MAINTENANCE: 'maintenance',
} as const;

export const OPTIMIZATION_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

// Carbon Credit Constants
export const CREDIT_METHODOLOGIES = {
  BASELINE: 'baseline',
  ENHANCED: 'enhanced',
  INNOVATIVE: 'innovative',
} as const;

export const CREDIT_METHODOLOGY_LABELS = {
  [CREDIT_METHODOLOGIES.BASELINE]: 'Baseline',
  [CREDIT_METHODOLOGIES.ENHANCED]: 'Enhanced',
  [CREDIT_METHODOLOGY_LABELS.INNOVATIVE]: 'Innovative',
} as const;

export const CREDIT_UNITS = {
  TCO2: 'tCO2',
  TCO2E: 'tCO2e',
} as const;

// Chart Constants
export const CHART_COLORS = {
  PRIMARY: '#1976d2',
  SECONDARY: '#dc004e',
  SUCCESS: '#388e3c',
  WARNING: '#f57c00',
  ERROR: '#d32f2f',
  INFO: '#0288d1',
  EFFICIENCY: '#4caf50',
  ENERGY: '#ff9800',
  CARBON: '#9c27b0',
  COST: '#607d8b',
} as const;

export const CHART_THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
} as const;

// Form Constants
export const FORM_VALIDATION = {
  REQUIRED: 'This field is required',
  EMAIL: 'Please enter a valid email address',
  PASSWORD_MIN: 'Password must be at least 8 characters',
  PASSWORD_STRENGTH: 'Password must contain uppercase, lowercase, number, and special character',
  PHONE: 'Please enter a valid phone number',
  UNIT_ID: 'Unit ID must be in format CC-XXX',
  COORDINATES: 'Please enter valid latitude and longitude',
} as const;

// User Role Constants
export const USER_ROLES = {
  USER: 'user',
  OPERATOR: 'operator',
  ADMIN: 'admin',
} as const;

export const USER_ROLE_LABELS = {
  [USER_ROLES.USER]: 'User',
  [USER_ROLES.OPERATOR]: 'Operator',
  [USER_ROLES.ADMIN]: 'Administrator',
} as const;

// Permission Constants
export const PERMISSIONS = {
  // Unit permissions
  UNIT_READ: 'unit:read',
  UNIT_CREATE: 'unit:create',
  UNIT_UPDATE: 'unit:update',
  UNIT_DELETE: 'unit:delete',

  // Sensor permissions
  SENSOR_READ: 'sensor:read',
  SENSOR_CREATE: 'sensor:create',
  SENSOR_UPDATE: 'sensor:update',
  SENSOR_DELETE: 'sensor:delete',

  // AI permissions
  AI_OPTIMIZE: 'ai:optimize',
  AI_TRAIN: 'ai:train',
  AI_MODEL_MANAGE: 'ai:model:manage',

  // Credit permissions
  CREDIT_READ: 'credit:read',
  CREDIT_CREATE: 'credit:create',
  CREDIT_TRANSFER: 'credit:transfer',
  CREDIT_RETIRE: 'credit:retire',
  CREDIT_TRADE: 'credit:trade',

  // Report permissions
  REPORT_READ: 'report:read',
  REPORT_CREATE: 'report:create',
  REPORT_DELETE: 'report:delete',

  // Admin permissions
  ADMIN_USERS: 'admin:users',
  ADMIN_SYSTEM: 'admin:system',
  ADMIN_REPORTS: 'admin:reports',
} as const;

// Route Constants
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  UNITS: '/dashboard/units',
  UNIT_DETAIL: (id: string) => `/dashboard/units/${id}`,
  SENSORS: '/dashboard/sensors',
  SENSOR_DETAIL: (id: string) => `/dashboard/sensors/${id}`,
  AI_OPTIMIZATION: '/dashboard/ai',
  CARBON_CREDITS: '/dashboard/credits',
  MARKETPLACE: '/dashboard/marketplace',
  REPORTS: '/dashboard/reports',
  PROFILE: '/dashboard/profile',
  ADMIN: '/admin',
  ADMIN_USERS: '/admin/users',
  ADMIN_SYSTEM: '/admin/system',
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  TOKEN: TOKEN_KEY,
  USER: USER_KEY,
  THEME: 'carbon_capture_theme',
  LANGUAGE: 'carbon_capture_language',
  DASHBOARD_LAYOUT: 'carbon_capture_dashboard_layout',
  NOTIFICATIONS_SETTINGS: 'carbon_capture_notifications',
  CHART_PREFERENCES: 'carbon_capture_chart_preferences',
} as const;

// WebSocket Event Types
export const WS_EVENTS = {
  SENSOR_DATA: 'sensor-data',
  AI_OPTIMIZATION: 'ai-optimization',
  SYSTEM_ALERT: 'system-alert',
  CREDIT_UPDATE: 'credit-update',
  UNIT_STATUS: 'unit-status',
  MAINTENANCE_ALERT: 'maintenance-alert',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error - please check your connection',
  UNAUTHORIZED: 'You are not authorized to perform this action',
  NOT_FOUND: 'The requested resource was not found',
  SERVER_ERROR: 'Server error - please try again later',
  VALIDATION_ERROR: 'Please check your input and try again',
  RATE_LIMITED: 'Too many requests - please wait and try again',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  UNIT_CREATED: 'Carbon capture unit created successfully',
  UNIT_UPDATED: 'Carbon capture unit updated successfully',
  UNIT_DELETED: 'Carbon capture unit deleted successfully',
  SENSOR_CREATED: 'Sensor created successfully',
  SENSOR_UPDATED: 'Sensor updated successfully',
  SENSOR_DELETED: 'Sensor deleted successfully',
  CREDIT_MINTED: 'Carbon credit minted successfully',
  CREDIT_TRANSFERRED: 'Carbon credit transferred successfully',
  CREDIT_RETIRED: 'Carbon credit retired successfully',
  OPTIMIZATION_COMPLETED: 'AI optimization completed successfully',
  REPORT_GENERATED: 'Report generated successfully',
} as const;

// Loading Messages
export const LOADING_MESSAGES = {
  LOADING: 'Loading...',
  SAVING: 'Saving...',
  PROCESSING: 'Processing...',
  OPTIMIZING: 'Optimizing...',
  GENERATING: 'Generating...',
  CALCULATING: 'Calculating...',
} as const;

// File Upload Constants
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
  DOCUMENT_TYPES: ['application/pdf'],
  SPREADSHEET_TYPES: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
} as const;

// Export Constants
export const EXPORT_FORMATS = {
  CSV: 'csv',
  PDF: 'pdf',
  JSON: 'json',
  XLSX: 'xlsx',
} as const;

export const EXPORT_FORMAT_LABELS = {
  [EXPORT_FORMATS.CSV]: 'CSV',
  [EXPORT_FORMATS.PDF]: 'PDF',
  [EXPORT_FORMATS.JSON]: 'JSON',
  [EXPORT_FORMATS.XLSX]: 'Excel',
} as const;

// Date Range Constants
export const DATE_RANGES = {
  TODAY: 'today',
  YESTERDAY: 'yesterday',
  LAST_7_DAYS: 'last_7_days',
  LAST_30_DAYS: 'last_30_days',
  LAST_90_DAYS: 'last_90_days',
  THIS_MONTH: 'this_month',
  LAST_MONTH: 'last_month',
  THIS_QUARTER: 'this_quarter',
  LAST_QUARTER: 'last_quarter',
  THIS_YEAR: 'this_year',
  LAST_YEAR: 'last_year',
  CUSTOM: 'custom',
} as const;

export const DATE_RANGE_LABELS = {
  [DATE_RANGES.TODAY]: 'Today',
  [DATE_RANGES.YESTERDAY]: 'Yesterday',
  [DATE_RANGES.LAST_7_DAYS]: 'Last 7 Days',
  [DATE_RANGES.LAST_30_DAYS]: 'Last 30 Days',
  [DATE_RANGES.LAST_90_DAYS]: 'Last 90 Days',
  [DATE_RANGES.THIS_MONTH]: 'This Month',
  [DATE_RANGES.LAST_MONTH]: 'Last Month',
  [DATE_RANGES.THIS_QUARTER]: 'This Quarter',
  [DATE_RANGES.LAST_QUARTER]: 'Last Quarter',
  [DATE_RANGES.THIS_YEAR]: 'This Year',
  [DATE_RANGES.LAST_YEAR]: 'Last Year',
  [DATE_RANGES.CUSTOM]: 'Custom Range',
} as const;
