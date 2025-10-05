import winston from 'winston';
import morgan from 'morgan';

// Create logs directory if it doesn't exist
import fs from 'fs';
import path from 'path';

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configure Winston logger for requests
const requestLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'carbon-capture-api' },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'requests.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  requestLogger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

// Morgan stream for HTTP request logging
const morganStream = {
  write: (message) => {
    requestLogger.info('HTTP Request', {
      message: message.trim(),
      type: 'http'
    });
  },
};

// Custom Morgan format for detailed request logging
const detailedFormat = ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms';

// Create Morgan middleware
export const requestLogger = morgan(detailedFormat, {
  stream: morganStream,
  skip: (req, res) => {
    // Skip logging for health checks and static files
    return req.url === '/health' || req.url.startsWith('/static') || req.url.startsWith('/favicon');
  }
});

// Advanced request logging middleware
export const advancedRequestLogger = (req, res, next) => {
  const start = Date.now();
  const requestId = generateRequestId();

  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);

  // Log request start
  requestLogger.info('Request Started', {
    requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    headers: sanitizeHeaders(req.headers),
    query: req.query,
    params: req.params,
    body: req.method !== 'GET' ? sanitizeBody(req.body) : undefined,
  });

  // Log response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - start;

    requestLogger.info('Request Completed', {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      responseSize: Buffer.isBuffer(data) ? data.length : (data ? data.length : 0),
      userId: req.user?.id,
    });

    originalSend.call(this, data);
  };

  // Log request end
  res.on('finish', () => {
    const duration = Date.now() - start;

    // Log slow requests
    if (duration > 1000) { // More than 1 second
      requestLogger.warn('Slow Request', {
        requestId,
        method: req.method,
        url: req.originalUrl,
        duration,
        statusCode: res.statusCode,
        userId: req.user?.id,
      });
    }
  });

  // Log errors
  res.on('error', (error) => {
    requestLogger.error('Request Error', {
      requestId,
      method: req.method,
      url: req.originalUrl,
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });
  });

  next();
};

// Performance monitoring middleware
export const performanceLogger = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds

    requestLogger.info('Performance Metrics', {
      method: req.method,
      url: req.originalUrl,
      duration,
      memoryUsage: process.memoryUsage(),
      statusCode: res.statusCode,
    });
  });

  next();
};

// Security event logger
export const securityLogger = (req, res, next) => {
  // Log suspicious activities
  const suspiciousPatterns = [
    /\.\./,  // Directory traversal
    /<script/i,  // XSS attempts
    /union.*select/i,  // SQL injection
    /eval\(/i,  // Code injection
  ];

  const checkString = `${req.url} ${JSON.stringify(req.body || {})} ${JSON.stringify(req.query || {})}`;

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(checkString)) {
      requestLogger.warn('Security Alert', {
        type: 'suspicious_request',
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id,
        pattern: pattern.toString(),
        body: req.body,
        query: req.query,
      });
      break;
    }
  }

  // Log authentication failures
  if (res.statusCode === 401 || res.statusCode === 403) {
    requestLogger.warn('Authentication Failure', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      headers: req.headers,
    });
  }

  next();
};

// Business metrics logger
export const businessMetricsLogger = (req, res, next) => {
  res.on('finish', () => {
    // Log business-relevant metrics
    if (req.originalUrl.includes('/api/units') && req.method === 'POST') {
      requestLogger.info('Business Metric: Unit Created', {
        userId: req.user?.id,
        timestamp: new Date().toISOString(),
      });
    }

    if (req.originalUrl.includes('/api/credits') && req.method === 'POST') {
      requestLogger.info('Business Metric: Credit Transaction', {
        userId: req.user?.id,
        amount: req.body?.amount,
        type: req.body?.type,
        timestamp: new Date().toISOString(),
      });
    }

    if (req.originalUrl.includes('/api/ai/optimize')) {
      requestLogger.info('Business Metric: AI Optimization', {
        userId: req.user?.id,
        unitId: req.params?.unitId,
        optimizationType: 'efficiency',
        timestamp: new Date().toISOString(),
      });
    }
  });

  next();
};

// Error tracking middleware
export const errorTrackingLogger = (req, res, next) => {
  const originalJson = res.json;
  res.json = function(data) {
    // Log API errors
    if (data && data.success === false && data.error) {
      requestLogger.error('API Error Response', {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        errorCode: data.error.code,
        errorMessage: data.error.message,
        userId: req.user?.id,
        stack: data.error.stack,
      });
    }

    originalJson.call(this, data);
  };

  next();
};

// Database query logger
export const databaseLogger = (req, res, next) => {
  // This would be used with mongoose query middleware
  // For now, just log database-related requests
  if (req.originalUrl.includes('/api/')) {
    requestLogger.debug('Database Operation', {
      method: req.method,
      url: req.originalUrl,
      operation: getDatabaseOperation(req),
      userId: req.user?.id,
    });
  }

  next();
};

// Helper functions
function generateRequestId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function sanitizeHeaders(headers) {
  const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];
  const sanitized = { ...headers };

  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });

  return sanitized;
}

function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;

  const sensitiveFields = ['password', 'token', 'secret', 'key', 'apiKey'];
  const sanitized = { ...body };

  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

function getDatabaseOperation(req) {
  const method = req.method;
  const url = req.originalUrl;

  if (url.includes('/api/units')) {
    return `${method === 'GET' ? 'READ' : method === 'POST' ? 'CREATE' : method === 'PUT' ? 'UPDATE' : 'DELETE'} Unit`;
  }

  if (url.includes('/api/sensors')) {
    return `${method === 'GET' ? 'READ' : method === 'POST' ? 'CREATE' : method === 'PUT' ? 'UPDATE' : 'DELETE'} Sensor`;
  }

  if (url.includes('/api/credits')) {
    return `${method === 'GET' ? 'READ' : method === 'POST' ? 'CREATE' : method === 'PUT' ? 'UPDATE' : 'DELETE'} Credit`;
  }

  return 'UNKNOWN';
}

// Export combined middleware for easy use
export const comprehensiveLogger = [
  advancedRequestLogger,
  performanceLogger,
  securityLogger,
  businessMetricsLogger,
  errorTrackingLogger,
  databaseLogger
];

// Log rotation utility
export const rotateLogs = () => {
  const logFiles = [
    'requests.log',
    'combined.log',
    'error.log'
  ];

  logFiles.forEach(filename => {
    const filePath = path.join(logsDir, filename);
    const archivePath = path.join(logsDir, 'archive', `${filename}.${Date.now()}`);

    if (fs.existsSync(filePath)) {
      // Create archive directory if it doesn't exist
      const archiveDir = path.dirname(archivePath);
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }

      // Move file to archive
      fs.renameSync(filePath, archivePath);

      requestLogger.info('Log rotated', { filename, archivePath });
    }
  });
};

// Scheduled log rotation (run daily)
if (process.env.NODE_ENV === 'production') {
  setInterval(rotateLogs, 24 * 60 * 60 * 1000); // Daily
}