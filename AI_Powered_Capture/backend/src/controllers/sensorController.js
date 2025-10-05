import { asyncHandler } from '../middleware/errorHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import SensorData from '../models/SensorData.js';
import CarbonCaptureUnit from '../models/CarbonCaptureUnit.js';

// @desc    Get all sensors
// @route   GET /api/sensors
// @access  Private
export const getSensors = asyncHandler(async (req, res, next) => {
  // Build query
  let query = { isActive: true };

  // Filter by unit
  if (req.query.unitId) {
    query.unitId = req.query.unitId;
  }

  // Filter by type
  if (req.query.type) {
    query.type = req.query.type;
  }

  // Filter by status
  if (req.query.status) {
    query.status = req.query.status;
  }

  // Filter by health
  if (req.query.health) {
    query.health = req.query.health;
  }

  // Check unit permissions if filtering by unit
  if (req.query.unitId) {
    const unit = await CarbonCaptureUnit.findOne({ id: req.query.unitId });
    if (unit) {
      if (req.user.role !== 'admin' && unit.owner.toString() !== req.user.id) {
        const isOperator = unit.operators.some(op => op.user.toString() === req.user.id);
        if (!isOperator) {
          return next(new ApiError('Not authorized to access sensors for this unit', 403, 'NOT_AUTHORIZED'));
        }
      }
    }
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 25;
  const startIndex = (page - 1) * limit;

  // Sorting
  let sortOptions = {};
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    sortOptions = sortBy;
  } else {
    sortOptions = '-currentReading.timestamp';
  }

  const total = await SensorData.countDocuments(query);
  const sensors = await SensorData.find(query)
    .sort(sortOptions)
    .skip(startIndex)
    .limit(limit);

  // Pagination result
  const pagination = {
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    totalSensors: total,
    hasNext: page * limit < total,
    hasPrev: page > 1
  };

  res.status(200).json({
    success: true,
    count: sensors.length,
    pagination,
    data: sensors
  });
});

// @desc    Get single sensor
// @route   GET /api/sensors/:id
// @access  Private
export const getSensor = asyncHandler(async (req, res, next) => {
  const sensor = await SensorData.findOne({ sensorId: req.params.id });

  if (!sensor) {
    return next(new ApiError('Sensor not found', 404, 'SENSOR_NOT_FOUND'));
  }

  // Check permissions via unit
  const unit = await CarbonCaptureUnit.findOne({ id: sensor.unitId });
  if (unit) {
    if (req.user.role !== 'admin' && unit.owner.toString() !== req.user.id) {
      const isOperator = unit.operators.some(op => op.user.toString() === req.user.id);
      if (!isOperator) {
        return next(new ApiError('Not authorized to access this sensor', 403, 'NOT_AUTHORIZED'));
      }
    }
  }

  res.status(200).json({
    success: true,
    data: sensor
  });
});

// @desc    Create new sensor
// @route   POST /api/sensors
// @access  Private
export const createSensor = asyncHandler(async (req, res, next) => {
  const { unitId, sensorId, name, type } = req.body;

  if (!unitId || !sensorId || !name || !type) {
    return next(new ApiError('unitId, sensorId, name, and type are required', 400, 'VALIDATION_ERROR'));
  }

  // Check if unit exists and user has permission
  const unit = await CarbonCaptureUnit.findOne({ id: unitId });
  if (!unit) {
    return next(new ApiError('Unit not found', 404, 'UNIT_NOT_FOUND'));
  }

  if (req.user.role !== 'admin' && unit.owner.toString() !== req.user.id) {
    const isOperator = unit.operators.some(op =>
      op.user.toString() === req.user.id && op.permissions.includes('write')
    );
    if (!isOperator) {
      return next(new ApiError('Not authorized to create sensors for this unit', 403, 'NOT_AUTHORIZED'));
    }
  }

  // Check if sensor ID already exists
  const existingSensor = await SensorData.findOne({ sensorId });
  if (existingSensor) {
    return next(new ApiError('Sensor ID already exists', 400, 'DUPLICATE_SENSOR_ID'));
  }

  const sensor = await SensorData.create(req.body);

  // Add sensor to unit
  await CarbonCaptureUnit.findOneAndUpdate(
    { id: unitId },
    {
      $push: {
        sensors: {
          sensorId: sensor._id,
          type: sensor.type,
          location: sensor.location,
          isActive: sensor.isActive,
          lastReading: sensor.currentReading.timestamp,
          addedAt: new Date()
        }
      }
    }
  );

  res.status(201).json({
    success: true,
    data: sensor
  });
});

