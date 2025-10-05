import { asyncHandler } from '../middleware/errorHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import CarbonCaptureUnit from '../models/CarbonCaptureUnit.js';
import SensorData from '../models/SensorData.js';
import User from '../models/User.js';

// @desc    Get all units
// @route   GET /api/units
// @access  Private
export const getUnits = asyncHandler(async (req, res, next) => {
  // Build query
  let query = {};

  // Filter by owner (users can only see their own units unless admin)
  if (req.user.role !== 'admin') {
    query.owner = req.user.id;
  }

  // Filter by status
  if (req.query.status) {
    query.status = req.query.status;
  }

  // Filter by location
  if (req.query.city) {
    query['location.city'] = new RegExp(req.query.city, 'i');
  }

  if (req.query.country) {
    query['location.country'] = new RegExp(req.query.country, 'i');
  }

  // Filter by technology
  if (req.query.technology) {
    query['technology.type'] = req.query.technology;
  }

  // Filter by efficiency range
  if (req.query.minEfficiency || req.query.maxEfficiency) {
    query['capacity.efficiency'] = {};
    if (req.query.minEfficiency) {
      query['capacity.efficiency'].$gte = parseFloat(req.query.minEfficiency);
    }
    if (req.query.maxEfficiency) {
      query['capacity.efficiency'].$lte = parseFloat(req.query.maxEfficiency);
    }
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;

  // Sorting
  let sortOptions = {};
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    sortOptions = sortBy;
  } else {
    sortOptions = '-createdAt';
  }

  const total = await CarbonCaptureUnit.countDocuments(query);
  const units = await CarbonCaptureUnit.find(query)
    .populate('owner', 'name email')
    .sort(sortOptions)
    .skip(startIndex)
    .limit(limit);

  // Pagination result
  const pagination = {
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    totalUnits: total,
    hasNext: page * limit < total,
    hasPrev: page > 1
  };

  res.status(200).json({
    success: true,
    count: units.length,
    pagination,
    data: units
  });
});

// @desc    Get single unit
// @route   GET /api/units/:id
// @access  Private
export const getUnit = asyncHandler(async (req, res, next) => {
  const unit = await CarbonCaptureUnit.findOne({ id: req.params.id })
    .populate('owner', 'name email organization')
    .populate('operators.user', 'name email')
    .populate('sensors.sensorId', 'name type status')
    .populate('aiOptimization.optimizationSuggestions.implementedBy', 'name')
    .populate('aiOptimization.predictiveMaintenance.resolvedBy', 'name')
    .populate('alerts.acknowledgedBy', 'name')
    .populate('alerts.resolvedBy', 'name');

  if (!unit) {
    return next(new ApiError('Unit not found', 404, 'UNIT_NOT_FOUND'));
  }

  // Check permissions
  if (req.user.role !== 'admin' && unit.owner.toString() !== req.user.id) {
    // Check if user is an operator
    const isOperator = unit.operators.some(op => op.user.toString() === req.user.id);
    if (!isOperator) {
      return next(new ApiError('Not authorized to access this unit', 403, 'NOT_AUTHORIZED'));
    }
  }

  res.status(200).json({
    success: true,
    data: unit
  });
});

// @desc    Create new unit
// @route   POST /api/units
// @access  Private (Admin or Operator)
export const createUnit = asyncHandler(async (req, res, next) => {
  // Add owner to req.body
  req.body.owner = req.user.id;

  // Generate unique unit ID if not provided
  if (!req.body.id) {
    const count = await CarbonCaptureUnit.countDocuments();
    req.body.id = `CC-${String(count + 1).padStart(4, '0')}`;
  }

  // Validate required fields
  const requiredFields = ['name', 'capacity'];
  for (const field of requiredFields) {
    if (!req.body[field]) {
      return next(new ApiError(`${field} is required`, 400, 'VALIDATION_ERROR'));
    }
  }

  // Validate capacity fields
  if (!req.body.capacity.co2PerDay || req.body.capacity.co2PerDay <= 0) {
    return next(new ApiError('Valid CO2 capture capacity is required', 400, 'VALIDATION_ERROR'));
  }

  const unit = await CarbonCaptureUnit.create(req.body);

  // Add unit to user's unit list
  await User.findByIdAndUpdate(req.user.id, {
    $push: {
      units: {
        unitId: unit._id,
        role: 'owner',
        permissions: ['read', 'write', 'admin', 'optimize']
      }
    }
  });

  res.status(201).json({
    success: true,
    data: unit
  });
});

