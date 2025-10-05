import express from 'express';
import {
  getUnits,
  getUnit,
  createUnit,
  updateUnit,
  deleteUnit,
  addOperator,
  removeOperator,
  getUnitSensors,
  getUnitAlerts,
  acknowledgeAlert,
  getUnitStats,
  getUnitHealth,
  getSystemStats,
  bulkUpdateUnits
} from '../controllers/unitController.js';

import { authMiddleware, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Unit CRUD operations
router.route('/')
  .get(getUnits)
  .post(authorize('admin', 'operator'), createUnit);

router.route('/:id')
  .get(getUnit)
  .put(authorize('admin'), updateUnit)
  .delete(authorize('admin'), deleteUnit);

// Unit operators management
router.post('/:id/operators', authorize('admin'), addOperator);
router.delete('/:id/operators/:userId', authorize('admin'), removeOperator);

// Unit sensors
router.get('/:id/sensors', getUnitSensors);

// Unit alerts
router.get('/:id/alerts', getUnitAlerts);
router.put('/:id/alerts/:alertId/acknowledge', acknowledgeAlert);

// Unit statistics and health
router.get('/:id/stats', getUnitStats);
router.get('/:id/health', getUnitHealth);

// System-wide statistics (admin only)
router.get('/stats/system', authorize('admin'), getSystemStats);

// Bulk operations (admin only)
router.put('/bulk', authorize('admin'), bulkUpdateUnits);

export default router;