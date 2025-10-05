// Core Types for Carbon Capture Network

export interface CarbonCaptureUnit {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
    city: string;
    country: string;
  };
  type: 'residential' | 'commercial' | 'industrial' | 'utility';
  status: 'active' | 'maintenance' | 'offline' | 'error';
  capacity: {
    co2PerDay: number; // kg/day
    energyConsumption: number; // kWh/day
    efficiency: number; // percentage
  };
  sensors: SensorData[];
  aiOptimization: AIOptimizationData;
  carbonCredits: CarbonCreditData;
  lastMaintenance: Date;
  installationDate: Date;
  owner: User;
  metadata: Record<string, any>;
}

export interface SensorData {
  id: string;
  unitId: string;
  type: 'temperature' | 'pressure' | 'flow' | 'co2' | 'energy' | 'humidity' | 'air_quality';
  value: number;
  unit: string;
  timestamp: Date;
  quality: 'good' | 'warning' | 'critical';
  metadata?: Record<string, any>;
}

export interface AIOptimizationData {
  unitId: string;
  currentEfficiency: number;
  predictedEfficiency: number;
  optimizationSuggestions: OptimizationSuggestion[];
  predictiveMaintenance: PredictiveMaintenanceAlert[];
  energyOptimization: EnergyOptimizationData;
  lastOptimization: Date;
  aiModelVersion: string;
}

export interface OptimizationSuggestion {
  id: string;
  type: 'efficiency' | 'maintenance' | 'energy' | 'configuration';
  title: string;
  description: string;
  impact: {
    co2Increase: number; // kg/day
    energySavings: number; // kWh/day
    costSavings: number; // $/day
  };
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'implemented' | 'rejected';
  createdAt: Date;
  implementedAt?: Date;
}

export interface PredictiveMaintenanceAlert {
  id: string;
  unitId: string;
  component: string;
  alertType: 'warning' | 'critical' | 'info';
  message: string;
  probability: number; // 0-1
  predictedFailureDate: Date;
  recommendedAction: string;
  status: 'active' | 'resolved' | 'dismissed';
  createdAt: Date;
  resolvedAt?: Date;
}

export interface EnergyOptimizationData {
  renewableEnergyUsage: number; // percentage
  gridEnergyUsage: number; // percentage
  peakDemandReduction: number; // kW
  costOptimization: number; // $/day
  carbonFootprint: number; // kg CO2/day
  recommendations: EnergyRecommendation[];
}

export interface EnergyRecommendation {
  id: string;
  type: 'solar' | 'wind' | 'battery' | 'demand_response';
  title: string;
  description: string;
  savings: {
    energy: number; // kWh/day
    cost: number; // $/day
    emissions: number; // kg CO2/day
  };
  paybackPeriod: number; // months
  feasibility: 'high' | 'medium' | 'low';
}

export interface CarbonCreditData {
  totalCredits: number; // tons CO2
  availableCredits: number; // tons CO2
  retiredCredits: number; // tons CO2
  creditPrice: number; // $/ton
  blockchainTxHash?: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  lastTransaction: Date;
  marketplaceListings: CarbonCreditListing[];
}

export interface CarbonCreditListing {
  id: string;
  amount: number; // tons CO2
  price: number; // $/ton
  seller: string;
  buyer?: string;
  status: 'listed' | 'sold' | 'cancelled';
  createdAt: Date;
  soldAt?: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator' | 'viewer' | 'investor';
  organization?: string;
  permissions: Permission[];
  profile: UserProfile;
  createdAt: Date;
  lastLogin: Date;
}

export interface UserProfile {
  avatar?: string;
  bio?: string;
  location?: string;
  expertise: string[];
  certifications: Certification[];
  socialLinks: SocialLinks;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  issueDate: Date;
  expiryDate?: Date;
  credentialId: string;
  verificationUrl?: string;
}

export interface SocialLinks {
  linkedin?: string;
  twitter?: string;
  website?: string;
  github?: string;
}

export type Permission =
  | 'read:units'
  | 'write:units'
  | 'delete:units'
  | 'read:sensors'
  | 'write:sensors'
  | 'read:ai'
  | 'write:ai'
  | 'read:credits'
  | 'write:credits'
  | 'trade:credits'
  | 'admin:users'
  | 'admin:system';

