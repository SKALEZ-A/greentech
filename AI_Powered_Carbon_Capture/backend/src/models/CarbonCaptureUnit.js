import mongoose from 'mongoose';

const carbonCaptureUnitSchema = new mongoose.Schema({
  // Basic Information
  id: {
    type: String,
    required: [true, 'Please add unit ID'],
    unique: true,
    trim: true,
    maxlength: [50, 'Unit ID can not be more than 50 characters']
  },
  name: {
    type: String,
    required: [true, 'Please add unit name'],
    trim: true,
    maxlength: [100, 'Unit name can not be more than 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description can not be more than 500 characters']
  },

  // Ownership and Access
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Unit must have an owner']
  },
  operators: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['primary', 'secondary', 'viewer'], default: 'secondary' },
    permissions: [{
    type: String,
      enum: ['read', 'write', 'admin', 'optimize', 'maintenance']
    }],
    addedAt: { type: Date, default: Date.now }
  }],

  // Location
  location: {
    address: String,
    city: String,
    state: String,
    country: String,
    postalCode: String,
    coordinates: {
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 }
    },
    timezone: { type: String, default: 'UTC' }
  },

  // Technical Specifications
  capacity: {
  co2PerDay: {
    type: Number,
      required: [true, 'Please add CO2 capture capacity'],
      min: [0, 'CO2 capacity must be positive']
    },
    co2PerHour: Number,
    co2PerYear: Number,
  efficiency: {
    type: Number,
      min: [0, 'Efficiency must be positive'],
      max: [100, 'Efficiency cannot exceed 100%'],
      default: 85
    },
    maxFlowRate: Number, // m³/h
    operatingPressure: Number, // kPa
    operatingTemperature: Number, // °C
  },

  // Technology Details
  technology: {
    type: {
      type: String,
      enum: ['direct_air_capture', 'flue_gas', 'industrial_process', 'ocean_based'],
      required: [true, 'Please specify technology type']
    },
    sorbentType: {
      type: String,
      enum: ['amine_based', 'metal_organic', 'zeolite', 'solid_sorbent', 'other'],
      default: 'amine_based'
    },
    manufacturer: String,
    model: String,
    serialNumber: String,
    installationDate: Date,
    warrantyExpiry: Date
  },

  // Operational Status
    status: {
      type: String,
    enum: ['active', 'inactive', 'maintenance', 'error', 'offline'],
    default: 'inactive'
  },
  operationalMode: {
      type: String,
    enum: ['automatic', 'manual', 'scheduled', 'standby'],
    default: 'automatic'
  },
  lastOperationalCheck: Date,
  uptime: {
    totalHours: { type: Number, default: 0 },
    lastCalculated: { type: Date, default: Date.now }
  },

  // Maintenance
  maintenance: {
    lastMaintenance: Date,
    nextScheduledMaintenance: Date,
    maintenanceHistory: [{
      type: {
      type: String,
        enum: ['preventive', 'corrective', 'predictive', 'emergency']
      },
      description: String,
      performedBy: String,
      cost: Number,
      duration: Number, // hours
      parts: [{
        name: String,
        partNumber: String,
        quantity: Number,
        cost: Number
      }],
      date: { type: Date, default: Date.now },
      notes: String
    }],
    maintenanceAlerts: [{
      type: {
        type: String,
        enum: ['warning', 'critical', 'info']
      },
      component: String,
      message: String,
      acknowledged: { type: Boolean, default: false },
      acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      acknowledgedAt: Date,
      date: { type: Date, default: Date.now }
    }]
  },

  // AI Optimization
  aiOptimization: {
    isEnabled: { type: Boolean, default: true },
    currentEfficiency: { type: Number, min: 0, max: 100 },
    predictedEfficiency: { type: Number, min: 0, max: 100 },
    optimizationSuggestions: [{
      id: String,
      category: { type: String, enum: ['efficiency', 'energy', 'maintenance'] },
      title: String,
      description: String,
      impact: {
        efficiency_gain: Number,
        energy_savings: Number,
        co2_reduction: Number,
        cost_savings: Number
      },
      priority: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
      status: { type: String, enum: ['pending', 'implemented', 'rejected'], default: 'pending' },
      implementedAt: Date,
      implementedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      date: { type: Date, default: Date.now }
    }],
    predictiveMaintenance: [{
      component: String,
      alertType: { type: String, enum: ['warning', 'critical'] },
      message: String,
      probability: { type: Number, min: 0, max: 1 },
      predictedFailureDate: Date,
      status: { type: String, enum: ['active', 'resolved', 'false_positive'], default: 'active' },
      resolvedAt: Date,
      resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      date: { type: Date, default: Date.now }
    }],
    energyOptimization: {
      renewableEnergyUsage: { type: Number, min: 0, max: 100, default: 0 },
      energySavings: { type: Number, default: 0 },
      costSavings: { type: Number, default: 0 },
      optimalEnergyMix: {
        renewable: { type: Number, min: 0, max: 100 },
        grid: { type: Number, min: 0, max: 100 },
        battery: { type: Number, min: 0, max: 100 }
      },
      lastOptimization: { type: Date, default: Date.now }
    },
    lastOptimization: Date,
    aiModelVersion: { type: String, default: '1.0.0' },
    optimizationHistory: [{
      type: { type: String, enum: ['efficiency', 'energy', 'maintenance'] },
      result: mongoose.Schema.Types.Mixed,
      timestamp: { type: Date, default: Date.now }
    }]
  },

  // Carbon Credits
  carbonCredits: {
    totalCredits: { type: Number, default: 0 },
    availableCredits: { type: Number, default: 0 },
    retiredCredits: { type: Number, default: 0 },
    creditHistory: [{
      type: { type: String, enum: ['generated', 'transferred', 'retired', 'sold'] },
      amount: Number,
      price: Number,
      counterparty: String,
      transactionId: String,
      blockchainTx: String,
      date: { type: Date, default: Date.now }
    }],
    creditGenerationRate: Number, // credits per day
    lastCreditGeneration: Date
  },

  // Sensors and Monitoring
  sensors: [{
    sensorId: { type: mongoose.Schema.Types.ObjectId, ref: 'SensorData' },
    type: {
    type: String,
      enum: ['temperature', 'pressure', 'flow', 'co2', 'humidity', 'energy', 'vibration', 'other']
    },
    location: String,
    isActive: { type: Boolean, default: true },
    lastReading: Date,
    addedAt: { type: Date, default: Date.now }
  }],

  // Energy Management
  energyManagement: {
    renewableEnergy: {
      available: { type: Boolean, default: false },
      capacity: Number, // kW
      type: { type: String, enum: ['solar', 'wind', 'hydro', 'other'] },
      efficiency: Number
    },
    gridConnection: {
      available: { type: Boolean, default: true },
      tariff: Number, // $/kWh
      peakHours: [String] // e.g., ["09:00-11:00", "17:00-19:00"]
    },
    batteryStorage: {
      capacity: Number, // kWh
      currentCharge: Number, // %
      efficiency: Number
    },
    energyConsumption: {
      current: Number, // kW
      dailyAverage: Number, // kWh
      monthlyTotal: Number, // kWh
      lastUpdated: Date
    }
  },

  // Environmental Impact
  environmentalImpact: {
    co2Captured: {
      total: { type: Number, default: 0 }, // tons
      thisMonth: { type: Number, default: 0 },
      thisYear: { type: Number, default: 0 },
      lastUpdated: Date
    },
    carbonIntensity: Number, // kg CO2/kWh
    energyIntensity: Number, // kWh/ton CO2
    waterUsage: Number, // L/ton CO2
    landUse: Number, // m²
    emissions: {
      scope1: Number, // Direct emissions
      scope2: Number, // Indirect emissions
      scope3: Number  // Other indirect emissions
    }
  },

  // Compliance and Certification
  compliance: {
    certifications: [{
      name: String,
      issuer: String,
      issueDate: Date,
      expiryDate: Date,
      status: { type: String, enum: ['active', 'expired', 'pending'] },
      certificateId: String
    }],
    permits: [{
      type: String,
      authority: String,
      issueDate: Date,
      expiryDate: Date,
      status: { type: String, enum: ['active', 'expired', 'pending'] },
      permitId: String
    }],
    lastAudit: Date,
    nextAudit: Date,
    complianceScore: { type: Number, min: 0, max: 100 }
  },

  // Financial Information
  financial: {
    capitalCost: Number, // Initial investment
    operatingCost: {
      monthly: Number,
      annual: Number,
      breakdown: {
        energy: Number,
        maintenance: Number,
        labor: Number,
        other: Number
      }
    },
    revenue: {
      carbonCredits: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },
    roi: Number, // Return on investment percentage
    paybackPeriod: Number, // months
    npv: Number // Net present value
  },

  // Alerts and Notifications
  alerts: [{
    type: { type: String, enum: ['system', 'maintenance', 'efficiency', 'environmental', 'security'] },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
    title: String,
    message: String,
    acknowledged: { type: Boolean, default: false },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    acknowledgedAt: Date,
    resolved: { type: Boolean, default: false },
    resolvedAt: Date,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    autoResolve: { type: Boolean, default: false },
    date: { type: Date, default: Date.now }
  }],

  // Integration Settings
  integrations: {
    iotPlatform: {
      enabled: { type: Boolean, default: false },
      platform: String,
      apiKey: String,
      endpoint: String
    },
    blockchain: {
      enabled: { type: Boolean, default: false },
      network: String,
      contractAddress: String,
      walletAddress: String
    },
    renewableEnergy: {
      enabled: { type: Boolean, default: false },
      provider: String,
      apiEndpoint: String
    }
  },

  // Metadata
  tags: [String],
  customFields: mongoose.Schema.Types.Mixed,
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
carbonCaptureUnitSchema.index({ id: 1 });
carbonCaptureUnitSchema.index({ owner: 1 });
carbonCaptureUnitSchema.index({ status: 1 });
carbonCaptureUnitSchema.index({ 'location.coordinates': '2dsphere' });
carbonCaptureUnitSchema.index({ 'technology.type': 1 });
carbonCaptureUnitSchema.index({ 'capacity.co2PerDay': -1 });
carbonCaptureUnitSchema.index({ 'carbonCredits.totalCredits': -1 });
carbonCaptureUnitSchema.index({ 'aiOptimization.currentEfficiency': -1 });
carbonCaptureUnitSchema.index({ createdAt: -1 });

