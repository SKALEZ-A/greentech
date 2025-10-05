import express from 'express';
import {
  getCredits,
  getCredit,
  createCredit,
  transferCredit,
  retireCredit,
  listCredit,
  delistCredit,
  placeBid,
  acceptBid,
  getMarketplace,
  getCreditStats,
  verifyCredit,
  getCreditsByVintage,
  getExpiringCredits
} from '../controllers/creditController.js';

import { authMiddleware, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Carbon credit CRUD operations
router.route('/')
  .get(getCredits)
  .post(authorize('admin', 'operator'), createCredit);

router.route('/:id')
  .get(getCredit);

// Credit actions
router.post('/:id/transfer', transferCredit);
router.post('/:id/retire', retireCredit);

// Marketplace operations
router.post('/:id/list', listCredit);
router.post('/:id/delist', delistCredit);
router.post('/:id/bid', placeBid);
router.post('/:id/bids/:bidId/accept', acceptBid);

// Marketplace and statistics
router.get('/marketplace/listings', getMarketplace);
router.get('/stats/overview', getCreditStats);

// Admin operations
router.post('/:id/verify', authorize('admin'), verifyCredit);

// Query operations
router.get('/vintage/:year', getCreditsByVintage);
router.get('/expiring/soon', getExpiringCredits);

export default router;