export interface NetworkStatistics {
  totalUnits: number;
  activeUnits: number;
  totalCapacity: number; // tons CO2/day
  currentEfficiency: number; // percentage
  totalCarbonCaptured: number; // tons
  energyConsumption: number; // MWh
  carbonCreditsIssued: number; // tons
  revenueGenerated: number; // $
  geographicDistribution: GeographicData[];
  performanceMetrics: PerformanceMetrics;
}

export interface GeographicData {
  country: string;
  units: number;
  capacity: number; // tons CO2/day
  efficiency: number; // percentage
  carbonCaptured: number; // tons
}

export interface PerformanceMetrics {
  averageUptime: number; // percentage
  averageEfficiency: number; // percentage
  maintenanceFrequency: number; // days
  energyIntensity: number; // kWh/ton CO2
  costPerTon: number; // $/ton CO2
  roi: number; // percentage
}

export interface Alert {
  id: string;
  type: 'system' | 'maintenance' | 'performance' | 'security';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  unitId?: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  createdAt: Date;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

export interface DashboardData {
  summary: NetworkStatistics;
  alerts: Alert[];
  recentActivity: ActivityLog[];
  performanceTrends: PerformanceTrend[];
  carbonCreditMarket: MarketData;
  environmentalImpact: EnvironmentalImpact;
}

export interface ActivityLog {
  id: string;
  type: 'unit_status' | 'maintenance' | 'optimization' | 'credit_transaction' | 'alert';
  title: string;
  description: string;
  unitId?: string;
  userId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface PerformanceTrend {
  date: Date;
  efficiency: number;
  energyConsumption: number;
  carbonCaptured: number;
  cost: number;
  uptime: number;
}

export interface MarketData {
  currentPrice: number; // $/ton
  priceChange24h: number; // percentage
  volume24h: number; // tons
  marketCap: number; // $
  recentTransactions: CarbonCreditTransaction[];
}

export interface CarbonCreditTransaction {
  id: string;
  buyer: string;
  seller: string;
  amount: number; // tons
  price: number; // $/ton
  total: number; // $
  timestamp: Date;
  txHash: string;
}

export interface EnvironmentalImpact {
  totalCO2Captured: number; // tons
  equivalentCarsRemoved: number;
  equivalentTreesPlanted: number;
  carbonFootprintReduction: number; // percentage
  renewableEnergyUsage: number; // percentage
  sustainabilityMetrics: SustainabilityMetric[];
}

export interface SustainabilityMetric {
  name: string;
  value: number;
  unit: string;
  target?: number;
  trend: 'improving' | 'stable' | 'declining';
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  timestamp: Date;
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: 'sensor_update' | 'alert' | 'optimization' | 'credit_transaction' | 'system_status';
  payload: any;
  timestamp: Date;
}

// Configuration Types
export interface AppConfig {
  api: {
    baseUrl: string;
    timeout: number;
    retries: number;
  };
  websocket: {
    url: string;
    reconnectInterval: number;
    maxReconnects: number;
  };
  blockchain: {
    rpcUrl: string;
    chainId: number;
    contracts: {
      carbonCredit: string;
      marketplace: string;
    };
  };
  features: {
    realTimeUpdates: boolean;
    aiOptimization: boolean;
    predictiveMaintenance: boolean;
    carbonTrading: boolean;
  };
}

// Form Types
export interface LoginForm {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  organization?: string;
  role: User['role'];
}

export interface UnitForm {
  name: string;
  type: CarbonCaptureUnit['type'];
  location: CarbonCaptureUnit['location'];
  capacity: CarbonCaptureUnit['capacity'];
  ownerId: string;
}

export interface OptimizationConfig {
  unitId: string;
  parameters: Record<string, any>;
  constraints: Record<string, any>;
  objectives: string[];
}

// Chart Data Types
export interface ChartDataPoint {
  x: string | number | Date;
  y: number;
  label?: string;
  color?: string;
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  unit?: string;
  metadata?: Record<string, any>;
}

export interface ComparisonData {
  category: string;
  current: number;
  target: number;
  benchmark?: number;
  trend?: 'up' | 'down' | 'stable';
}

// Export all types
export type {
  CarbonCaptureUnit as Unit,
  SensorData as Sensor,
  AIOptimizationData as AIData,
  CarbonCreditData as CreditData,
  NetworkStatistics as Stats,
  DashboardData as Dashboard,
  ApiResponse as Response,
  WebSocketMessage as WSMessage,
  AppConfig as Config,
};
