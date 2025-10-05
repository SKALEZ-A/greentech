import mongoose from 'mongoose';

const sensorDataSchema = new mongoose.Schema({
  // Sensor identification
  sensorId: {
    type: String,
    required: [true, 'Please add sensor ID'],
    unique: true,
    trim: true,
    maxlength: [50, 'Sensor ID can not be more than 50 characters']
  },
  name: {
    type: String,
    required: [true, 'Please add sensor name'],
    trim: true,
    maxlength: [100, 'Sensor name can not be more than 100 characters']
  },

  // Associated unit
  unitId: {
    type: String,
    required: [true, 'Please add unit ID'],
    ref: 'CarbonCaptureUnit'
  },

  // Sensor specifications
  type: {
    type: String,
    required: [true, 'Please add sensor type'],
    enum: [
      'temperature', 'pressure', 'flow_rate', 'humidity', 'air_quality',
      'co2_concentration', 'energy_consumption', 'vibration', 'motor_current',
      'bearing_temperature', 'ph_level', 'conductivity', 'turbidity',
      'particle_count', 'noise_level', 'voltage', 'current', 'power_factor'
    ]
  },

  // Sensor characteristics
  specifications: {
    manufacturer: String,
    model: String,
    serialNumber: String,
    accuracy: Number, // percentage or absolute value
    precision: Number,
    range: {
      min: Number,
      max: Number,
      unit: String
    },
    resolution: Number,
    responseTime: Number, // milliseconds
    calibrationDate: Date,
    calibrationDue: Date,
    warrantyExpiry: Date
  },

  // Location within unit
  location: {
    zone: String, // e.g., 'compressor', 'absorber', 'regenerator'
    position: String, // e.g., 'inlet', 'outlet', 'middle'
    coordinates: {
      x: Number, // relative coordinates within unit
      y: Number,
      z: Number
    }
  },

  // Operational status
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'error', 'calibrating'],
    default: 'active'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  health: {
    type: String,
    enum: ['healthy', 'warning', 'critical', 'unknown'],
    default: 'unknown'
  },

  // Current reading
  currentReading: {
    value: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      required: true,
      enum: [
        'celsius', 'fahrenheit', 'kelvin', // temperature
        'kpa', 'psi', 'bar', 'atm', // pressure
        'm3_h', 'l_min', 'ft3_min', // flow
        'percent', 'ppm', 'ppb', // concentration
        'kw', 'kwh', 'mw', 'mwh', // energy
        'mm_s', 'in_s', // vibration
        'ampere', 'volt', 'watt', // electrical
        'db', 'dba' // noise
      ]
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    quality: {
      type: String,
      enum: ['good', 'fair', 'poor'],
      default: 'good'
    },
    isValid: {
      type: Boolean,
      default: true
    }
  },

  // Thresholds and alerts
  thresholds: {
    warning: {
      min: Number,
      max: Number
    },
    critical: {
      min: Number,
      max: Number
    },
    optimal: {
      min: Number,
      max: Number
    }
  },

  // Historical data aggregation
  readings: [{
    value: Number,
    timestamp: { type: Date, default: Date.now },
    quality: { type: String, enum: ['good', 'fair', 'poor'], default: 'good' }
  }],

  // Statistics
  statistics: {
    last24Hours: {
      min: Number,
      max: Number,
      avg: Number,
      std: Number,
      count: Number
    },
    last7Days: {
      min: Number,
      max: Number,
      avg: Number,
      std: Number,
      count: Number
    },
    last30Days: {
      min: Number,
      max: Number,
      avg: Number,
      std: Number,
      count: Number
    }
  },

  // Maintenance and calibration
  maintenance: {
    lastMaintenance: Date,
    nextMaintenance: Date,
    maintenanceHistory: [{
      type: {
        type: String,
        enum: ['calibration', 'cleaning', 'repair', 'replacement']
      },
      description: String,
      performedBy: String,
      cost: Number,
      date: { type: Date, default: Date.now },
      notes: String
    }],
    calibrationHistory: [{
      calibratedBy: String,
      beforeValue: Number,
      afterValue: Number,
      offset: Number,
      date: { type: Date, default: Date.now },
      notes: String
    }]
  },

  // Alerts and anomalies
  alerts: [{
    type: {
      type: String,
      enum: ['threshold_warning', 'threshold_critical', 'anomaly', 'sensor_error', 'calibration_due']
    },
    message: String,
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    value: Number,
    threshold: Number,
    acknowledged: { type: Boolean, default: false },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    acknowledgedAt: Date,
    resolved: { type: Boolean, default: false },
    resolvedAt: Date,
    date: { type: Date, default: Date.now }
  }],

  // Data quality metrics
  dataQuality: {
    completeness: { type: Number, min: 0, max: 100, default: 100 }, // percentage
    accuracy: { type: Number, min: 0, max: 100, default: 95 }, // percentage
    timeliness: { type: Number, min: 0, max: 100, default: 100 }, // percentage
    overall: { type: Number, min: 0, max: 100, default: 95 } // percentage
  },

  // Communication settings
  communication: {
    protocol: {
      type: String,
      enum: ['modbus', 'opc_ua', 'mqtt', 'http', 'websocket', 'serial'],
      default: 'mqtt'
    },
    address: String, // IP address or serial port
    port: Number,
    topic: String, // MQTT topic
    updateInterval: Number, // seconds
    timeout: Number, // seconds
    retryAttempts: { type: Number, default: 3 },
    lastCommunication: Date
  },

  // Power and environmental
  power: {
    voltage: Number, // V
    current: Number, // mA
    powerConsumption: Number, // W
    batteryLevel: { type: Number, min: 0, max: 100 } // percentage
  },

  environmental: {
    temperature: Number, // sensor's own temperature
    humidity: Number, // sensor's environment
    vibration: Number // sensor's vibration level
  },

  // Firmware and software
  firmware: {
    version: String,
    lastUpdate: Date,
    updateAvailable: { type: Boolean, default: false },
    updateVersion: String
  },

  // Metadata
  tags: [String],
  customFields: mongoose.Schema.Types.Mixed,
  notes: String,
  installedBy: {
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
sensorDataSchema.index({ sensorId: 1 });
sensorDataSchema.index({ unitId: 1 });
sensorDataSchema.index({ type: 1 });
sensorDataSchema.index({ status: 1 });
sensorDataSchema.index({ 'currentReading.timestamp': -1 });
sensorDataSchema.index({ 'alerts.date': -1 });
sensorDataSchema.index({ createdAt: -1 });

// Virtuals
sensorDataSchema.virtual('activeAlerts').get(function() {
  return this.alerts.filter(alert => !alert.resolved && !alert.acknowledged);
});

sensorDataSchema.virtual('age').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

sensorDataSchema.virtual('daysSinceLastMaintenance').get(function() {
  if (!this.maintenance.lastMaintenance) return null;
  return Math.floor((Date.now() - this.maintenance.lastMaintenance) / (1000 * 60 * 60 * 24));
});

sensorDataSchema.virtual('isCalibrationDue').get(function() {
  if (!this.maintenance.nextMaintenance) return false;
  return this.maintenance.nextMaintenance <= new Date();
});

// Instance methods
sensorDataSchema.methods = {
  // Add new reading
  addReading: function(value, quality = 'good', timestamp = null) {
    const reading = {
      value,
      timestamp: timestamp || new Date(),
      quality
    };

    // Add to readings array (keep last 1000 readings)
    this.readings.push(reading);
    if (this.readings.length > 1000) {
      this.readings.shift();
    }

    // Update current reading
    this.currentReading = {
      value,
      unit: this.currentReading.unit,
      timestamp: reading.timestamp,
      quality,
      isValid: this.validateReading(value)
    };

    // Update statistics
    this.updateStatistics();

    // Check thresholds and create alerts
    this.checkThresholds();

    return this.save();
  },

  // Validate reading against specifications
  validateReading: function(value) {
    if (!this.specifications.range) return true;

    const { min, max } = this.specifications.range;
    return value >= min && value <= max;
  },

  // Check thresholds and create alerts
  checkThresholds: function() {
    const value = this.currentReading.value;
    let alertType = null;
    let severity = null;
    let message = null;

    if (this.thresholds.critical) {
      const { min: critMin, max: critMax } = this.thresholds.critical;
      if (value <= critMin || value >= critMax) {
        alertType = 'threshold_critical';
        severity = 'critical';
        message = `Critical threshold exceeded: ${value} ${this.currentReading.unit}`;
      }
    }

    if (!alertType && this.thresholds.warning) {
      const { min: warnMin, max: warnMax } = this.thresholds.warning;
      if (value <= warnMin || value >= warnMax) {
        alertType = 'threshold_warning';
        severity = 'medium';
        message = `Warning threshold exceeded: ${value} ${this.currentReading.unit}`;
      }
    }

    if (alertType) {
      this.alerts.push({
        type: alertType,
        message,
        severity,
        value,
        threshold: alertType === 'threshold_critical' ? this.thresholds.critical : this.thresholds.warning,
        date: new Date()
      });
    }
  },

  // Update statistics
  updateStatistics: function() {
    const readings = this.readings.slice(-1000); // Last 1000 readings
    if (readings.length === 0) return;

    const values = readings.map(r => r.value);

    // Last 24 hours (assuming readings every 5 minutes = 288 readings)
    const last24h = readings.slice(-288);
    if (last24h.length > 0) {
      const values24h = last24h.map(r => r.value);
      this.statistics.last24Hours = {
        min: Math.min(...values24h),
        max: Math.max(...values24h),
        avg: values24h.reduce((a, b) => a + b, 0) / values24h.length,
        std: Math.sqrt(values24h.reduce((a, b) => a + (b - (values24h.reduce((c, d) => c + d, 0) / values24h.length)) ** 2, 0) / values24h.length),
        count: values24h.length
      };
    }

    // Last 7 days (assuming readings every 5 minutes = 2016 readings)
    const last7d = readings.slice(-2016);
    if (last7d.length > 0) {
      const values7d = last7d.map(r => r.value);
      this.statistics.last7Days = {
        min: Math.min(...values7d),
        max: Math.max(...values7d),
        avg: values7d.reduce((a, b) => a + b, 0) / values7d.length,
        std: Math.sqrt(values7d.reduce((a, b) => a + (b - (values7d.reduce((c, d) => c + d, 0) / values7d.length)) ** 2, 0) / values7d.length),
        count: values7d.length
      };
    }

    // Last 30 days (assuming readings every 5 minutes = 8640 readings)
    const last30d = readings.slice(-8640);
    if (last30d.length > 0) {
      const values30d = last30d.map(r => r.value);
      this.statistics.last30Days = {
        min: Math.min(...values30d),
        max: Math.max(...values30d),
        avg: values30d.reduce((a, b) => a + b, 0) / values30d.length,
        std: Math.sqrt(values30d.reduce((a, b) => a + (b - (values30d.reduce((c, d) => c + d, 0) / values30d.length)) ** 2, 0) / values30d.length),
        count: values30d.length
      };
    }
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

  // Add calibration record
  addCalibrationRecord: function(record) {
    this.maintenance.calibrationHistory.push({
      ...record,
      date: new Date()
    });
    this.specifications.calibrationDate = new Date();
    return this.save();
  },

  // Add alert
  addAlert: function(alert) {
    this.alerts.push({
      ...alert,
      date: new Date()
    });
    return this.save();
  },

  // Acknowledge alert
  acknowledgeAlert: function(alertId, userId) {
    const alert = this.alerts.id(alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = userId;
      alert.acknowledgedAt = new Date();
    }
    return this.save();
  },

  // Resolve alert
  resolveAlert: function(alertId, userId) {
    const alert = this.alerts.id(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      alert.resolvedBy = userId;
    }
    return this.save();
  },

  // Get sensor health score
  getHealthScore: function() {
    let score = 100;

    // Deduct for active alerts
    const activeAlerts = this.activeAlerts.length;
    score -= activeAlerts * 10;

    // Deduct for old calibration
    if (this.isCalibrationDue) {
      score -= 20;
    }

    // Deduct for poor data quality
    score -= (100 - this.dataQuality.overall) * 0.5;

    // Deduct for old readings
    const hoursSinceLastReading = (Date.now() - this.currentReading.timestamp) / (1000 * 60 * 60);
    if (hoursSinceLastReading > 1) {
      score -= Math.min(hoursSinceLastReading * 5, 30);
    }

    return Math.max(0, Math.min(100, score));
  },

  // Get sensor statistics
  getStats: function() {
    return {
      sensorId: this.sensorId,
      name: this.name,
      type: this.type,
      status: this.status,
      currentValue: this.currentReading.value,
      unit: this.currentReading.unit,
      lastReading: this.currentReading.timestamp,
      healthScore: this.getHealthScore(),
      activeAlerts: this.activeAlerts.length,
      dataQuality: this.dataQuality.overall,
      daysSinceMaintenance: this.daysSinceLastMaintenance,
      totalReadings: this.readings.length
    };
  }
};

// Static methods
sensorDataSchema.statics = {
  // Find sensors by unit
  findByUnit: function(unitId) {
    return this.find({ unitId, isActive: true });
  },

  // Find sensors by type
  findByType: function(sensorType) {
    return this.find({ type: sensorType, isActive: true });
  },

  // Find sensors with active alerts
  findWithActiveAlerts: function() {
    return this.find({
      'alerts': {
        $elemMatch: {
          acknowledged: false,
          resolved: false
        }
      }
    });
  },

  // Get system-wide sensor statistics
  getSystemStats: async function() {
    const stats = await this.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $group: {
          _id: null,
          totalSensors: { $sum: 1 },
          activeSensors: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          sensorsWithAlerts: {
            $sum: {
              $cond: [
                { $gt: [{ $size: { $filter: { input: '$alerts', cond: { $and: [{ $eq: ['$$this.acknowledged', false] }, { $eq: ['$$this.resolved', false] }] } } } }, 0] },
                1,
                0
              ]
            }
          },
          avgDataQuality: { $avg: '$dataQuality.overall' },
          avgHealthScore: { $avg: { $function: { body: 'function() { return this.getHealthScore ? this.getHealthScore() : 85; }', args: [], lang: 'js' } } }
        }
      }
    ]);

    return stats[0] || {
      totalSensors: 0,
      activeSensors: 0,
      sensorsWithAlerts: 0,
      avgDataQuality: 0,
      avgHealthScore: 0
    };
  },

  // Get sensors needing maintenance
  getSensorsNeedingMaintenance: function() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return this.find({
      $or: [
        { 'maintenance.nextMaintenance': { $lte: new Date() } },
        { 'maintenance.lastMaintenance': { $lte: thirtyDaysAgo } }
      ],
      isActive: true
    });
  }
};

export default mongoose.model('SensorData', sensorDataSchema);