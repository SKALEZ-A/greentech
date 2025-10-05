import express from 'express';
import {
  getUnitPerformanceReport,
  getCreditReport,
  getNetworkOverviewReport,
  getEnvironmentalImpactReport,
  getComplianceReport,
  exportReport
} from '../controllers/reportController.js';

import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Unit performance reports
router.get('/units/:unitId/performance', getUnitPerformanceReport);

// Carbon credit reports
router.get('/credits', getCreditReport);

// Network overview reports
router.get('/network/overview', getNetworkOverviewReport);

// Environmental impact reports
router.get('/environmental/impact', getEnvironmentalImpactReport);

// Compliance reports
router.get('/compliance/status', getComplianceReport);

// Report export
router.get('/:reportId/export', exportReport);

export default router;