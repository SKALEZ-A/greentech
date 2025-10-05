import jwt from 'jsonwebtoken';
import { asyncHandler } from './errorHandler.js';
import { AuthenticationError, AuthorizationError } from './errorHandler.js';
import User from '../models/User.js';

// Generate JWT token
export const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'default-secret', {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

// Protect routes - require authentication
export const authMiddleware = asyncHandler(async (req, res, next) => {
  let token;

  // Check for token in header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Check for token in cookies
  if (!token && req.cookies.token) {
    token = req.cookies.token;
  }

  // Make sure token exists
  if (!token) {
    return next(new AuthenticationError('Not authorized to access this route'));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');

    // Get user from token
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return next(new AuthenticationError('No user found with this token'));
    }

    // Check if user is active
    if (!user.isActive) {
      return next(new AuthenticationError('User account is deactivated'));
    }

    req.user = user;
    next();
  } catch (err) {
    return next(new AuthenticationError('Not authorized to access this route'));
  }
});

// Grant access to specific roles
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AuthorizationError(`User role ${req.user.role} is not authorized to access this route`));
    }
    next();
  };
};

// Check resource ownership
export const checkOwnership = (resourceField = 'user') => {
  return asyncHandler(async (req, res, next) => {
    const resourceId = req.params.id || req.params.unitId || req.params.userId;

    if (!resourceId) {
      return next();
    }

    // Admin can access all resources
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user owns the resource
    // This will be implemented based on the specific model
    const resource = await getResourceById(req.baseUrl, resourceId);

    if (!resource) {
      return next(new NotFoundError('Resource'));
    }

    if (resource[resourceField].toString() !== req.user.id) {
      return next(new AuthorizationError('Not authorized to access this resource'));
    }

    req.resource = resource;
    next();
  });
};

// Get resource by ID based on route
const getResourceById = async (baseUrl, resourceId) => {
  const routeMap = {
    '/api/units': 'CarbonCaptureUnit',
    '/api/sensors': 'SensorData',
    '/api/credits': 'CarbonCredit',
    '/api/reports': 'Report'
  };

  const modelName = routeMap[baseUrl];
  if (!modelName) {
    return null;
  }

  // Dynamic import of models
  const models = {
    'CarbonCaptureUnit': (await import('../models/CarbonCaptureUnit.js')).default,
    'SensorData': (await import('../models/SensorData.js')).default,
    'CarbonCredit': (await import('../models/CarbonCredit.js')).default,
    'Report': (await import('../models/Report.js')).default
  };

  const Model = models[modelName];
  return await Model.findById(resourceId);
};

// Optional authentication - doesn't fail if no token
export const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
      const user = await User.findById(decoded.userId).select('-password');

      if (user && user.isActive) {
        req.user = user;
      }
    } catch (err) {
      // Silent fail for optional auth
      req.user = null;
    }
  }

  next();
});

// API key authentication for service-to-service calls
export const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers['api-key'];

  if (!apiKey) {
    return next(new AuthenticationError('API key required'));
  }

  // In production, validate against database or environment
  const validApiKeys = (process.env.VALID_API_KEYS || '').split(',');

  if (!validApiKeys.includes(apiKey)) {
    return next(new AuthenticationError('Invalid API key'));
  }

  // Set service user
  req.user = {
    id: 'service-user',
    role: 'service',
    isService: true
  };

  next();
};

// Rate limiting by user
export const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    const userId = req.user?.id || req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get user's request history
    if (!requests.has(userId)) {
      requests.set(userId, []);
    }

    const userRequests = requests.get(userId);

    // Remove old requests
    while (userRequests.length > 0 && userRequests[0] < windowStart) {
      userRequests.shift();
    }

    // Check rate limit
    if (userRequests.length >= maxRequests) {
      const resetTime = new Date(userRequests[0] + windowMs);
      res.set('Retry-After', resetTime.toISOString());
      return next(new ApiError(`Rate limit exceeded. Try again after ${resetTime.toISOString()}`, 429, 'RATE_LIMIT_EXCEEDED'));
    }

    // Add current request
    userRequests.push(now);
    next();
  };
};

