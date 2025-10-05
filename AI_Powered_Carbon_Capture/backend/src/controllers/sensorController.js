import { asyncHandler } from '../middleware/errorHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import SensorData from '../models/SensorData.js';
import CarbonCaptureUnit from '../models/CarbonCaptureUnit.js';

// @desc    Get all sensors
// @route   GET /api/sensors
// @access  Private
export const getSensors = asyncHandler(async (req, res, next) => {
  // Build query
  let query = {};

  // Filter by unit ID
  if (req.query.unitId) {
    query.unitId = req.query.unitId;
  }

  // Filter by sensor type
  if (req.query.type) {
    query.sensorType = req.query.type;
  }

  // Filter by status
  if (req.query.status) {
    query.status = req.query.status;
  }

  // If not admin, only show sensors for user's units
  if (req.user.role !== 'admin') {
    const userUnits = await CarbonCaptureUnit.find({ owner: req.user.id }).select('id');
    const unitIds = userUnits.map(unit => unit.id);
    query.unitId = { $in: unitIds };
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 25;
  const startIndex = (page - 1) * limit;

  // Sorting
  let sort = {};
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    sort = sortBy;
  } else {
    sort = '-createdAt';
  }

  const total = await SensorData.countDocuments(query);

  const sensors = await SensorData.find(query)
    .sort(sort)
    .skip(startIndex)
    .limit(limit);

  // Pagination info
  const pagination = {
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    totalSensors: total,
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };

  res.status(200).json({
    success: true,
    count: sensors.length,
    pagination,
    data: sensors,
  });
});

// @desc    Get single sensor
// @route   GET /api/sensors/:id
// @access  Private
export const getSensor = asyncHandler(async (req, res, next) => {
  const sensor = await SensorData.findById(req.params.id);

  if (!sensor) {
    return next(new ApiError('Sensor not found', 404, 'SENSOR_NOT_FOUND'));
  }

  // Check if user has access to this sensor's unit
  if (req.user.role !== 'admin') {
    const unit = await CarbonCaptureUnit.findOne({ id: sensor.unitId });
    if (!unit || unit.owner.toString() !== req.user.id) {
      return next(new ApiError('Not authorized to access this sensor', 403, 'NOT_AUTHORIZED'));
    }
  }

  res.status(200).json({
    success: true,
    data: sensor,
  });
});

// @desc    Create new sensor
// @route   POST /api/sensors
// @access  Private
export const createSensor = asyncHandler(async (req, res, next) => {
  const { unitId } = req.body;

  // Verify unit exists and user has access
  const unit = await CarbonCaptureUnit.findOne({ id: unitId });

  if (!unit) {
    return next(new ApiError('Unit not found', 404, 'UNIT_NOT_FOUND'));
  }

  if (req.user.role !== 'admin' && unit.owner.toString() !== req.user.id) {
    return next(new ApiError('Not authorized to add sensors to this unit', 403, 'NOT_AUTHORIZED'));
  }

  // Generate sensor ID if not provided
  if (!req.body.sensorId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    req.body.sensorId = `SEN-${timestamp}-${random}`.toUpperCase();
  }

  const sensor = await SensorData.create(req.body);

  // Add sensor reference to unit
  unit.sensors.push({
    sensorId: sensor._id,
    type: sensor.sensorType,
    lastReading: {
      value: sensor.currentReading.temperature || 0,
      timestamp: sensor.currentReading.timestamp,
      quality: 'good',
    },
  });

  await unit.save();

  res.status(201).json({
    success: true,
    data: sensor,
  });
});

// @desc    Update sensor
// @route   PUT /api/sensors/:id
// @access  Private
export const updateSensor = asyncHandler(async (req, res, next) => {
  let sensor = await SensorData.findById(req.params.id);

  if (!sensor) {
    return next(new ApiError('Sensor not found', 404, 'SENSOR_NOT_FOUND'));
  }

  // Check access
  if (req.user.role !== 'admin') {
    const unit = await CarbonCaptureUnit.findOne({ id: sensor.unitId });
    if (!unit || unit.owner.toString() !== req.user.id) {
      return next(new ApiError('Not authorized to update this sensor', 403, 'NOT_AUTHORIZED'));
    }
  }

  // Don't allow updating critical fields
  const restrictedFields = ['sensorId', 'unitId', 'createdAt'];
  restrictedFields.forEach(field => delete req.body[field]);

  sensor = await SensorData.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: sensor,
  });
});

