import axios from 'axios';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import CarbonCaptureUnit from '../models/CarbonCaptureUnit.js';
import SensorData from '../models/SensorData.js';

// AI Engine configuration
const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:5000';

// @desc    Get AI optimization for unit
// @route   POST /api/ai/optimize/:unitId
// @access  Private
export const optimizeUnit = asyncHandler(async (req, res, next) => {
  const { unitId } = req.params;

  // Verify unit exists and user has access
  const unit = await CarbonCaptureUnit.findOne({ id: unitId });

  if (!unit) {
    return next(new ApiError('Unit not found', 404, 'UNIT_NOT_FOUND'));
  }

  if (req.user.role !== 'admin' && unit.owner.toString() !== req.user.id) {
    return next(new ApiError('Not authorized to optimize this unit', 403, 'NOT_AUTHORIZED'));
  }

  // Get latest sensor data
  const sensors = await SensorData.find({ unitId });

  if (sensors.length === 0) {
    return next(new ApiError('No sensor data available for optimization', 400, 'NO_SENSOR_DATA'));
  }

  // Prepare optimization request data
  const sensorData = {
    temperature: 0,
    pressure: 0,
    flow_rate: 0,
    humidity: 0,
    air_quality: 0,
    energy_consumption: 0,
    co2_concentration: 0,
    unit_age_days: unit.capacity.efficiency || 0,
    maintenance_days_since: unit.lastMaintenance ? Math.floor((Date.now() - unit.lastMaintenance) / (1000 * 60 * 60 * 24)) : 0,
    efficiency_current: unit.capacity.efficiency || 0,
  };

  // Aggregate sensor readings
  sensors.forEach(sensor => {
    const reading = sensor.currentReading;
    if (reading.temperature !== undefined) sensorData.temperature = reading.temperature;
    if (reading.pressure !== undefined) sensorData.pressure = reading.pressure;
    if (reading.flowRate !== undefined) sensorData.flow_rate = reading.flowRate;
    if (reading.humidity !== undefined) sensorData.humidity = reading.humidity;
    if (reading.airQuality !== undefined) sensorData.air_quality = reading.airQuality;
    if (reading.energyConsumption !== undefined) sensorData.energy_consumption = reading.energyConsumption;
    if (reading.co2Concentration !== undefined) sensorData.co2_concentration = reading.co2Concentration;
  });

  const operationalData = req.body.operationalData || {
    energy_consumption: sensorData.energy_consumption,
    renewable_energy_available: 0.7, // Default assumption
    renewable_usage: 0.6,
    grid_usage: 0.4,
    peak_hours: new Date().getHours() >= 17 && new Date().getHours() <= 21,
  };

  try {
    // Call AI engine for efficiency optimization
    const efficiencyResponse = await axios.post(`${AI_ENGINE_URL}/optimize/efficiency`, {
      unit_id: unitId,
      sensor_data: sensorData,
      operational_data: operationalData,
    }, {
      timeout: 30000, // 30 second timeout
    });

    // Call AI engine for maintenance prediction
    const maintenanceResponse = await axios.post(`${AI_ENGINE_URL}/predict/maintenance`, {
      unit_id: unitId,
      sensor_data: sensorData,
    }, {
      timeout: 30000,
    });

    // Call AI engine for energy optimization
    const energyResponse = await axios.post(`${AI_ENGINE_URL}/optimize/energy`, {
      unit_id: unitId,
      sensor_data: sensorData,
      operational_data: operationalData,
    }, {
      timeout: 30000,
    });

    // Update unit with AI recommendations
    const aiOptimization = {
      currentEfficiency: efficiencyResponse.data.predicted_efficiency,
      predictedEfficiency: efficiencyResponse.data.predicted_efficiency,
      optimizationSuggestions: efficiencyResponse.data.optimization_suggestions || [],
      predictiveMaintenance: maintenanceResponse.data.alerts || [],
      energyOptimization: energyResponse.data,
      lastOptimization: new Date(),
      aiModelVersion: efficiencyResponse.data.model_version || '1.0.0',
    };

    await unit.updateOne({
      aiOptimization,
      'capacity.efficiency': efficiencyResponse.data.predicted_efficiency,
    });

    // Add optimization suggestions to unit
    if (efficiencyResponse.data.optimization_suggestions) {
      for (const suggestion of efficiencyResponse.data.optimization_suggestions) {
        await unit.addOptimizationSuggestion(suggestion);
      }
    }

    // Add maintenance alerts
    if (maintenanceResponse.data.alerts) {
      for (const alert of maintenanceResponse.data.alerts) {
        await unit.addPredictiveMaintenance({
          component: 'system',
          alertType: alert.type === 'critical' ? 'critical' : 'warning',
          message: alert.message,
          probability: alert.probability,
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        unit_id: unitId,
        efficiency_optimization: efficiencyResponse.data,
        maintenance_prediction: maintenanceResponse.data,
        energy_optimization: energyResponse.data,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('AI Engine error:', error.message);

    if (error.code === 'ECONNREFUSED') {
      return next(new ApiError('AI Engine service unavailable', 503, 'AI_ENGINE_UNAVAILABLE'));
    }

    if (error.response?.status === 500) {
      return next(new ApiError('AI Engine processing error', 500, 'AI_ENGINE_ERROR'));
    }

    return next(new ApiError('Failed to get AI optimization', 500, 'AI_OPTIMIZATION_FAILED'));
  }
});

// @desc    Get AI model health
// @route   GET /api/ai/health
// @access  Private
export const getAIModelHealth = asyncHandler(async (req, res, next) => {
  try {
    const response = await axios.get(`${AI_ENGINE_URL}/model-health`, {
      timeout: 10000,
    });

    res.status(200).json({
      success: true,
      data: response.data,
    });

  } catch (error) {
    console.error('AI Engine health check error:', error.message);

    res.status(200).json({
      success: true,
      data: {
        overall_status: 'unavailable',
        models: {},
        version: 'unknown',
        last_check: new Date().toISOString(),
        error: 'AI Engine service unavailable',
      },
    });
  }
});

// @desc    Train AI models
// @route   POST /api/ai/train/:modelType
// @access  Private (Admin only)
export const trainAIModel = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new ApiError('Not authorized to train AI models', 403, 'NOT_AUTHORIZED'));
  }

  const { modelType } = req.params;
  const { trainingData } = req.body;

  if (!['efficiency', 'maintenance'].includes(modelType)) {
    return next(new ApiError('Invalid model type', 400, 'INVALID_MODEL_TYPE'));
  }

  try {
    const endpoint = modelType === 'efficiency' ? '/train/efficiency' : '/train/maintenance';

    const response = await axios.post(`${AI_ENGINE_URL}${endpoint}`, {
      features: trainingData.features,
      targets: trainingData.targets,
    }, {
      timeout: 300000, // 5 minute timeout for training
    });

    res.status(200).json({
      success: true,
      data: response.data,
      message: `${modelType} model training ${response.data.status}`,
    });

  } catch (error) {
    console.error('AI training error:', error.message);
    return next(new ApiError('Failed to start AI model training', 500, 'AI_TRAINING_FAILED'));
  }
});

