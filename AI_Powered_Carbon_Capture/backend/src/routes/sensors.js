import express from 'express';
import {
  getSensors,
  getSensor,
  createSensor,
  updateSensor,
  deleteSensor,
  addSensorReading,
  getSensorReadings,
  getSensorStats,
  calibrateSensor,
  addSensorMaintenance,
  getSensorsByType,
  getSensorsNeedingMaintenance,
  bulkUpdateSensors,
  getSensorHealthOverview
} from '../controllers/sensorController.js';

import { authMiddleware, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Sensor CRUD operations
router.route('/')
  .get(getSensors)
  .post(authorize('admin', 'operator'), createSensor);

router.route('/:id')
  .get(getSensor)
  .put(authorize('admin', 'operator'), updateSensor)
  .delete(authorize('admin'), deleteSensor);

// Sensor readings
router.post('/:id/readings', authorize('admin', 'operator', 'service'), addSensorReading);
router.get('/:id/readings', getSensorReadings);

// Sensor statistics
router.get('/:id/stats', getSensorStats);

// Sensor calibration and maintenance
router.post('/:id/calibrate', authorize('admin', 'operator'), calibrateSensor);
router.post('/:id/maintenance', authorize('admin', 'operator'), addSensorMaintenance);

// Sensor queries by type
router.get('/type/:type', getSensorsByType);

// Maintenance related
router.get('/maintenance/needed', getSensorsNeedingMaintenance);

// Health overview
router.get('/health/overview', getSensorHealthOverview);

// Bulk operations (admin only)
router.put('/bulk', authorize('admin'), bulkUpdateSensors);

export default router;