// @desc    Delete sensor
// @route   DELETE /api/sensors/:id
// @access  Private
export const deleteSensor = asyncHandler(async (req, res, next) => {
  const sensor = await SensorData.findById(req.params.id);

  if (!sensor) {
    return next(new ApiError('Sensor not found', 404, 'SENSOR_NOT_FOUND'));
  }

  // Check access
  if (req.user.role !== 'admin') {
    const unit = await CarbonCaptureUnit.findOne({ id: sensor.unitId });
    if (!unit || unit.owner.toString() !== req.user.id) {
      return next(new ApiError('Not authorized to delete this sensor', 403, 'NOT_AUTHORIZED'));
    }
  }

  // Remove sensor reference from unit
  await CarbonCaptureUnit.updateOne(
    { id: sensor.unitId },
    { $pull: { sensors: { sensorId: sensor._id } } }
  );

  await sensor.remove();

  res.status(200).json({
    success: true,
    data: {},
    message: 'Sensor deleted successfully',
  });
});

// @desc    Add sensor reading
// @route   POST /api/sensors/:id/reading
// @access  Private
export const addSensorReading = asyncHandler(async (req, res, next) => {
  const sensor = await SensorData.findById(req.params.id);

  if (!sensor) {
    return next(new ApiError('Sensor not found', 404, 'SENSOR_NOT_FOUND'));
  }

  // Check access
  if (req.user.role !== 'admin') {
    const unit = await CarbonCaptureUnit.findOne({ id: sensor.unitId });
    if (!unit || unit.owner.toString() !== req.user.id) {
      return next(new ApiError('Not authorized to update this sensor', 403, 'NOT_AUTHORIZED'));
    }
  }

  // Validate reading data
  const reading = req.body;
  if (!reading.timestamp) {
    reading.timestamp = new Date();
  }

  await sensor.addReading(reading);

  // Update unit's sensor reference
  const unit = await CarbonCaptureUnit.findOne({ id: sensor.unitId });
  if (unit) {
    const sensorRef = unit.sensors.find(s => s.sensorId.toString() === sensor._id.toString());
    if (sensorRef) {
      sensorRef.lastReading = {
        value: reading.temperature || reading.co2Concentration || 0,
        timestamp: reading.timestamp,
        quality: sensor.qualityMetrics.dataIntegrity > 80 ? 'good' : 'warning',
      };
      await unit.save();
    }
  }

  res.status(200).json({
    success: true,
    data: sensor,
    message: 'Sensor reading added successfully',
  });
});

// @desc    Get sensor readings
// @route   GET /api/sensors/:id/readings
// @access  Private
export const getSensorReadings = asyncHandler(async (req, res, next) => {
  const sensor = await SensorData.findById(req.params.id);

  if (!sensor) {
    return next(new ApiError('Sensor not found', 404, 'SENSOR_NOT_FOUND'));
  }

  // Check access
  if (req.user.role !== 'admin') {
    const unit = await CarbonCaptureUnit.findOne({ id: sensor.unitId });
    if (!unit || unit.owner.toString() !== req.user.id) {
      return next(new ApiError('Not authorized to access this sensor', 403, 'NOT_AUTHORIZED'));
    }
  }

  // Pagination for historical readings
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  const startIndex = (page - 1) * limit;

  // Time range filter
  let timeFilter = {};
  if (req.query.startDate) {
    timeFilter.$gte = new Date(req.query.startDate);
  }
  if (req.query.endDate) {
    timeFilter.$lte = new Date(req.query.endDate);
  }

  let readings = sensor.historicalReadings;

  // Apply time filter
  if (Object.keys(timeFilter).length > 0) {
    readings = readings.filter(reading => {
      const readingTime = new Date(reading.timestamp);
      return (!timeFilter.$gte || readingTime >= timeFilter.$gte) &&
             (!timeFilter.$lte || readingTime <= timeFilter.$lte);
    });
  }

  // Sort by timestamp (newest first)
  readings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Apply pagination
  const paginatedReadings = readings.slice(startIndex, startIndex + limit);

  res.status(200).json({
    success: true,
    count: paginatedReadings.length,
    total: readings.length,
    currentReading: sensor.currentReading,
    data: paginatedReadings,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(readings.length / limit),
      hasNext: (page * limit) < readings.length,
      hasPrev: page > 1,
    },
  });
});

