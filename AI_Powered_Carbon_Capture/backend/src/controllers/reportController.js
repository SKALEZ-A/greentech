import { asyncHandler } from '../middleware/errorHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import CarbonCaptureUnit from '../models/CarbonCaptureUnit.js';
import SensorData from '../models/SensorData.js';
import CarbonCredit from '../models/CarbonCredit.js';
import User from '../models/User.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @desc    Get unit performance report
// @route   GET /api/reports/units/:unitId/performance
// @access  Private
export const getUnitPerformanceReport = asyncHandler(async (req, res, next) => {
  const { unitId } = req.params;
  const { timeframe = '30d', format = 'json' } = req.query;

  const unit = await CarbonCaptureUnit.findOne({ id: unitId })
    .populate('owner', 'name email organization');

  if (!unit) {
    return next(new ApiError('Unit not found', 404, 'UNIT_NOT_FOUND'));
  }

  // Check permissions
  if (req.user.role !== 'admin' && unit.owner._id.toString() !== req.user.id) {
    const isOperator = unit.operators.some(op => op.user.toString() === req.user.id);
    if (!isOperator) {
      return next(new ApiError('Not authorized to access this unit\'s reports', 403, 'NOT_AUTHORIZED'));
    }
  }

  // Get sensor data for the timeframe
  const days = parseInt(timeframe.replace('d', '')) || 30;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const sensors = await SensorData.find({
    unitId: unit.id,
    'currentReading.timestamp': { $gte: startDate }
  });

  // Calculate performance metrics
  const report = {
    unit: {
      id: unit.id,
      name: unit.name,
      owner: unit.owner.name,
      capacity: unit.capacity,
      technology: unit.technology
    },
    timeframe: {
      days,
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString()
    },
    performance: {
      efficiency: calculateEfficiencyMetrics(sensors, unit.capacity.efficiency),
      energyConsumption: calculateEnergyMetrics(sensors),
      carbonCapture: calculateCarbonCaptureMetrics(sensors, unit),
      sensorHealth: calculateSensorHealthMetrics(sensors)
    },
    alerts: unit.alerts.filter(alert =>
      new Date(alert.date) >= startDate && !alert.resolved
    ),
    aiOptimization: {
      suggestions: unit.aiOptimization.optimizationSuggestions.filter(s =>
        new Date(s.date) >= startDate
      ),
      maintenance: unit.aiOptimization.predictiveMaintenance.filter(m =>
        new Date(m.date) >= startDate
      )
    },
    generatedAt: new Date().toISOString()
  };

  if (format === 'json') {
    res.status(200).json({
      success: true,
      data: report
    });
  } else {
    // Generate PDF or other format (placeholder)
    res.status(200).json({
      success: true,
      message: 'Report generation started',
      format,
      reportId: `report_${Date.now()}`
    });
  }
});

// @desc    Get carbon credit report
// @route   GET /api/reports/credits
// @access  Private
export const getCreditReport = asyncHandler(async (req, res, next) => {
  const { timeframe = '30d', status = 'all', format = 'json' } = req.query;

  let query = {};

  // Filter by user access
  if (req.user.role !== 'admin') {
    query = {
      $or: [
        { currentOwner: req.user.id },
        { originalOwner: req.user.id }
      ]
    };
  }

  // Filter by status
  if (status === 'active') {
    query['retirement.isRetired'] = false;
    query.validUntil = { $gt: new Date() };
    query['verification.status'] = 'verified';
  } else if (status === 'retired') {
    query['retirement.isRetired'] = true;
  } else if (status === 'expired') {
    query.validUntil = { $lte: new Date() };
  }

  // Filter by timeframe
  const days = parseInt(timeframe.replace('d', '')) || 30;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  query.createdAt = { $gte: startDate };

  const credits = await CarbonCredit.find(query)
    .populate('currentOwner', 'name email')
    .populate('originalOwner', 'name email')
    .sort('-createdAt');

  // Calculate credit metrics
  const report = {
    summary: {
      totalCredits: credits.reduce((sum, c) => sum + c.amount, 0),
      availableCredits: credits.reduce((sum, c) => sum + c.availableAmount, 0),
      retiredCredits: credits.filter(c => c.retirement.isRetired)
                            .reduce((sum, c) => sum + c.amount, 0),
      expiredCredits: credits.filter(c => c.isExpired)
                             .reduce((sum, c) => sum + c.amount, 0),
      averagePrice: credits.filter(c => c.market.askingPrice)
                          .reduce((sum, c, _, arr) => sum + c.market.askingPrice / arr.length, 0)
    },
    byVintage: calculateCreditsByVintage(credits),
    byMethodology: calculateCreditsByMethodology(credits),
    byStatus: calculateCreditsByStatus(credits),
    transactions: calculateTransactionMetrics(credits),
    timeframe: {
      days,
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString()
    },
    generatedAt: new Date().toISOString()
  };

  if (format === 'json') {
    res.status(200).json({
      success: true,
      data: report
    });
  } else {
    // Generate PDF or other format (placeholder)
    res.status(200).json({
      success: true,
      message: 'Report generation started',
      format,
      reportId: `report_${Date.now()}`
    });
  }
});

