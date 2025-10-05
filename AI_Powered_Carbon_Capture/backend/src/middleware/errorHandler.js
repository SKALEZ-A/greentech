import winston from 'winston';

// Configure error logging
const errorLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'carbon-capture-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  errorLogger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

// Custom Error Classes
export class ApiError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends ApiError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends ApiError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends ApiError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

// Async error wrapper
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Global error handler
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  errorLogger.error('API Error', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    timestamp: new Date().toISOString(),
    statusCode: error.statusCode || 500,
    code: error.code || 'INTERNAL_ERROR'
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new ApiError(message, 404, 'INVALID_ID');
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate field value: ${field}`;
    error = new ApiError(message, 400, 'DUPLICATE_FIELD');
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    const message = `Invalid input data: ${messages.join('. ')}`;
    error = new ApiError(message, 400, 'VALIDATION_ERROR');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = new ApiError(message, 401, 'INVALID_TOKEN');
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = new ApiError(message, 401, 'TOKEN_EXPIRED');
  }

  // Axios errors
  if (err.isAxiosError) {
    const statusCode = err.response?.status || 500;
    const message = err.response?.data?.message || err.message;
    const code = err.response?.data?.code || 'EXTERNAL_API_ERROR';
    error = new ApiError(message, statusCode, code);
  }

  // Default error
  if (!error.statusCode) {
    error.statusCode = 500;
    error.code = 'INTERNAL_ERROR';
  }

  // Send error response
  res.status(error.statusCode).json({
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details && { details: error.details }),
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
        timestamp: error.timestamp
      })
    },
    timestamp: new Date().toISOString()
  });
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  errorLogger.error('Unhandled Rejection', {
    error: err.message,
    stack: err.stack,
    promise: promise
  });

  // Close server & exit process in production
  if (process.env.NODE_ENV === 'production') {
    server.close(() => {
      process.exit(1);
    });
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  errorLogger.error('Uncaught Exception', {
    error: err.message,
    stack: err.stack
  });

  process.exit(1);
});

// 404 handler
export const notFound = (req, res, next) => {
  const error = new ApiError(`Not found - ${req.originalUrl}`, 404, 'NOT_FOUND');
  next(error);
};

// Validation middleware
export const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      const message = error.details.map(detail => detail.message).join(', ');
      return next(new ValidationError(message, error.details));
    }
    next();
  };
};

// Rate limiting error handler
export const rateLimitHandler = (req, res) => {
  res.status(429).json({
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: res.get('Retry-After')
    },
    timestamp: new Date().toISOString()
  });
};

// Database connection error handler
export const handleDatabaseError = (err) => {
  errorLogger.error('Database Error', {
    error: err.message,
    stack: err.stack,
    code: err.code,
    errno: err.errno
  });

  // Attempt to reconnect or graceful shutdown
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
};

// External API error handler
export const handleExternalAPIError = (err, serviceName) => {
  errorLogger.error(`${serviceName} API Error`, {
    service: serviceName,
    error: err.message,
    stack: err.stack,
    statusCode: err.response?.status,
    responseData: err.response?.data
  });

  // Return standardized error
  return new ApiError(
    `External service ${serviceName} is currently unavailable`,
    503,
    'EXTERNAL_SERVICE_ERROR'
  );
};