import crypto from 'crypto';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ValidationError } from '../middleware/errorHandler.js';
import { AuthorizationError } from '../middleware/errorHandler.js';
import User from '../models/User.js';
import { generateToken } from '../middleware/auth.js';

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const register = asyncHandler(async (req, res, next) => {
  const { name, email, password, organization, phone, role } = req.body;

  // Validation
  if (!name || !email || !password) {
    return next(new ValidationError('Please provide name, email, and password'));
  }

  // Check if user exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return next(new ValidationError('User already exists with this email'));
  }

  // Create user
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    organization,
    phone,
    role: role || 'user' // Default to user role
  });

  // Generate token
  const token = generateToken(user._id);

  res.status(201).json({
    success: true,
    token,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization: user.organization,
        isVerified: user.isVerified,
        createdAt: user.createdAt
      }
    }
  });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = asyncHandler(async (req, res, next) => {
  const { email, username, password } = req.body;

  // Check for email or username
  const loginField = email || username;
  if (!loginField || !password) {
    return next(new ValidationError('Please provide email/username and password'));
  }

  // Check for user
  const user = await User.findOne({
    $or: [
      { email: loginField.toLowerCase() },
      { email: loginField } // In case it's already lowercase
    ]
  }).select('+password');

  if (!user) {
    return next(new ValidationError('Invalid credentials'));
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return next(new ValidationError('Invalid credentials'));
  }

  // Check if account is active
  if (!user.isActive) {
    return next(new ValidationError('Account is deactivated'));
  }

  // Check if account is locked
  if (user.isLocked) {
    return next(new ValidationError('Account is temporarily locked due to too many failed login attempts'));
  }

  // Update login info
  user.lastLogin = new Date();
  user.loginCount += 1;
  await user.save();

  // Generate token
  const token = generateToken(user._id);

  res.status(200).json({
    success: true,
    token,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization: user.organization,
        avatar: user.avatar,
        isVerified: user.isVerified,
        lastLogin: user.lastLogin,
        loginCount: user.loginCount
      }
    }
  });
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization: user.organization,
        phone: user.phone,
        avatar: user.avatar,
        isVerified: user.isVerified,
        preferences: user.preferences,
        carbonCredits: user.carbonCredits,
        businessInfo: user.businessInfo,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    }
  });
});

// @desc    Update user details
// @route   PUT /api/auth/me
// @access  Private
export const updateDetails = asyncHandler(async (req, res, next) => {
  const fieldsToUpdate = {
    name: req.body.name,
    organization: req.body.organization,
    phone: req.body.phone,
    avatar: req.body.avatar
  };

  // Remove undefined fields
  Object.keys(fieldsToUpdate).forEach(key =>
    fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
  );

  const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        organization: user.organization,
        phone: user.phone,
        avatar: user.avatar
      }
    }
  });
});

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
export const updatePassword = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('+password');

  // Check current password
  if (!(await user.matchPassword(req.body.currentPassword))) {
    return next(new ValidationError('Current password is incorrect'));
  }

  user.password = req.body.newPassword;
  await user.save();

  const token = generateToken(user._id);

  res.status(200).json({
    success: true,
    token,
    message: 'Password updated successfully'
  });
});

// @desc    Update user preferences
// @route   PUT /api/auth/preferences
// @access  Private
export const updatePreferences = asyncHandler(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { preferences: req.body.preferences },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    data: {
      preferences: user.preferences
    }
  });
});

// @desc    Forgot password
// @route   POST /api/auth/forgotpassword
// @access  Public
export const forgotPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase() });

  if (!user) {
    return next(new ValidationError('User not found with this email'));
  }

  // Get reset token
  const resetToken = user.getResetPasswordToken();

  await user.save({ validateBeforeSave: false });

  // In a real implementation, you would send an email here
  // For now, we'll just return the token (not recommended for production)
  console.log(`Password reset token for ${user.email}: ${resetToken}`);

  res.status(200).json({
    success: true,
    message: 'Password reset token generated',
    // Remove this in production - only for development
    resetToken
  });
});

// @desc    Reset password
// @route   PUT /api/auth/resetpassword/:resettoken
// @access  Public
export const resetPassword = asyncHandler(async (req, res, next) => {
  // Get hashed token
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(req.params.resettoken)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: resetPasswordToken,
    passwordResetExpires: { $gt: Date.now() }
  });

  if (!user) {
    return next(new ValidationError('Invalid or expired token'));
  }

  // Set new password
  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  const token = generateToken(user._id);

  res.status(200).json({
    success: true,
    token,
    message: 'Password reset successful'
  });
});

// @desc    Verify email
// @route   POST /api/auth/verifyemail
// @access  Public
export const verifyEmail = asyncHandler(async (req, res, next) => {
  const { token } = req.body;

  if (!token) {
    return next(new ValidationError('Verification token is required'));
  }

  // Get hashed token
  const emailVerificationToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  const user = await User.findOne({
    emailVerificationToken,
    emailVerificationExpires: { $gt: Date.now() }
  });

  if (!user) {
    return next(new ValidationError('Invalid or expired verification token'));
  }

  // Update user
  user.isVerified = true;
  user.emailVerifiedAt = new Date();
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Email verified successfully'
  });
});