// @desc    Get network overview report
// @route   GET /api/reports/network/overview
// @access  Private
export const getNetworkOverviewReport = asyncHandler(async (req, res, next) => {
  const { format = 'json' } = req.query;

  // Get accessible units
  let unitQuery = {};
  if (req.user.role !== 'admin') {
    unitQuery = {
      $or: [
        { owner: req.user.id },
        { 'operators.user': req.user.id }
      ]
    };
  }

  const units = await CarbonCaptureUnit.find(unitQuery);
  const unitIds = units.map(u => u.id);

  // Get sensors for these units
  const sensors = await SensorData.find({
    unitId: { $in: unitIds },
    isActive: true
  });

  // Get credits for these units
  const credits = await CarbonCredit.find({
    unitId: { $in: unitIds }
  });

  // Calculate network metrics
  const report = {
    network: {
      totalUnits: units.length,
      activeUnits: units.filter(u => u.status === 'active').length,
      totalCapacity: units.reduce((sum, u) => sum + u.capacity.co2PerDay, 0),
      averageEfficiency: units.reduce((sum, u) => sum + u.capacity.efficiency, 0) / units.length
    },
    performance: {
      totalCO2Captured: units.reduce((sum, u) => sum + u.environmental.co2Captured.total, 0),
      totalEnergyConsumption: units.reduce((sum, u) => sum + u.energyManagement.energyConsumption.monthlyTotal, 0),
      averageEfficiency: units.reduce((sum, u) => sum + u.capacity.efficiency, 0) / units.length,
      unitsNeedingMaintenance: units.filter(u => u.maintenance.maintenanceAlerts.some(a => !a.acknowledged)).length
    },
    credits: {
      totalCredits: credits.reduce((sum, c) => sum + c.amount, 0),
      availableCredits: credits.reduce((sum, c) => sum + c.availableAmount, 0),
      retiredCredits: credits.filter(c => c.retirement.isRetired).reduce((sum, c) => sum + c.amount, 0),
      listedCredits: credits.filter(c => c.market.listed).reduce((sum, c) => sum + c.availableAmount, 0)
    },
    sensors: {
      totalSensors: sensors.length,
      activeSensors: sensors.filter(s => s.status === 'active').length,
      sensorsWithAlerts: sensors.filter(s => s.activeAlerts.length > 0).length,
      averageDataQuality: sensors.reduce((sum, s) => sum + s.dataQuality.overall, 0) / sensors.length
    },
    alerts: {
      totalAlerts: units.reduce((sum, u) => sum + u.alerts.filter(a => !a.resolved).length, 0),
      criticalAlerts: units.reduce((sum, u) => sum + u.alerts.filter(a => a.severity === 'critical' && !a.resolved).length, 0),
      acknowledgedAlerts: units.reduce((sum, u) => sum + u.alerts.filter(a => a.acknowledged && !a.resolved).length, 0)
    },
    generatedAt: new Date().toISOString()
  };

  if (format === 'json') {
    res.status(200).json({
      success: true,
      data: report
    });
  } else {
    // Generate PDF or other format (placeholder)
    res.status(200).json({
      success: true,
      message: 'Report generation started',
      format,
      reportId: `report_${Date.now()}`
    });
  }
});