// @desc    Update unit
// @route   PUT /api/units/:id
// @access  Private
export const updateUnit = asyncHandler(async (req, res, next) => {
  let unit = await CarbonCaptureUnit.findOne({ id: req.params.id });

  if (!unit) {
    return next(new ApiError('Unit not found', 404, 'UNIT_NOT_FOUND'));
  }

  // Check permissions
  if (req.user.role !== 'admin' && unit.owner.toString() !== req.user.id) {
    return next(new ApiError('Not authorized to update this unit', 403, 'NOT_AUTHORIZED'));
  }

  // Don't allow updating critical fields
  const restrictedFields = ['id', 'owner', 'createdAt'];
  restrictedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      delete req.body[field];
    }
  });

  unit = await CarbonCaptureUnit.findOneAndUpdate(
    { id: req.params.id },
    req.body,
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    data: unit
  });
});

// @desc    Delete unit
// @route   DELETE /api/units/:id
// @access  Private (Admin only)
export const deleteUnit = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new ApiError('Not authorized to delete units', 403, 'NOT_AUTHORIZED'));
  }

  const unit = await CarbonCaptureUnit.findOne({ id: req.params.id });

  if (!unit) {
    return next(new ApiError('Unit not found', 404, 'UNIT_NOT_FOUND'));
  }

  // Remove unit from all users' unit lists
  await User.updateMany(
    { 'units.unitId': unit._id },
    { $pull: { units: { unitId: unit._id } } }
  );

  // Delete associated sensors
  await SensorData.deleteMany({ unitId: unit.id });

  // Delete the unit
  await unit.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Add operator to unit
// @route   POST /api/units/:id/operators
// @access  Private
export const addOperator = asyncHandler(async (req, res, next) => {
  const unit = await CarbonCaptureUnit.findOne({ id: req.params.id });

  if (!unit) {
    return next(new ApiError('Unit not found', 404, 'UNIT_NOT_FOUND'));
  }

  // Check permissions
  if (req.user.role !== 'admin' && unit.owner.toString() !== req.user.id) {
    return next(new ApiError('Not authorized to manage operators', 403, 'NOT_AUTHORIZED'));
  }

  const { userId, role = 'secondary', permissions = ['read'] } = req.body;

  if (!userId) {
    return next(new ApiError('User ID is required', 400, 'VALIDATION_ERROR'));
  }

  // Check if user exists
  const user = await User.findById(userId);
  if (!user) {
    return next(new ApiError('User not found', 404, 'USER_NOT_FOUND'));
  }

  // Add operator to unit
  await unit.addOperator(userId, role, permissions);

  // Add unit to user's unit list
  await User.findByIdAndUpdate(userId, {
    $push: {
      units: {
        unitId: unit._id,
        role,
        permissions
      }
    }
  });

  res.status(200).json({
    success: true,
    message: 'Operator added successfully'
  });
});