// @desc    Resend email verification
// @route   POST /api/auth/resendverification
// @access  Private
export const resendVerification = asyncHandler(async (req, res, next) => {
  if (req.user.isVerified) {
    return next(new ValidationError('Email is already verified'));
  }

  // Get verification token
  const verificationToken = req.user.getEmailVerificationToken();

  await req.user.save({ validateBeforeSave: false });

  // In a real implementation, you would send an email here
  console.log(`Email verification token for ${req.user.email}: ${verificationToken}`);

  res.status(200).json({
    success: true,
    message: 'Verification email sent',
    // Remove this in production
    verificationToken
  });
});

// @desc    Enable two-factor authentication
// @route   POST /api/auth/enable2fa
// @access  Private
export const enable2FA = asyncHandler(async (req, res, next) => {
  // In a real implementation, you would generate a TOTP secret
  // and return a QR code for the user to scan
  const secret = 'dummy-secret-for-development';

  req.user.twoFactorEnabled = true;
  req.user.twoFactorSecret = secret;
  await req.user.save();

  res.status(200).json({
    success: true,
    message: 'Two-factor authentication enabled',
    secret: secret // In production, don't return the secret
  });
});

// @desc    Disable two-factor authentication
// @route   POST /api/auth/disable2fa
// @access  Private
export const disable2FA = asyncHandler(async (req, res, next) => {
  req.user.twoFactorEnabled = false;
  req.user.twoFactorSecret = undefined;
  await req.user.save();

  res.status(200).json({
    success: true,
    message: 'Two-factor authentication disabled'
  });
});

// @desc    Logout user / clear cookie
// @route   GET /api/auth/logout
// @access  Private
export const logout = asyncHandler(async (req, res, next) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    message: 'User logged out successfully'
  });
});

// @desc    Get user statistics
// @route   GET /api/auth/stats
// @access  Private (Admin only)
export const getUserStats = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new AuthorizationError('Not authorized to access user statistics'));
  }

  const stats = await User.getUserStats();

  // Additional statistics
  const recentUsers = await User.find()
    .sort('-createdAt')
    .limit(5)
    .select('name email createdAt isVerified');

  const userActivity = await User.aggregate([
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$lastActivity' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id': -1 } },
    { $limit: 30 }
  ]);

  res.status(200).json({
    success: true,
    data: {
      ...stats,
      recentUsers,
      userActivity
    }
  });
});

// @desc    Deactivate user account
// @route   DELETE /api/auth/deactivate
// @access  Private
export const deactivateAccount = asyncHandler(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, {
    isActive: false,
    deactivatedAt: new Date()
  });

  res.status(200).json({
    success: true,
    message: 'Account deactivated successfully'
  });
});

// @desc    Reactivate user account (Admin only)
// @route   PUT /api/auth/reactivate/:userId
// @access  Private (Admin only)
export const reactivateAccount = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new AuthorizationError('Not authorized to reactivate accounts'));
  }

  const user = await User.findByIdAndUpdate(req.params.userId, {
    isActive: true,
    deactivatedAt: null,
    failedLoginAttempts: 0,
    lockUntil: null
  }, { new: true });

  if (!user) {
    return next(new ValidationError('User not found'));
  }

  res.status(200).json({
    success: true,
    message: 'Account reactivated successfully',
    data: { user: { id: user._id, name: user.name, email: user.email, isActive: user.isActive } }
  });
});

// @desc    Generate API key
// @route   POST /api/auth/apikey
// @access  Private
export const generateApiKey = asyncHandler(async (req, res, next) => {
  const { name, permissions } = req.body;

  if (!name) {
    return next(new ValidationError('API key name is required'));
  }

  const apiKey = req.user.generateApiKey(name, permissions);

  res.status(201).json({
    success: true,
    message: 'API key generated successfully',
    data: {
      name,
      key: apiKey, // In production, only return this once
      permissions: permissions || ['read'],
      createdAt: new Date()
    }
  });
});

// @desc    List API keys
// @route   GET /api/auth/apikeys
// @access  Private
export const getApiKeys = asyncHandler(async (req, res, next) => {
  const apiKeys = req.user.apiKeys.map(key => ({
    name: key.name,
    permissions: key.permissions,
    lastUsed: key.lastUsed,
    createdAt: key.createdAt,
    isActive: key.isActive,
    expiresAt: key.expiresAt
  }));

  res.status(200).json({
    success: true,
    data: apiKeys
  });
});

// @desc    Revoke API key
// @route   DELETE /api/auth/apikey/:keyId
// @access  Private
export const revokeApiKey = asyncHandler(async (req, res, next) => {
  const keyIndex = req.user.apiKeys.findIndex(key => key._id.toString() === req.params.keyId);

  if (keyIndex === -1) {
    return next(new ValidationError('API key not found'));
  }

  req.user.apiKeys.splice(keyIndex, 1);
  await req.user.save();

  res.status(200).json({
    success: true,
    message: 'API key revoked successfully'
  });
});