// @desc    Get environmental impact report
// @route   GET /api/reports/environmental/impact
// @access  Private
export const getEnvironmentalImpactReport = asyncHandler(async (req, res, next) => {
  const { timeframe = '365d', format = 'json' } = req.query;

  // Get accessible units
  let unitQuery = {};
  if (req.user.role !== 'admin') {
    unitQuery = {
      $or: [
        { owner: req.user.id },
        { 'operators.user': req.user.id }
      ]
    };
  }

  const units = await CarbonCaptureUnit.find(unitQuery);
  const unitIds = units.map(u => u.id);

  // Get credits for environmental impact calculation
  const credits = await CarbonCredit.find({
    unitId: { $in: unitIds },
    'verification.status': 'verified'
  });

  // Calculate environmental metrics
  const days = parseInt(timeframe.replace('d', '')) || 365;
  const report = {
    timeframe: {
      days,
      period: days <= 30 ? 'monthly' : days <= 365 ? 'yearly' : 'multi-year'
    },
    carbonMetrics: {
      totalCO2Captured: credits.reduce((sum, c) => sum + c.environmental.co2Captured, 0),
      totalCO2Equivalent: credits.reduce((sum, c) => sum + c.environmental.co2Equivalent, 0),
      averagePermanence: credits.reduce((sum, c) => sum + c.environmental.permanence, 0) / credits.length,
      creditsByMethodology: calculateCreditsByMethodology(credits),
      sequestrationRate: calculateSequestrationRate(credits, days)
    },
    energyMetrics: {
      totalEnergyConsumption: units.reduce((sum, u) => sum + u.energyManagement.energyConsumption.monthlyTotal, 0),
      renewableEnergyUsage: units.reduce((sum, u) => sum + u.energyManagement.energyConsumption.monthlyTotal * (u.energyManagement.renewableEnergyUsage / 100), 0),
      carbonIntensity: calculateCarbonIntensity(units, credits),
      energyEfficiency: units.reduce((sum, u) => sum + u.capacity.efficiency, 0) / units.length
    },
    impactMetrics: {
      avoidedEmissions: credits.reduce((sum, c) => sum + c.environmental.co2Captured, 0),
      netZeroProgress: calculateNetZeroProgress(units, credits),
      sustainabilityScore: calculateSustainabilityScore(units, credits),
      lifecycleAssessment: calculateLifecycleAssessment(units)
    },
    generatedAt: new Date().toISOString()
  };

  if (format === 'json') {
    res.status(200).json({
      success: true,
      data: report
    });
  } else {
    // Generate PDF or other format (placeholder)
    res.status(200).json({
      success: true,
      message: 'Report generation started',
      format,
      reportId: `report_${Date.now()}`
    });
  }
});

// @desc    Get compliance report
// @route   GET /api/reports/compliance
// @access  Private
export const getComplianceReport = asyncHandler(async (req, res, next) => {
  const { format = 'json' } = req.query;

  // Get accessible units
  let unitQuery = {};
  if (req.user.role !== 'admin') {
    unitQuery = {
      $or: [
        { owner: req.user.id },
        { 'operators.user': req.user.id }
      ]
    };
  }

  const units = await CarbonCaptureUnit.find(unitQuery);

  // Calculate compliance metrics
  const report = {
    overallCompliance: {
      totalUnits: units.length,
      compliantUnits: units.filter(u => u.compliance.complianceScore >= 80).length,
      averageComplianceScore: units.reduce((sum, u) => sum + u.compliance.complianceScore, 0) / units.length,
      unitsWithValidPermits: units.filter(u => u.compliance.permits.some(p => p.status === 'active')).length,
      unitsWithValidCertifications: units.filter(u => u.compliance.certifications.some(c => c.status === 'active')).length
    },
    certifications: {
      total: units.reduce((sum, u) => sum + u.compliance.certifications.length, 0),
      active: units.reduce((sum, u) => sum + u.compliance.certifications.filter(c => c.status === 'active').length, 0),
      expired: units.reduce((sum, u) => sum + u.compliance.certifications.filter(c => c.status === 'expired').length, 0),
      expiringSoon: units.reduce((sum, u) => sum + u.compliance.certifications.filter(c =>
        c.status === 'active' &&
        new Date(c.expiryDate) <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      ).length, 0)
    },
    permits: {
      total: units.reduce((sum, u) => sum + u.compliance.permits.length, 0),
      active: units.reduce((sum, u) => sum + u.compliance.permits.filter(p => p.status === 'active').length, 0),
      expired: units.reduce((sum, u) => sum + u.compliance.permits.filter(p => p.status === 'expired').length, 0),
      expiringSoon: units.reduce((sum, u) => sum + u.compliance.permits.filter(p =>
        p.status === 'active' &&
        new Date(p.expiryDate) <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      ).length, 0)
    },
    audits: {
      totalAudits: units.reduce((sum, u) => sum + (u.compliance.lastAudit ? 1 : 0), 0),
      recentAudits: units.filter(u =>
        u.compliance.lastAudit &&
        new Date(u.compliance.lastAudit) >= new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      ).length,
      upcomingAudits: units.filter(u =>
        u.compliance.nextAudit &&
        new Date(u.compliance.nextAudit) <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      ).length
    },
    recommendations: generateComplianceRecommendations(units),
    generatedAt: new Date().toISOString()
  };

  if (format === 'json') {
    res.status(200).json({
      success: true,
      data: report
    });
  } else {
    // Generate PDF or other format (placeholder)
    res.status(200).json({
      success: true,
      message: 'Report generation started',
      format,
      reportId: `report_${Date.now()}`
    });
  }
});