// Session management
export const sessionMiddleware = asyncHandler(async (req, res, next) => {
  if (req.user) {
    // Update last activity
    await User.findByIdAndUpdate(req.user.id, {
      lastActivity: new Date(),
      $inc: { apiCalls: 1 }
    });
  }
  next();
});

// CORS preflight handler
export const corsPreflight = (req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
};

// Security headers
export const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Remove sensitive headers
  res.removeHeader('X-Powered-By');

  next();
};

// Audit logging
export const auditLog = (action) => {
  return (req, res, next) => {
    const logData = {
      timestamp: new Date().toISOString(),
      userId: req.user?.id || 'anonymous',
      action: action,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      params: req.params,
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined
    };

    // In production, send to audit log service
    console.log('AUDIT:', JSON.stringify(logData, null, 2));

    next();
  };
};

// Two-factor authentication check
export const require2FA = asyncHandler(async (req, res, next) => {
  if (!req.user.twoFactorEnabled) {
    return next(new AuthenticationError('Two-factor authentication required'));
  }

  // Check 2FA token from header or body
  const token = req.headers['x-2fa-token'] || req.body.twoFactorToken;

  if (!token) {
    return next(new AuthenticationError('2FA token required'));
  }

  // Verify 2FA token (implementation depends on 2FA method used)
  const isValid = await verify2FAToken(req.user.id, token);

  if (!isValid) {
    return next(new AuthenticationError('Invalid 2FA token'));
  }

  next();
});

// Placeholder 2FA verification function
const verify2FAToken = async (userId, token) => {
  // Implement actual 2FA verification logic here
  // This could use TOTP, SMS, email, etc.
  return true; // Placeholder
};

// Password strength validation
export const validatePasswordStrength = (req, res, next) => {
  const { password } = req.body;

  if (!password) {
    return next(new ValidationError('Password is required'));
  }

  // Basic password requirements
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (password.length < minLength) {
    return next(new ValidationError(`Password must be at least ${minLength} characters long`));
  }

  if (!hasUpperCase || !hasLowerCase) {
    return next(new ValidationError('Password must contain both uppercase and lowercase letters'));
  }

  if (!hasNumbers) {
    return next(new ValidationError('Password must contain at least one number'));
  }

  if (!hasSpecialChar) {
    return next(new ValidationError('Password must contain at least one special character'));
  }

  next();
};

// Account lockout protection
export const accountLockoutProtection = asyncHandler(async (req, res, next) => {
  const email = req.body.email || req.body.username;

  if (!email) {
    return next();
  }

  // Check if account is locked
  const user = await User.findOne({ email }).select('+failedLoginAttempts +lockUntil');

  if (user && user.lockUntil && user.lockUntil > Date.now()) {
    const remainingTime = Math.ceil((user.lockUntil - Date.now()) / 1000 / 60);
    return next(new AuthenticationError(`Account locked. Try again in ${remainingTime} minutes`));
  }

  // Store user for later use in login failure handler
  req.loginUser = user;
  next();
});

// Login failure handler
export const handleLoginFailure = asyncHandler(async (req, res, next) => {
  if (req.loginUser) {
    const maxAttempts = 5;
    const lockTime = 2 * 60 * 60 * 1000; // 2 hours

    await User.findByIdAndUpdate(req.loginUser._id, {
      $inc: { failedLoginAttempts: 1 },
      $set: {
        lockUntil: req.loginUser.failedLoginAttempts + 1 >= maxAttempts ? Date.now() + lockTime : undefined,
        lastFailedLogin: new Date()
      }
    });
  }
  next();
});

// Login success handler
export const handleLoginSuccess = asyncHandler(async (req, res, next) => {
  if (req.user) {
    // Reset failed attempts and update login info
    await User.findByIdAndUpdate(req.user.id, {
      $unset: { failedLoginAttempts: 1, lockUntil: 1 },
      $set: {
        lastLogin: new Date(),
        loginCount: (req.user.loginCount || 0) + 1
      }
    });
  }
  next();
});