// @desc    Remove operator from unit
// @route   DELETE /api/units/:id/operators/:userId
// @access  Private
export const removeOperator = asyncHandler(async (req, res, next) => {
  const unit = await CarbonCaptureUnit.findOne({ id: req.params.id });

  if (!unit) {
    return next(new ApiError('Unit not found', 404, 'UNIT_NOT_FOUND'));
  }

  // Check permissions
  if (req.user.role !== 'admin' && unit.owner.toString() !== req.user.id) {
    return next(new ApiError('Not authorized to manage operators', 403, 'NOT_AUTHORIZED'));
  }

  const userId = req.params.userId;

  // Remove operator from unit
  await unit.removeOperator(userId);

  // Remove unit from user's unit list
  await User.findByIdAndUpdate(userId, {
    $pull: { units: { unitId: unit._id } }
  });

  res.status(200).json({
    success: true,
    message: 'Operator removed successfully'
  });
});

// @desc    Get unit sensors
// @route   GET /api/units/:id/sensors
// @access  Private
export const getUnitSensors = asyncHandler(async (req, res, next) => {
  const unit = await CarbonCaptureUnit.findOne({ id: req.params.id });

  if (!unit) {
    return next(new ApiError('Unit not found', 404, 'UNIT_NOT_FOUND'));
  }

  // Check permissions
  if (req.user.role !== 'admin' && unit.owner.toString() !== req.user.id) {
    const isOperator = unit.operators.some(op => op.user.toString() === req.user.id);
    if (!isOperator) {
      return next(new ApiError('Not authorized to access this unit', 403, 'NOT_AUTHORIZED'));
    }
  }

  const sensors = await SensorData.find({ unitId: unit.id, isActive: true })
    .sort('-currentReading.timestamp');

  res.status(200).json({
    success: true,
    count: sensors.length,
    data: sensors
  });
});

// @desc    Get unit alerts
// @route   GET /api/units/:id/alerts
// @access  Private
export const getUnitAlerts = asyncHandler(async (req, res, next) => {
  const unit = await CarbonCaptureUnit.findOne({ id: req.params.id });

  if (!unit) {
    return next(new ApiError('Unit not found', 404, 'UNIT_NOT_FOUND'));
  }

  // Check permissions
  if (req.user.role !== 'admin' && unit.owner.toString() !== req.user.id) {
    const isOperator = unit.operators.some(op => op.user.toString() === req.user.id);
    if (!isOperator) {
      return next(new ApiError('Not authorized to access this unit', 403, 'NOT_AUTHORIZED'));
    }
  }

  const { status = 'all', severity, acknowledged } = req.query;

  let alerts = unit.alerts;

  // Filter by status
  if (status !== 'all') {
    alerts = alerts.filter(alert => alert.status === status);
  }

  // Filter by severity
  if (severity) {
    alerts = alerts.filter(alert => alert.severity === severity);
  }

  // Filter by acknowledged status
  if (acknowledged !== undefined) {
    const ackFilter = acknowledged === 'true';
    alerts = alerts.filter(alert => alert.acknowledged === ackFilter);
  }

  // Sort by date (newest first)
  alerts.sort((a, b) => new Date(b.date) - new Date(a.date));

  res.status(200).json({
    success: true,
    count: alerts.length,
    data: alerts
  });
});

// @desc    Acknowledge alert
// @route   PUT /api/units/:id/alerts/:alertId/acknowledge
// @access  Private
export const acknowledgeAlert = asyncHandler(async (req, res, next) => {
  const unit = await CarbonCaptureUnit.findOne({ id: req.params.id });

  if (!unit) {
    return next(new ApiError('Unit not found', 404, 'UNIT_NOT_FOUND'));
  }

  // Check permissions
  if (req.user.role !== 'admin' && unit.owner.toString() !== req.user.id) {
    const isOperator = unit.operators.some(op => op.user.toString() === req.user.id);
    if (!isOperator) {
      return next(new ApiError('Not authorized to manage alerts', 403, 'NOT_AUTHORIZED'));
    }
  }

  const alert = unit.alerts.id(req.params.alertId);
  if (!alert) {
    return next(new ApiError('Alert not found', 404, 'ALERT_NOT_FOUND'));
  }

  alert.acknowledged = true;
  alert.acknowledgedBy = req.user.id;
  alert.acknowledgedAt = new Date();

  await unit.save();

  res.status(200).json({
    success: true,
    message: 'Alert acknowledged successfully'
  });
});