// @desc    Export report to file
// @route   GET /api/reports/:reportId/export
// @access  Private
export const exportReport = asyncHandler(async (req, res, next) => {
  const { reportId } = req.params;
  const { format = 'pdf' } = req.query;

  // In a real implementation, you would retrieve the report data
  // and generate the appropriate file format

  // For now, return a placeholder response
  res.status(200).json({
    success: true,
    message: `Report ${reportId} exported successfully`,
    format,
    downloadUrl: `/downloads/reports/${reportId}.${format}`
  });
});

// Helper functions
function calculateEfficiencyMetrics(sensors, baselineEfficiency) {
  const tempSensors = sensors.filter(s => s.type === 'temperature');
  const pressureSensors = sensors.filter(s => s.type === 'pressure');
  const flowSensors = sensors.filter(s => s.type === 'flow_rate');

  return {
    currentEfficiency: baselineEfficiency,
    temperatureRange: tempSensors.length > 0 ? {
      min: Math.min(...tempSensors.map(s => s.currentReading.value)),
      max: Math.max(...tempSensors.map(s => s.currentReading.value)),
      avg: tempSensors.reduce((sum, s) => sum + s.currentReading.value, 0) / tempSensors.length
    } : null,
    optimalOperatingRange: {
      temperature: { min: 20, max: 30 },
      pressure: { min: 45, max: 55 },
      flowRate: { min: 1000, max: 1400 }
    }
  };
}

function calculateEnergyMetrics(sensors) {
  const energySensors = sensors.filter(s => s.type === 'energy_consumption');

  if (energySensors.length === 0) return null;

  const values = energySensors.map(s => s.currentReading.value);

  return {
    currentConsumption: energySensors[0]?.currentReading.value || 0,
    averageConsumption: values.reduce((a, b) => a + b, 0) / values.length,
    peakConsumption: Math.max(...values),
    efficiency: values.length > 1 ? (values[values.length - 1] / values[0]) : 1
  };
}

function calculateCarbonCaptureMetrics(sensors, unit) {
  return {
    currentCapture: unit.environmental.co2Captured.thisMonth,
    monthlyTarget: unit.capacity.co2PerDay * 30,
    yearlyTarget: unit.capacity.co2PerDay * 365,
    efficiency: unit.capacity.efficiency
  };
}

function calculateSensorHealthMetrics(sensors) {
  return {
    totalSensors: sensors.length,
    activeSensors: sensors.filter(s => s.status === 'active').length,
    sensorsWithAlerts: sensors.filter(s => s.activeAlerts.length > 0).length,
    averageDataQuality: sensors.reduce((sum, s) => sum + s.dataQuality.overall, 0) / sensors.length,
    calibrationDue: sensors.filter(s => s.isCalibrationDue).length
  };
}

function calculateCreditsByVintage(credits) {
  const byVintage = {};
  credits.forEach(credit => {
    if (!byVintage[credit.vintage]) {
      byVintage[credit.vintage] = 0;
    }
    byVintage[credit.vintage] += credit.amount;
  });
  return byVintage;
}