// @desc    Get sensor alerts
// @route   GET /api/sensors/:id/alerts
// @access  Private
export const getSensorAlerts = asyncHandler(async (req, res, next) => {
  const sensor = await SensorData.findById(req.params.id);

  if (!sensor) {
    return next(new ApiError('Sensor not found', 404, 'SENSOR_NOT_FOUND'));
  }

  // Check access
  if (req.user.role !== 'admin') {
    const unit = await CarbonCaptureUnit.findOne({ id: sensor.unitId });
    if (!unit || unit.owner.toString() !== req.user.id) {
      return next(new ApiError('Not authorized to access this sensor', 403, 'NOT_AUTHORIZED'));
    }
  }

  // Filter alerts
  let alerts = sensor.alerts;

  if (req.query.status === 'active') {
    alerts = alerts.filter(alert => !alert.acknowledged);
  } else if (req.query.status === 'acknowledged') {
    alerts = alerts.filter(alert => alert.acknowledged);
  }

  // Sort by timestamp (newest first)
  alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  res.status(200).json({
    success: true,
    count: alerts.length,
    data: alerts,
  });
});

// @desc    Acknowledge sensor alert
// @route   PUT /api/sensors/:id/alerts/:alertId/acknowledge
// @access  Private
export const acknowledgeAlert = asyncHandler(async (req, res, next) => {
  const sensor = await SensorData.findById(req.params.id);

  if (!sensor) {
    return next(new ApiError('Sensor not found', 404, 'SENSOR_NOT_FOUND'));
  }

  // Check access
  if (req.user.role !== 'admin') {
    const unit = await CarbonCaptureUnit.findOne({ id: sensor.unitId });
    if (!unit || unit.owner.toString() !== req.user.id) {
      return next(new ApiError('Not authorized to update this sensor', 403, 'NOT_AUTHORIZED'));
    }
  }

  await sensor.acknowledgeAlert(req.params.alertId, req.user.id);

  res.status(200).json({
    success: true,
    message: 'Alert acknowledged successfully',
  });
});

// @desc    Calibrate sensor
// @route   POST /api/sensors/:id/calibrate
// @access  Private
export const calibrateSensor = asyncHandler(async (req, res, next) => {
  const sensor = await SensorData.findById(req.params.id);

  if (!sensor) {
    return next(new ApiError('Sensor not found', 404, 'SENSOR_NOT_FOUND'));
  }

  // Check access
  if (req.user.role !== 'admin') {
    const unit = await CarbonCaptureUnit.findOne({ id: sensor.unitId });
    if (!unit || unit.owner.toString() !== req.user.id) {
      return next(new ApiError('Not authorized to calibrate this sensor', 403, 'NOT_AUTHORIZED'));
    }
  }

  await sensor.calibrate();

  res.status(200).json({
    success: true,
    message: 'Sensor calibration started',
    data: sensor,
  });
});

// @desc    Complete sensor calibration
// @route   PUT /api/sensors/:id/calibrate/complete
// @access  Private
export const completeCalibration = asyncHandler(async (req, res, next) => {
  const sensor = await SensorData.findById(req.params.id);

  if (!sensor) {
    return next(new ApiError('Sensor not found', 404, 'SENSOR_NOT_FOUND'));
  }

  // Check access
  if (req.user.role !== 'admin') {
    const unit = await CarbonCaptureUnit.findOne({ id: sensor.unitId });
    if (!unit || unit.owner.toString() !== req.user.id) {
      return next(new ApiError('Not authorized to complete calibration for this sensor', 403, 'NOT_AUTHORIZED'));
    }
  }

  await sensor.completeCalibration();

  res.status(200).json({
    success: true,
    message: 'Sensor calibration completed',
    data: sensor,
  });
});

// @desc    Get sensor statistics
// @route   GET /api/sensors/stats
// @access  Private
export const getSensorStats = asyncHandler(async (req, res, next) => {
  let matchQuery = {};

  // If not admin, only include user's units
  if (req.user.role !== 'admin') {
    const userUnits = await CarbonCaptureUnit.find({ owner: req.user.id }).select('id');
    const unitIds = userUnits.map(unit => unit.id);
    matchQuery.unitId = { $in: unitIds };
  }

  const stats = await SensorData.getSensorStats(matchQuery.unitId ? null : undefined);

  res.status(200).json({
    success: true,
    data: stats,
  });
});