// @desc    Get unit performance analytics
// @route   GET /api/ai/analytics/:unitId
// @access  Private
export const getUnitAnalytics = asyncHandler(async (req, res, next) => {
  const { unitId } = req.params;
  const { timeframe = '7d' } = req.query;

  // Verify unit exists and user has access
  const unit = await CarbonCaptureUnit.findOne({ id: unitId });

  if (!unit) {
    return next(new ApiError('Unit not found', 404, 'UNIT_NOT_FOUND'));
  }

  if (req.user.role !== 'admin' && unit.owner.toString() !== req.user.id) {
    return next(new ApiError('Not authorized to view this unit\'s analytics', 403, 'NOT_AUTHORIZED'));
  }

  // Get sensor data for analytics
  const sensors = await SensorData.find({ unitId });

  // Calculate analytics
  const analytics = {
    unit_id: unitId,
    timeframe,
    efficiency: {
      current: unit.capacity.efficiency,
      predicted: unit.aiOptimization?.predictedEfficiency,
      trend: calculateEfficiencyTrend(sensors, timeframe),
      optimization_opportunities: unit.aiOptimization?.optimizationSuggestions?.length || 0,
    },
    maintenance: {
      alerts: unit.aiOptimization?.predictiveMaintenance?.filter(alert => alert.status === 'active').length || 0,
      next_predicted_maintenance: calculateNextMaintenance(unit),
      risk_level: calculateRiskLevel(unit),
    },
    energy: {
      consumption: unit.aiOptimization?.energyOptimization?.energy_savings || 0,
      renewable_usage: unit.aiOptimization?.energyOptimization?.optimal_energy_mix?.renewable || 0,
      cost_savings: unit.aiOptimization?.energyOptimization?.cost_savings || 0,
    },
    carbon_capture: {
      current_rate: unit.capacity.co2PerDay,
      efficiency_trend: calculateCarbonCaptureTrend(sensors, timeframe),
      total_captured: unit.carbonCredits?.totalCredits || 0,
    },
    sensor_health: {
      total_sensors: sensors.length,
      active_sensors: sensors.filter(s => s.status === 'active').length,
      alerts: sensors.reduce((total, sensor) => total + sensor.activeAlertsCount, 0),
    },
    generated_at: new Date().toISOString(),
  };

  res.status(200).json({
    success: true,
    data: analytics,
  });
});