function calculateCreditsByMethodology(credits) {
  const byMethodology = {};
  credits.forEach(credit => {
    if (!byMethodology[credit.methodology]) {
      byMethodology[credit.methodology] = 0;
    }
    byMethodology[credit.methodology] += credit.amount;
  });
  return byMethodology;
}

function calculateCreditsByStatus(credits) {
  return {
    active: credits.filter(c => c.isActive).reduce((sum, c) => sum + c.availableAmount, 0),
    retired: credits.filter(c => c.retirement.isRetired).reduce((sum, c) => sum + c.amount, 0),
    expired: credits.filter(c => c.isExpired).reduce((sum, c) => sum + c.amount, 0),
    listed: credits.filter(c => c.market.listed).reduce((sum, c) => sum + c.availableAmount, 0)
  };
}

function calculateTransactionMetrics(credits) {
  const transactions = credits.flatMap(c => c.transferHistory);

  return {
    totalTransactions: transactions.length,
    totalVolume: transactions.reduce((sum, t) => sum + t.amount, 0),
    averageTransactionSize: transactions.length > 0 ?
      transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length : 0,
    byType: {
      sale: transactions.filter(t => t.transactionType === 'sale').length,
      transfer: transactions.filter(t => t.transactionType === 'transfer').length,
      retirement: transactions.filter(t => t.transactionType === 'retirement').length
    }
  };
}

function calculateSequestrationRate(credits, days) {
  const totalCaptured = credits.reduce((sum, c) => sum + c.environmental.co2Captured, 0);
  const daysActive = credits.length > 0 ? days : 1; // Avoid division by zero

  return totalCaptured / daysActive; // tons per day
}

function calculateCarbonIntensity(units, credits) {
  const totalEnergy = units.reduce((sum, u) => sum + u.energyManagement.energyConsumption.monthlyTotal, 0);
  const totalCO2 = credits.reduce((sum, c) => sum + c.environmental.co2Captured, 0);

  return totalEnergy > 0 ? (totalCO2 / totalEnergy) * 1000 : 0; // kg CO2/MWh
}

function calculateNetZeroProgress(units, credits) {
  // Simplified calculation - in reality this would be more complex
  const capturedCO2 = credits.reduce((sum, c) => sum + c.environmental.co2Captured, 0);
  const operationalCO2 = units.reduce((sum, u) => sum + (u.environmental.emissions?.scope1 || 0), 0);

  return operationalCO2 > 0 ? (capturedCO2 / operationalCO2) * 100 : 0; // percentage
}

function calculateSustainabilityScore(units, credits) {
  // Multi-factor sustainability score
  const efficiencyScore = units.reduce((sum, u) => sum + u.capacity.efficiency, 0) / units.length;
  const renewableScore = units.reduce((sum, u) => sum + u.energyManagement.renewableEnergyUsage, 0) / units.length;
  const complianceScore = units.reduce((sum, u) => sum + u.compliance.complianceScore, 0) / units.length;

  return (efficiencyScore * 0.4 + renewableScore * 0.3 + complianceScore * 0.3);
}

function calculateLifecycleAssessment(units) {
  // Simplified LCA calculation
  return {
    carbonFootprint: units.reduce((sum, u) => sum + u.capacity.co2PerDay * 0.1, 0), // 10% of annual capacity
    energyPaybackTime: 2.5, // years
    waterUsage: units.reduce((sum, u) => sum + u.environmental.waterUsage * u.capacity.co2PerDay, 0),
    landUse: units.reduce((sum, u) => sum + u.environmental.landUse, 0)
  };
}

function generateComplianceRecommendations(units) {
  const recommendations = [];

  const expiredPermits = units.filter(u =>
    u.compliance.permits.some(p => p.status === 'expired')
  );

  if (expiredPermits.length > 0) {
    recommendations.push({
      type: 'permit',
      priority: 'high',
      message: `${expiredPermits.length} units have expired permits that need renewal`
    });
  }

  const expiringSoon = units.filter(u =>
    u.compliance.certifications.some(c =>
      c.status === 'active' &&
      new Date(c.expiryDate) <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    )
  );

  if (expiringSoon.length > 0) {
    recommendations.push({
      type: 'certification',
      priority: 'medium',
      message: `${expiringSoon.length} units have certifications expiring within 90 days`
    });
  }

  return recommendations;
}