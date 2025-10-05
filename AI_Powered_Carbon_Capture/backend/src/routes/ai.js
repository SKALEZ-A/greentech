import express from 'express';
import {
  optimizeUnit,
  getAIModelHealth,
  trainAIModel,
  getUnitAnalytics,
  getNetworkInsights,
  saveAIModels,
  loadAIModels
} from '../controllers/aiController.js';

import { authMiddleware, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// AI optimization
router.post('/optimize/:unitId', optimizeUnit);

// AI model management
router.get('/health', getAIModelHealth);
router.post('/train/:modelType', authorize('admin'), trainAIModel);
router.post('/models/save', authorize('admin'), saveAIModels);
router.post('/models/load', authorize('admin'), loadAIModels);

// Analytics and insights
router.get('/analytics/:unitId', getUnitAnalytics);
router.get('/insights', getNetworkInsights);

export default router;