// Virtuals
carbonCaptureUnitSchema.virtual('age').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

carbonCaptureUnitSchema.virtual('activeAlerts').get(function() {
  return this.alerts.filter(alert => !alert.resolved && !alert.acknowledged);
});

carbonCaptureUnitSchema.virtual('maintenanceAlerts').get(function() {
  return this.maintenance.maintenanceAlerts.filter(alert => !alert.acknowledged);
});

carbonCaptureUnitSchema.virtual('pendingOptimizations').get(function() {
  return this.aiOptimization.optimizationSuggestions.filter(s => s.status === 'pending');
});

// Instance methods
carbonCaptureUnitSchema.methods = {
  // Add operator
  addOperator: function(userId, role = 'secondary', permissions = ['read']) {
    if (!this.operators.some(op => op.user.toString() === userId.toString())) {
      this.operators.push({
        user: userId,
        role,
        permissions,
        addedAt: new Date()
      });
    }
    return this.save();
  },

  // Remove operator
  removeOperator: function(userId) {
    this.operators = this.operators.filter(op => op.user.toString() !== userId.toString());
  return this.save();
  },

  // Check if user has permission
  hasPermission: function(userId, permission) {
    // Owner has all permissions
    if (this.owner.toString() === userId.toString()) {
      return true;
    }

    // Check operator permissions
    const operator = this.operators.find(op => op.user.toString() === userId.toString());
    return operator && operator.permissions.includes(permission);
  },

  // Add optimization suggestion
  addOptimizationSuggestion: function(suggestion) {
    const suggestionWithId = {
    ...suggestion,
    id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      date: new Date()
    };
    this.aiOptimization.optimizationSuggestions.push(suggestionWithId);
    return this.save();
  },

  // Add predictive maintenance alert
  addPredictiveMaintenance: function(alert) {
    const alertWithTimestamp = {
      ...alert,
      date: new Date()
    };
    this.aiOptimization.predictiveMaintenance.push(alertWithTimestamp);
    return this.save();
  },

  // Add alert
  addAlert: function(alert) {
    const alertWithTimestamp = {
      ...alert,
      date: new Date()
    };
    this.alerts.push(alertWithTimestamp);
    return this.save();
  },

  // Add maintenance record
  addMaintenanceRecord: function(record) {
    this.maintenance.maintenanceHistory.push({
      ...record,
      date: new Date()
    });
    this.maintenance.lastMaintenance = new Date();
  return this.save();
  },

  // Update carbon credits
  updateCarbonCredits: function(amount, type, details = {}) {
    const creditUpdate = {
      type,
      amount,
      ...details,
      date: new Date()
    };

    if (type === 'generated') {
      this.carbonCredits.totalCredits += amount;
      this.carbonCredits.availableCredits += amount;
    } else if (type === 'transferred' || type === 'sold') {
      this.carbonCredits.availableCredits -= amount;
    } else if (type === 'retired') {
      this.carbonCredits.availableCredits -= amount;
      this.carbonCredits.retiredCredits += amount;
    }

    this.carbonCredits.creditHistory.push(creditUpdate);
    this.carbonCredits.lastCreditGeneration = new Date();

    return this.save();
  },

  // Calculate efficiency
  calculateEfficiency: function(co2Captured, energyUsed) {
    if (!energyUsed || energyUsed <= 0) return 0;
    return (co2Captured / energyUsed) * 1000; // kg CO2/kWh
  },

  // Get unit statistics
  getStats: function() {
    const activeSensors = this.sensors.filter(s => s.isActive).length;
    const activeAlerts = this.activeAlerts.length;
    const pendingOptimizations = this.pendingOptimizations.length;
    const maintenanceAlerts = this.maintenanceAlerts.length;

    return {
      id: this.id,
      name: this.name,
      status: this.status,
      efficiency: this.capacity.efficiency,
      co2Capacity: this.capacity.co2PerDay,
      totalCredits: this.carbonCredits.totalCredits,
      activeSensors,
      activeAlerts,
      pendingOptimizations,
      maintenanceAlerts,
      lastMaintenance: this.maintenance.lastMaintenance,
      uptime: this.uptime.totalHours,
      age: this.age
    };
  },

  // Check operational health
  checkHealth: function() {
    const issues = [];

    // Check sensor health
    const inactiveSensors = this.sensors.filter(s => !s.isActive);
    if (inactiveSensors.length > 0) {
      issues.push({
        type: 'sensors',
        severity: 'medium',
        message: `${inactiveSensors.length} sensors are inactive`
      });
    }

    // Check maintenance status
    const daysSinceMaintenance = this.maintenance.lastMaintenance ?
      Math.floor((Date.now() - this.maintenance.lastMaintenance) / (1000 * 60 * 60 * 24)) : null;

    if (daysSinceMaintenance && daysSinceMaintenance > 180) {
      issues.push({
        type: 'maintenance',
        severity: 'high',
        message: `Maintenance overdue by ${daysSinceMaintenance - 180} days`
      });
    }

    // Check efficiency
    if (this.capacity.efficiency < 70) {
      issues.push({
        type: 'efficiency',
        severity: 'high',
        message: `Efficiency is critically low: ${this.capacity.efficiency}%`
      });
    } else if (this.capacity.efficiency < 80) {
      issues.push({
        type: 'efficiency',
        severity: 'medium',
        message: `Efficiency is below optimal: ${this.capacity.efficiency}%`
      });
    }

    // Check alerts
    if (activeAlerts > 5) {
      issues.push({
        type: 'alerts',
        severity: 'high',
        message: `${activeAlerts} active alerts require attention`
      });
    }

    return {
      health: issues.length === 0 ? 'healthy' : 'warning',
      issues: issues,
      score: Math.max(0, 100 - (issues.length * 10))
    };
  }
};