// @desc    Get network-wide AI insights
// @route   GET /api/ai/insights
// @access  Private
export const getNetworkInsights = asyncHandler(async (req, res, next) => {
  // Get all units user has access to
  let unitsQuery = {};
  if (req.user.role !== 'admin') {
    unitsQuery.owner = req.user.id;
  }

  const units = await CarbonCaptureUnit.find(unitsQuery);

  // Aggregate insights across network
  const insights = {
    network_overview: {
      total_units: units.length,
      active_units: units.filter(u => u.status === 'active').length,
      total_capacity: units.reduce((sum, u) => sum + u.capacity.co2PerDay, 0),
      avg_efficiency: units.reduce((sum, u) => sum + u.capacity.efficiency, 0) / units.length,
    },
    optimization_opportunities: {
      efficiency_improvements: units.reduce((sum, u) => sum + (u.aiOptimization?.optimizationSuggestions?.length || 0), 0),
      maintenance_alerts: units.reduce((sum, u) => sum + (u.aiOptimization?.predictiveMaintenance?.filter(a => a.status === 'active').length || 0), 0),
      energy_savings: units.reduce((sum, u) => sum + (u.aiOptimization?.energyOptimization?.energy_savings || 0), 0),
    },
    carbon_impact: {
      total_captured: units.reduce((sum, u) => sum + (u.carbonCredits?.totalCredits || 0), 0),
      potential_additional: calculatePotentialAdditionalCapture(units),
    },
    recommendations: generateNetworkRecommendations(units),
    generated_at: new Date().toISOString(),
  };

  res.status(200).json({
    success: true,
    data: insights,
  });
});

// @desc    Save AI models
// @route   POST /api/ai/models/save
// @access  Private (Admin only)
export const saveAIModels = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new ApiError('Not authorized to save AI models', 403, 'NOT_AUTHORIZED'));
  }

  try {
    const response = await axios.post(`${AI_ENGINE_URL}/models/save`, {}, {
      timeout: 30000,
    });

    res.status(200).json({
      success: true,
      data: response.data,
    });

  } catch (error) {
    console.error('AI model save error:', error.message);
    return next(new ApiError('Failed to save AI models', 500, 'AI_SAVE_FAILED'));
  }
});

// @desc    Load AI models
// @route   POST /api/ai/models/load
// @access  Private (Admin only)
export const loadAIModels = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new ApiError('Not authorized to load AI models', 403, 'NOT_AUTHORIZED'));
  }

  try {
    const response = await axios.post(`${AI_ENGINE_URL}/models/load`, {}, {
      timeout: 30000,
    });

    res.status(200).json({
      success: true,
      data: response.data,
    });

  } catch (error) {
    console.error('AI model load error:', error.message);
    return next(new ApiError('Failed to load AI models', 500, 'AI_LOAD_FAILED'));
  }
});

// Helper functions
function calculateEfficiencyTrend(sensors, timeframe) {
  // Simplified trend calculation
  const days = parseInt(timeframe.replace('d', '')) || 7;
  // In a real implementation, you would analyze historical data
  return {
    direction: 'improving',
    change_percent: 2.5,
    period_days: days,
  };
}

function calculateNextMaintenance(unit) {
  if (!unit.aiOptimization?.predictiveMaintenance?.length) {
    return null;
  }

  const activeAlerts = unit.aiOptimization.predictiveMaintenance.filter(
    alert => alert.status === 'active'
  );

  if (activeAlerts.length === 0) {
    return null;
  }

  // Return the earliest predicted maintenance
  return activeAlerts.sort((a, b) =>
    new Date(a.predictedFailureDate) - new Date(b.predictedFailureDate)
  )[0].predictedFailureDate;
}

function calculateRiskLevel(unit) {
  const activeAlerts = unit.aiOptimization?.predictiveMaintenance?.filter(
    alert => alert.status === 'active'
  ) || [];

  const criticalAlerts = activeAlerts.filter(alert => alert.alertType === 'critical');

  if (criticalAlerts.length > 0) return 'high';
  if (activeAlerts.length > 2) return 'medium';
  return 'low';
}

function calculateCarbonCaptureTrend(sensors, timeframe) {
  // Simplified calculation
  return {
    direction: 'stable',
    change_percent: 0.8,
    period_days: parseInt(timeframe.replace('d', '')) || 7,
  };
}

function calculatePotentialAdditionalCapture(units) {
  return units.reduce((sum, unit) => {
    const suggestions = unit.aiOptimization?.optimizationSuggestions || [];
    const efficiencyGain = suggestions.reduce((gain, suggestion) =>
      gain + (suggestion.impact?.co2Increase || 0), 0
    );
    return sum + efficiencyGain;
  }, 0);
}

function generateNetworkRecommendations(units) {
  const recommendations = [];

  // Efficiency recommendations
  const avgEfficiency = units.reduce((sum, u) => sum + u.capacity.efficiency, 0) / units.length;
  if (avgEfficiency < 85) {
    recommendations.push({
      type: 'efficiency',
      title: 'Network Efficiency Optimization',
      description: `Average network efficiency is ${avgEfficiency.toFixed(1)}%. Consider implementing AI optimization across all units.`,
      impact: 'high',
      units_affected: units.filter(u => u.capacity.efficiency < 85).length,
    });
  }

  // Maintenance recommendations
  const unitsWithAlerts = units.filter(u =>
    u.aiOptimization?.predictiveMaintenance?.some(alert => alert.status === 'active')
  );

  if (unitsWithAlerts.length > 0) {
    recommendations.push({
      type: 'maintenance',
      title: 'Preventive Maintenance Schedule',
      description: `${unitsWithAlerts.length} units have active maintenance alerts. Schedule preventive maintenance to avoid downtime.`,
      impact: 'medium',
      units_affected: unitsWithAlerts.length,
    });
  }

  return recommendations;
}