// @desc    Get unit statistics
// @route   GET /api/units/:id/stats
// @access  Private
export const getUnitStats = asyncHandler(async (req, res, next) => {
  const unit = await CarbonCaptureUnit.findOne({ id: req.params.id });

  if (!unit) {
    return next(new ApiError('Unit not found', 404, 'UNIT_NOT_FOUND'));
  }

  // Check permissions
  if (req.user.role !== 'admin' && unit.owner.toString() !== req.user.id) {
    const isOperator = unit.operators.some(op => op.user.toString() === req.user.id);
    if (!isOperator) {
      return next(new ApiError('Not authorized to access this unit', 403, 'NOT_AUTHORIZED'));
    }
  }

  const stats = unit.getStats();

  // Get additional sensor stats
  const sensors = await SensorData.find({ unitId: unit.id, isActive: true });
  const sensorStats = {
    total: sensors.length,
    active: sensors.filter(s => s.status === 'active').length,
    withAlerts: sensors.filter(s => s.activeAlerts.length > 0).length
  };

  stats.sensors = sensorStats;

  res.status(200).json({
    success: true,
    data: stats
  });
});

// @desc    Get unit health check
// @route   GET /api/units/:id/health
// @access  Private
export const getUnitHealth = asyncHandler(async (req, res, next) => {
  const unit = await CarbonCaptureUnit.findOne({ id: req.params.id });

  if (!unit) {
    return next(new ApiError('Unit not found', 404, 'UNIT_NOT_FOUND'));
  }

  // Check permissions
  if (req.user.role !== 'admin' && unit.owner.toString() !== req.user.id) {
    const isOperator = unit.operators.some(op => op.user.toString() === req.user.id);
    if (!isOperator) {
      return next(new ApiError('Not authorized to access this unit', 403, 'NOT_AUTHORIZED'));
    }
  }

  const health = unit.checkHealth();

  res.status(200).json({
    success: true,
    data: health
  });
});

// @desc    Get system-wide unit statistics
// @route   GET /api/units/stats/system
// @access  Private (Admin only)
export const getSystemStats = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new ApiError('Not authorized to access system statistics', 403, 'NOT_AUTHORIZED'));
  }

  const systemStats = await CarbonCaptureUnit.getSystemStats();

  // Get additional statistics
  const maintenanceNeeded = await CarbonCaptureUnit.getUnitsNeedingMaintenance();
  const highEfficiency = await CarbonCaptureUnit.getHighEfficiencyUnits();

  systemStats.unitsNeedingMaintenance = maintenanceNeeded.length;
  systemStats.highEfficiencyUnits = highEfficiency.length;

  res.status(200).json({
    success: true,
    data: systemStats
  });
});

// @desc    Bulk update units
// @route   PUT /api/units/bulk
// @access  Private (Admin only)
export const bulkUpdateUnits = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new ApiError('Not authorized for bulk operations', 403, 'NOT_AUTHORIZED'));
  }

  const { unitIds, updates } = req.body;

  if (!unitIds || !Array.isArray(unitIds) || unitIds.length === 0) {
    return next(new ApiError('Unit IDs array is required', 400, 'VALIDATION_ERROR'));
  }

  if (!updates || typeof updates !== 'object') {
    return next(new ApiError('Updates object is required', 400, 'VALIDATION_ERROR'));
  }

  // Validate restricted fields
  const restrictedFields = ['id', 'owner', 'createdAt'];
  const safeUpdates = { ...updates };
  restrictedFields.forEach(field => {
    delete safeUpdates[field];
  });

  const result = await CarbonCaptureUnit.updateMany(
    { id: { $in: unitIds } },
    safeUpdates,
    { runValidators: true }
  );

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} units updated successfully`,
    data: {
      matched: result.matchedCount,
      modified: result.modifiedCount
    }
  });
});