import mongoose from 'mongoose';

const { Schema } = mongoose;

// Location sub-schema
const locationSchema = new Schema({
  latitude: {
    type: Number,
    required: true,
    min: -90,
    max: 90,
  },
  longitude: {
    type: Number,
    required: true,
    min: -180,
    max: 180,
  },
  address: {
    type: String,
    required: true,
    trim: true,
  },
  city: {
    type: String,
    required: true,
    trim: true,
  },
  country: {
    type: String,
    required: true,
    trim: true,
  },
  postalCode: {
    type: String,
    trim: true,
  },
}, { _id: false });

// Capacity sub-schema
const capacitySchema = new Schema({
  co2PerDay: {
    type: Number,
    required: true,
    min: 0,
  },
  energyConsumption: {
    type: Number,
    required: true,
    min: 0,
  },
  efficiency: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  maxCapacity: {
    type: Number,
    min: 0,
  },
  currentLoad: {
    type: Number,
    min: 0,
    default: 0,
  },
}, { _id: false });

// AI Optimization sub-schema
const aiOptimizationSchema = new Schema({
  currentEfficiency: {
    type: Number,
    min: 0,
    max: 100,
  },
  predictedEfficiency: {
    type: Number,
    min: 0,
    max: 100,
  },
  optimizationSuggestions: [{
    id: String,
    type: {
      type: String,
      enum: ['efficiency', 'maintenance', 'energy', 'configuration'],
    },
    title: String,
    description: String,
    impact: {
      co2Increase: Number,
      energySavings: Number,
      costSavings: Number,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
    },
    status: {
      type: String,
      enum: ['pending', 'implemented', 'rejected'],
      default: 'pending',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    implementedAt: Date,
  }],
  predictiveMaintenance: [{
    id: String,
    component: String,
    alertType: {
      type: String,
      enum: ['warning', 'critical', 'info'],
    },
    message: String,
    probability: {
      type: Number,
      min: 0,
      max: 1,
    },
    predictedFailureDate: Date,
    recommendedAction: String,
    status: {
      type: String,
      enum: ['active', 'resolved', 'dismissed'],
      default: 'active',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    resolvedAt: Date,
  }],
  energyOptimization: {
    renewableEnergyUsage: {
      type: Number,
      min: 0,
      max: 100,
    },
    gridEnergyUsage: {
      type: Number,
      min: 0,
      max: 100,
    },
    peakDemandReduction: Number,
    costOptimization: Number,
    carbonFootprint: Number,
    recommendations: [{
      id: String,
      type: {
        type: String,
        enum: ['solar', 'wind', 'battery', 'demand_response'],
      },
      title: String,
      description: String,
      savings: {
        energy: Number,
        cost: Number,
        emissions: Number,
      },
      paybackPeriod: Number,
      feasibility: {
        type: String,
        enum: ['high', 'medium', 'low'],
      },
    }],
  },
  lastOptimization: {
    type: Date,
    default: Date.now,
  },
  aiModelVersion: {
    type: String,
    default: '1.0.0',
  },
}, { _id: false });

// Carbon Credit sub-schema
const carbonCreditSchema = new Schema({
  totalCredits: {
    type: Number,
    min: 0,
    default: 0,
  },
  availableCredits: {
    type: Number,
    min: 0,
    default: 0,
  },
  retiredCredits: {
    type: Number,
    min: 0,
    default: 0,
  },
  creditPrice: {
    type: Number,
    min: 0,
  },
  blockchainTxHash: String,
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending',
  },
  lastTransaction: Date,
  marketplaceListings: [{
    id: String,
    amount: {
      type: Number,
      min: 0,
    },
    price: {
      type: Number,
      min: 0,
    },
    seller: String,
    buyer: String,
    status: {
      type: String,
      enum: ['listed', 'sold', 'cancelled'],
      default: 'listed',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    soldAt: Date,
  }],
}, { _id: false });

// Sensor data reference sub-schema
const sensorReferenceSchema = new Schema({
  sensorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SensorData',
  },
  type: {
    type: String,
    enum: ['temperature', 'pressure', 'flow', 'co2', 'energy', 'humidity', 'air_quality'],
  },
  lastReading: {
    value: Number,
    timestamp: Date,
    quality: {
      type: String,
      enum: ['good', 'warning', 'critical'],
    },
  },
}, { _id: false });

// Main Carbon Capture Unit schema
const carbonCaptureUnitSchema = new Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  location: {
    type: locationSchema,
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['residential', 'commercial', 'industrial', 'utility'],
  },
  status: {
    type: String,
    required: true,
    enum: ['active', 'maintenance', 'offline', 'error'],
    default: 'active',
  },
  capacity: {
    type: capacitySchema,
    required: true,
  },
  sensors: [sensorReferenceSchema],
  aiOptimization: aiOptimizationSchema,
  carbonCredits: carbonCreditSchema,
  lastMaintenance: {
    type: Date,
    default: Date.now,
  },
  installationDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for performance
carbonCaptureUnitSchema.index({ 'location.coordinates': '2dsphere' });
carbonCaptureUnitSchema.index({ status: 1 });
carbonCaptureUnitSchema.index({ type: 1 });
carbonCaptureUnitSchema.index({ owner: 1 });
carbonCaptureUnitSchema.index({ 'capacity.efficiency': -1 });
carbonCaptureUnitSchema.index({ createdAt: -1 });

// Virtual for current efficiency
carbonCaptureUnitSchema.virtual('currentEfficiency').get(function() {
  return this.aiOptimization?.currentEfficiency || this.capacity.efficiency;
});

// Virtual for total CO2 captured
carbonCaptureUnitSchema.virtual('totalCO2Captured').get(function() {
  return this.carbonCredits?.totalCredits || 0;
});

// Instance methods
carbonCaptureUnitSchema.methods.updateEfficiency = function(newEfficiency) {
  this.capacity.efficiency = newEfficiency;
  this.aiOptimization.currentEfficiency = newEfficiency;
  this.updatedAt = new Date();
  return this.save();
};

carbonCaptureUnitSchema.methods.addOptimizationSuggestion = function(suggestion) {
  if (!this.aiOptimization.optimizationSuggestions) {
    this.aiOptimization.optimizationSuggestions = [];
  }
  this.aiOptimization.optimizationSuggestions.push({
    ...suggestion,
    id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
  });
  this.updatedAt = new Date();
  return this.save();
};

carbonCaptureUnitSchema.methods.addPredictiveMaintenance = function(alert) {
  if (!this.aiOptimization.predictiveMaintenance) {
    this.aiOptimization.predictiveMaintenance = [];
  }
  this.aiOptimization.predictiveMaintenance.push({
    ...alert,
    id: `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
  });
  this.updatedAt = new Date();
  return this.save();
};

// Static methods
carbonCaptureUnitSchema.statics.findByLocation = function(latitude, longitude, maxDistance = 10000) {
  return this.find({
    'location.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        $maxDistance: maxDistance,
      },
    },
  });
};

carbonCaptureUnitSchema.statics.getNetworkStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalUnits: { $sum: 1 },
        activeUnits: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
        },
        totalCapacity: { $sum: '$capacity.co2PerDay' },
        avgEfficiency: { $avg: '$capacity.efficiency' },
        totalCO2Captured: { $sum: '$carbonCredits.totalCredits' },
      },
    },
  ]);
};

// Pre-save middleware
carbonCaptureUnitSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Post-save middleware for logging
carbonCaptureUnitSchema.post('save', function(doc) {
  console.log(`Carbon Capture Unit ${doc.id} saved`);
});

const CarbonCaptureUnit = mongoose.model('CarbonCaptureUnit', carbonCaptureUnitSchema);

export default CarbonCaptureUnit;
