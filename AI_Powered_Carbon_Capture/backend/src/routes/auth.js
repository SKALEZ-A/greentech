import express from 'express';
import {
  register,
  login,
  getMe,
  updateDetails,
  updatePassword,
  updatePreferences,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  enable2FA,
  disable2FA,
  logout,
  getUserStats,
  deactivateAccount,
  reactivateAccount,
  generateApiKey,
  getApiKeys,
  revokeApiKey
} from '../controllers/authController.js';

import { authMiddleware, authorize, validatePasswordStrength } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', validatePasswordStrength, register);
router.post('/login', login);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resettoken', validatePasswordStrength, resetPassword);

// Protected routes
router.use(authMiddleware); // All routes below require authentication

router.get('/me', getMe);
router.put('/me', updateDetails);
router.put('/updatepassword', validatePasswordStrength, updatePassword);
router.put('/preferences', updatePreferences);
router.post('/verifyemail', verifyEmail);
router.post('/resendverification', resendVerification);
router.post('/enable2fa', enable2FA);
router.post('/disable2fa', disable2FA);
router.get('/logout', logout);
router.delete('/deactivate', deactivateAccount);

// API Key management
router.post('/apikey', generateApiKey);
router.get('/apikeys', getApiKeys);
router.delete('/apikey/:keyId', revokeApiKey);

// Admin only routes
router.get('/stats', authorize('admin'), getUserStats);
router.put('/reactivate/:userId', authorize('admin'), reactivateAccount);

export default router;