// @desc    Update sensor
// @route   PUT /api/sensors/:id
// @access  Private
export const updateSensor = asyncHandler(async (req, res, next) => {
  let sensor = await SensorData.findOne({ sensorId: req.params.id });

  if (!sensor) {
    return next(new ApiError('Sensor not found', 404, 'SENSOR_NOT_FOUND'));
  }

  // Check permissions via unit
  const unit = await CarbonCaptureUnit.findOne({ id: sensor.unitId });
  if (unit) {
    if (req.user.role !== 'admin' && unit.owner.toString() !== req.user.id) {
      const isOperator = unit.operators.some(op =>
        op.user.toString() === req.user.id && op.permissions.includes('write')
      );
      if (!isOperator) {
        return next(new ApiError('Not authorized to update this sensor', 403, 'NOT_AUTHORIZED'));
      }
    }
  }

  // Don't allow updating sensorId
  if (req.body.sensorId && req.body.sensorId !== sensor.sensorId) {
    return next(new ApiError('Cannot update sensor ID', 400, 'INVALID_UPDATE'));
  }

  sensor = await SensorData.findOneAndUpdate(
    { sensorId: req.params.id },
    req.body,
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    data: sensor
  });
});

// @desc    Delete sensor
// @route   DELETE /api/sensors/:id
// @access  Private
export const deleteSensor = asyncHandler(async (req, res, next) => {
  const sensor = await SensorData.findOne({ sensorId: req.params.id });

  if (!sensor) {
    return next(new ApiError('Sensor not found', 404, 'SENSOR_NOT_FOUND'));
  }

  // Check permissions via unit
  const unit = await CarbonCaptureUnit.findOne({ id: sensor.unitId });
  if (unit) {
    if (req.user.role !== 'admin' && unit.owner.toString() !== req.user.id) {
      const isOperator = unit.operators.some(op =>
        op.user.toString() === req.user.id && op.permissions.includes('admin')
      );
      if (!isOperator) {
        return next(new ApiError('Not authorized to delete this sensor', 403, 'NOT_AUTHORIZED'));
      }
    }
  }

  // Remove sensor from unit
  await CarbonCaptureUnit.findOneAndUpdate(
    { id: sensor.unitId },
    {
      $pull: {
        sensors: { sensorId: sensor._id }
      }
    }
  );

  await sensor.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Add sensor reading
// @route   POST /api/sensors/:id/readings
// @access  Private (Service or Admin)
export const addSensorReading = asyncHandler(async (req, res, next) => {
  const { value, quality, timestamp } = req.body;

  if (value === undefined || value === null) {
    return next(new ApiError('Sensor value is required', 400, 'VALIDATION_ERROR'));
  }

  const sensor = await SensorData.findOne({ sensorId: req.params.id });

  if (!sensor) {
    return next(new ApiError('Sensor not found', 404, 'SENSOR_NOT_FOUND'));
  }

  // Allow service accounts and admins to add readings
  if (req.user.role !== 'admin' && req.user.role !== 'service') {
    return next(new ApiError('Not authorized to add sensor readings', 403, 'NOT_AUTHORIZED'));
  }

  // Add reading
  await sensor.addReading(value, quality, timestamp ? new Date(timestamp) : undefined);

  // Update unit's sensor info
  await CarbonCaptureUnit.findOneAndUpdate(
    { id: sensor.unitId, 'sensors.sensorId': sensor._id },
    {
      $set: {
        'sensors.$.lastReading': sensor.currentReading.timestamp
      }
    }
  );

  res.status(200).json({
    success: true,
    message: 'Sensor reading added successfully',
    data: {
      sensorId: sensor.sensorId,
      value: sensor.currentReading.value,
      unit: sensor.currentReading.unit,
      timestamp: sensor.currentReading.timestamp,
      quality: sensor.currentReading.quality
    }
  });
});

// @desc    Get sensor readings
// @route   GET /api/sensors/:id/readings
// @access  Private
export const getSensorReadings = asyncHandler(async (req, res, next) => {
  const sensor = await SensorData.findOne({ sensorId: req.params.id });

  if (!sensor) {
    return next(new ApiError('Sensor not found', 404, 'SENSOR_NOT_FOUND'));
  }

  // Check permissions via unit
  const unit = await CarbonCaptureUnit.findOne({ id: sensor.unitId });
  if (unit) {
    if (req.user.role !== 'admin' && unit.owner.toString() !== req.user.id) {
      const isOperator = unit.operators.some(op => op.user.toString() === req.user.id);
      if (!isOperator) {
        return next(new ApiError('Not authorized to access this sensor', 403, 'NOT_AUTHORIZED'));
      }
    }
  }

  // Parse query parameters
  const limit = parseInt(req.query.limit, 10) || 100;
  const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
  const endDate = req.query.endDate ? new Date(req.query.endDate) : null;

  let readings = sensor.readings;

  // Filter by date range
  if (startDate || endDate) {
    readings = readings.filter(reading => {
      const readingDate = new Date(reading.timestamp);
      if (startDate && readingDate < startDate) return false;
      if (endDate && readingDate > endDate) return false;
      return true;
    });
  }

  // Sort by timestamp (newest first) and limit
  readings = readings
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);

  res.status(200).json({
    success: true,
    count: readings.length,
    sensor: {
      sensorId: sensor.sensorId,
      name: sensor.name,
      type: sensor.type,
      unit: sensor.currentReading.unit
    },
    data: readings
  });
});

// @desc    Get sensor statistics
// @route   GET /api/sensors/:id/stats
// @access  Private
export const getSensorStats = asyncHandler(async (req, res, next) => {
  const sensor = await SensorData.findOne({ sensorId: req.params.id });

  if (!sensor) {
    return next(new ApiError('Sensor not found', 404, 'SENSOR_NOT_FOUND'));
  }

  // Check permissions via unit
  const unit = await CarbonCaptureUnit.findOne({ id: sensor.unitId });
  if (unit) {
    if (req.user.role !== 'admin' && unit.owner.toString() !== req.user.id) {
      const isOperator = unit.operators.some(op => op.user.toString() === req.user.id);
      if (!isOperator) {
        return next(new ApiError('Not authorized to access this sensor', 403, 'NOT_AUTHORIZED'));
      }
    }
  }

  const stats = sensor.getStats();

  res.status(200).json({
    success: true,
    data: stats
  });
});

// @desc    Calibrate sensor
// @route   POST /api/sensors/:id/calibrate
// @access  Private
export const calibrateSensor = asyncHandler(async (req, res, next) => {
  const { calibratedBy, beforeValue, afterValue, offset, notes } = req.body;

  const sensor = await SensorData.findOne({ sensorId: req.params.id });

  if (!sensor) {
    return next(new ApiError('Sensor not found', 404, 'SENSOR_NOT_FOUND'));
  }

  // Check permissions via unit
  const unit = await CarbonCaptureUnit.findOne({ id: sensor.unitId });
  if (unit) {
    if (req.user.role !== 'admin' && unit.owner.toString() !== req.user.id) {
      const isOperator = unit.operators.some(op =>
        op.user.toString() === req.user.id && op.permissions.includes('admin')
      );
      if (!isOperator) {
        return next(new ApiError('Not authorized to calibrate this sensor', 403, 'NOT_AUTHORIZED'));
      }
    }
  }

  await sensor.addCalibrationRecord({
    calibratedBy: calibratedBy || req.user.id,
    beforeValue,
    afterValue,
    offset,
    notes
  });

  res.status(200).json({
    success: true,
    message: 'Sensor calibrated successfully',
    data: {
      sensorId: sensor.sensorId,
      calibrationDate: sensor.specifications.calibrationDate,
      lastCalibration: sensor.maintenance.calibrationHistory.slice(-1)[0]
    }
  });
});

// @desc    Add maintenance record to sensor
// @route   POST /api/sensors/:id/maintenance
// @access  Private
export const addSensorMaintenance = asyncHandler(async (req, res, next) => {
  const { type, description, performedBy, cost, duration, parts, notes } = req.body;

  const sensor = await SensorData.findOne({ sensorId: req.params.id });

  if (!sensor) {
    return next(new ApiError('Sensor not found', 404, 'SENSOR_NOT_FOUND'));
  }

  // Check permissions via unit
  const unit = await CarbonCaptureUnit.findOne({ id: sensor.unitId });
  if (unit) {
    if (req.user.role !== 'admin' && unit.owner.toString() !== req.user.id) {
      const isOperator = unit.operators.some(op =>
        op.user.toString() === req.user.id && op.permissions.includes('admin')
      );
      if (!isOperator) {
        return next(new ApiError('Not authorized to maintain this sensor', 403, 'NOT_AUTHORIZED'));
      }
    }
  }

  await sensor.addMaintenanceRecord({
    type,
    description,
    performedBy: performedBy || req.user.id,
    cost,
    duration,
    parts,
    notes
  });

  res.status(200).json({
    success: true,
    message: 'Maintenance record added successfully'
  });
});

// @desc    Get sensors by type
// @route   GET /api/sensors/type/:type
// @access  Private
export const getSensorsByType = asyncHandler(async (req, res, next) => {
  const { type } = req.params;

  // Check if user has access to any units (for filtering)
  let unitIds = [];
  if (req.user.role !== 'admin') {
    const units = await CarbonCaptureUnit.find({
      $or: [
        { owner: req.user.id },
        { 'operators.user': req.user.id }
      ]
    }).select('id');
    unitIds = units.map(u => u.id);
  }

  const query = { type, isActive: true };
  if (unitIds.length > 0) {
    query.unitId = { $in: unitIds };
  }

  const sensors = await SensorData.find(query)
    .sort('-currentReading.timestamp');

  res.status(200).json({
    success: true,
    count: sensors.length,
    type,
    data: sensors
  });
});

// @desc    Get sensors needing maintenance
// @route   GET /api/sensors/maintenance/needed
// @access  Private
export const getSensorsNeedingMaintenance = asyncHandler(async (req, res, next) => {
  // Get units user has access to
  let unitIds = [];
  if (req.user.role !== 'admin') {
    const units = await CarbonCaptureUnit.find({
      $or: [
        { owner: req.user.id },
        { 'operators.user': req.user.id }
      ]
    }).select('id');
    unitIds = units.map(u => u.id);
  }

  const query = { isActive: true };
  if (unitIds.length > 0) {
    query.unitId = { $in: unitIds };
  }

  const sensors = await SensorData.getSensorsNeedingMaintenance();

  // Filter by accessible units
  const accessibleSensors = unitIds.length > 0
    ? sensors.filter(sensor => unitIds.includes(sensor.unitId))
    : sensors;

  res.status(200).json({
    success: true,
    count: accessibleSensors.length,
    data: accessibleSensors
  });
});

// @desc    Bulk update sensors
// @route   PUT /api/sensors/bulk
// @access  Private (Admin only)
export const bulkUpdateSensors = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new ApiError('Not authorized for bulk operations', 403, 'NOT_AUTHORIZED'));
  }

  const { sensorIds, updates } = req.body;

  if (!sensorIds || !Array.isArray(sensorIds) || sensorIds.length === 0) {
    return next(new ApiError('Sensor IDs array is required', 400, 'VALIDATION_ERROR'));
  }

  if (!updates || typeof updates !== 'object') {
    return next(new ApiError('Updates object is required', 400, 'VALIDATION_ERROR'));
  }

  // Validate restricted fields
  const restrictedFields = ['sensorId', 'createdAt'];
  const safeUpdates = { ...updates };
  restrictedFields.forEach(field => {
    delete safeUpdates[field];
  });

  const result = await SensorData.updateMany(
    { sensorId: { $in: sensorIds } },
    safeUpdates,
    { runValidators: true }
  );

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} sensors updated successfully`,
    data: {
      matched: result.matchedCount,
      modified: result.modifiedCount
    }
  });
});

// @desc    Get sensor health overview
// @route   GET /api/sensors/health/overview
// @access  Private
export const getSensorHealthOverview = asyncHandler(async (req, res, next) => {
  // Get units user has access to
  let unitIds = [];
  if (req.user.role !== 'admin') {
    const units = await CarbonCaptureUnit.find({
      $or: [
        { owner: req.user.id },
        { 'operators.user': req.user.id }
      ]
    }).select('id');
    unitIds = units.map(u => u.id);
  }

  const query = { isActive: true };
  if (unitIds.length > 0) {
    query.unitId = { $in: unitIds };
  }

  const sensors = await SensorData.find(query);

  const healthOverview = {
    total: sensors.length,
    healthy: sensors.filter(s => s.health === 'healthy').length,
    warning: sensors.filter(s => s.health === 'warning').length,
    critical: sensors.filter(s => s.health === 'critical').length,
    unknown: sensors.filter(s => s.health === 'unknown').length,
    withAlerts: sensors.filter(s => s.activeAlerts.length > 0).length,
    calibrationDue: sensors.filter(s => s.isCalibrationDue).length
  };

  res.status(200).json({
    success: true,
    data: healthOverview
  });
});