// Static methods
carbonCaptureUnitSchema.statics = {
  // Find units by owner
  findByOwner: function(ownerId) {
    return this.find({ owner: ownerId, status: { $ne: 'inactive' } });
  },

  // Find units by location
  findByLocation: function(longitude, latitude, maxDistance = 10000) {
  return this.find({
    'location.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
            coordinates: [longitude, latitude]
          },
          $maxDistance: maxDistance
        }
      }
    });
  },

  // Get system statistics
  getSystemStats: async function() {
    const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalUnits: { $sum: 1 },
          activeUnits: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        totalCapacity: { $sum: '$capacity.co2PerDay' },
        avgEfficiency: { $avg: '$capacity.efficiency' },
          totalCredits: { $sum: '$carbonCredits.totalCredits' },
          totalAlerts: { $sum: { $size: '$alerts' } },
          totalSensors: { $sum: { $size: '$sensors' } }
        }
      }
    ]);

    return stats[0] || {
      totalUnits: 0,
      activeUnits: 0,
      totalCapacity: 0,
      avgEfficiency: 0,
      totalCredits: 0,
      totalAlerts: 0,
      totalSensors: 0
    };
  },

  // Get units needing maintenance
  getUnitsNeedingMaintenance: function() {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    return this.find({
      'maintenance.lastMaintenance': { $lt: ninetyDaysAgo },
      status: 'active'
    });
  },

  // Get high-efficiency units
  getHighEfficiencyUnits: function(threshold = 90) {
    return this.find({
      'capacity.efficiency': { $gte: threshold },
      status: 'active'
    });
  }
};

export default mongoose.model('CarbonCaptureUnit', carbonCaptureUnitSchema);