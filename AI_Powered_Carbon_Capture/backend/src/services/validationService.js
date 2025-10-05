import Joi from 'joi';
import winston from 'winston';
import { ApiError } from '../middleware/errorHandler.js';
import sanitizeHtml from 'sanitize-html';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'validation-service' },
  transports: [
    new winston.transports.File({ filename: 'logs/validation-service.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

class ValidationService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // User validation schemas
  get userSchemas() {
    return {
      createUser: Joi.object({
        username: Joi.string()
          .min(3)
          .max(30)
          .regex(/^[a-zA-Z0-9_-]+$/)
          .required()
          .messages({
            'string.pattern.base': 'Username can only contain letters, numbers, underscores, and hyphens'
          }),

        email: Joi.string()
          .email()
          .required()
          .messages({
            'string.email': 'Please provide a valid email address'
          }),

        password: Joi.string()
          .min(8)
          .max(128)
          .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
          .required()
          .messages({
            'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
          }),

        firstName: Joi.string()
          .min(1)
          .max(50)
          .trim()
          .required(),

        lastName: Joi.string()
          .min(1)
          .max(50)
          .trim()
          .required(),

        role: Joi.string()
          .valid('user', 'admin', 'operator')
          .default('user'),

        phoneNumber: Joi.string()
          .pattern(/^\+?[1-9]\d{1,14}$/)
          .optional()
          .messages({
            'string.pattern.base': 'Please provide a valid phone number'
          }),

        preferences: Joi.object({
          notifications: Joi.object({
            email: Joi.boolean().default(true),
            sms: Joi.boolean().default(false),
            push: Joi.boolean().default(true)
          }).default(),
          dashboard: Joi.object({
            defaultView: Joi.string().valid('overview', 'units', 'analytics').default('overview'),
            theme: Joi.string().valid('light', 'dark').default('light')
          }).default()
        }).default()
      }),

      updateUser: Joi.object({
        firstName: Joi.string().min(1).max(50).trim(),
        lastName: Joi.string().min(1).max(50).trim(),
        phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
        preferences: Joi.object({
          notifications: Joi.object({
            email: Joi.boolean(),
            sms: Joi.boolean(),
            push: Joi.boolean()
          }),
          dashboard: Joi.object({
            defaultView: Joi.string().valid('overview', 'units', 'analytics'),
            theme: Joi.string().valid('light', 'dark')
          })
        })
      }).min(1),

      login: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
      }),

      changePassword: Joi.object({
        currentPassword: Joi.string().required(),
        newPassword: Joi.string()
          .min(8)
          .max(128)
          .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
          .required()
          .messages({
            'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
          })
      })
    };
  }

  // Carbon capture unit validation schemas
  get unitSchemas() {
    return {
      createUnit: Joi.object({
        id: Joi.string()
          .pattern(/^CC-\d{3}$/)
          .required()
          .messages({
            'string.pattern.base': 'Unit ID must be in format CC-XXX (e.g., CC-001)'
          }),

        name: Joi.string()
          .min(1)
          .max(100)
          .trim()
          .required(),

        location: Joi.object({
          latitude: Joi.number()
            .min(-90)
            .max(90)
            .required(),

          longitude: Joi.number()
            .min(-180)
            .max(180)
            .required(),

          address: Joi.string().max(200).trim(),
          city: Joi.string().max(100).trim().required(),
          state: Joi.string().max(100).trim(),
          country: Joi.string().max(100).trim().required(),
          postalCode: Joi.string().max(20).trim(),
          timezone: Joi.string().max(50)
        }).required(),

        type: Joi.string()
          .valid('residential', 'commercial', 'industrial', 'utility')
          .required(),

        capacity: Joi.object({
          co2PerDay: Joi.number().min(1).max(10000).required(),
          energyConsumption: Joi.number().min(1).max(100000).required(),
          efficiency: Joi.number().min(0).max(100).required(),
          maxCapacity: Joi.number().min(1).max(10000),
          currentLoad: Joi.number().min(0).max(100).default(0)
        }).required(),

        aiOptimization: Joi.object({
          enabled: Joi.boolean().default(true),
          currentEfficiency: Joi.number().min(0).max(100),
          predictedEfficiency: Joi.number().min(0).max(100),
          optimizationSuggestions: Joi.array().items(
            Joi.object({
              id: Joi.string().required(),
              type: Joi.string().valid('efficiency', 'energy', 'maintenance').required(),
              title: Joi.string().required(),
              description: Joi.string().required(),
              impact: Joi.object({
                co2Increase: Joi.number(),
                energySavings: Joi.number(),
                costSavings: Joi.number()
              }),
              priority: Joi.string().valid('low', 'medium', 'high').required(),
              status: Joi.string().valid('pending', 'applied', 'rejected').default('pending'),
              createdAt: Joi.date()
            })
          ),
          predictiveMaintenance: Joi.array().items(
            Joi.object({
              id: Joi.string().required(),
              component: Joi.string().required(),
              alertType: Joi.string().valid('warning', 'critical').required(),
              message: Joi.string().required(),
              probability: Joi.number().min(0).max(1).required(),
              predictedFailureDate: Joi.date(),
              recommendedAction: Joi.string().required(),
              status: Joi.string().valid('active', 'resolved').default('active'),
              createdAt: Joi.date()
            })
          ),
          energyOptimization: Joi.object({
            renewableEnergyUsage: Joi.number().min(0).max(100),
            gridEnergyUsage: Joi.number().min(0).max(100),
            peakDemandReduction: Joi.number().min(0).max(100),
            costOptimization: Joi.number().min(0),
            carbonFootprint: Joi.number().min(0)
          }),
          lastOptimization: Joi.date(),
          aiModelVersion: Joi.string()
        }).default(),

        carbonCredits: Joi.object({
          totalCredits: Joi.number().min(0).default(0),
          availableCredits: Joi.number().min(0).default(0),
          retiredCredits: Joi.number().min(0).default(0),
          creditPrice: Joi.number().min(0).default(25),
          verificationStatus: Joi.string().valid('pending', 'verified', 'rejected').default('pending'),
          lastTransaction: Joi.date()
        }).default(),

        maintenance: Joi.object({
          lastMaintenance: Joi.date(),
          nextScheduledMaintenance: Joi.date(),
          maintenanceHistory: Joi.array().items(
            Joi.object({
              date: Joi.date().required(),
              type: Joi.string().valid('preventive', 'corrective', 'predictive').required(),
              description: Joi.string().required(),
              technician: Joi.string().required(),
              parts: Joi.array().items(Joi.string()),
              cost: Joi.number().min(0).required(),
              duration: Joi.number().min(0).required()
            })
          ).default([]),
          maintenanceAlerts: Joi.array().default([])
        }).default(),

        performance: Joi.object({
          uptime: Joi.number().min(0).max(100).default(100),
          averageEfficiency: Joi.number().min(0).max(100).default(0),
          totalCO2Captured: Joi.number().min(0).default(0),
          energyIntensity: Joi.number().min(0).default(0),
          costPerTon: Joi.number().min(0).default(0),
          roi: Joi.number().default(0)
        }).default()
      }),

      updateUnit: Joi.object({
        name: Joi.string().min(1).max(100).trim(),
        status: Joi.string().valid('active', 'inactive', 'maintenance', 'offline'),
        capacity: Joi.object({
          efficiency: Joi.number().min(0).max(100),
          currentLoad: Joi.number().min(0).max(100)
        }),
        aiOptimization: Joi.object({
          enabled: Joi.boolean()
        })
      }).min(1)
    };
  }

  // Sensor data validation schemas
  get sensorSchemas() {
    return {
      sensorReading: Joi.object({
        sensorId: Joi.string()
          .pattern(/^[A-Za-z0-9_-]+$/)
          .required(),

        unitId: Joi.string()
          .pattern(/^CC-\d{3}$/)
          .required(),

        sensorType: Joi.string()
          .valid('temperature', 'pressure', 'flow_rate', 'co2_concentration',
                 'humidity', 'air_quality', 'energy_consumption', 'vibration',
                 'noise_level', 'particulate_matter')
          .required(),

        value: Joi.number().required(),

        unit: Joi.string().max(10).required(),

        timestamp: Joi.date().default(Date.now),

        quality: Joi.string()
          .valid('good', 'warning', 'critical')
          .default('good'),

        location: Joi.object({
          latitude: Joi.number().min(-90).max(90),
          longitude: Joi.number().min(-180).max(180),
          altitude: Joi.number()
        }),

        metadata: Joi.object({
          calibrationOffset: Joi.number(),
          rawValue: Joi.number(),
          confidence: Joi.number().min(0).max(1),
          batchId: Joi.string()
        }).default({})
      }),

      sensorCalibration: Joi.object({
        calibrationType: Joi.string()
          .valid('zero', 'span', 'linearity')
          .required(),

        referenceValue: Joi.number().required(),

        referenceUnit: Joi.string().max(10).required(),

        technician: Joi.string().required(),

        notes: Joi.string().max(500)
      })
    };
  }

  // Carbon credit validation schemas
  get creditSchemas() {
    return {
      createCredit: Joi.object({
        tokenId: Joi.string()
          .pattern(/^0x[a-fA-F0-9]{64}$/)
          .required()
          .messages({
            'string.pattern.base': 'Token ID must be a valid Ethereum address/hash'
          }),

        serialNumber: Joi.string()
          .pattern(/^CC-\d{4}-[A-Z]{2}\d{3}-\d{4}$/)
          .required()
          .messages({
            'string.pattern.base': 'Serial number must be in format CC-YYYY-XXNNN-NNNN'
          }),

        vintage: Joi.number()
          .integer()
          .min(2020)
          .max(new Date().getFullYear() + 1)
          .required(),

        amount: Joi.number().min(0.001).required(),

        unit: Joi.string().valid('tCO2', 'tCO2e').default('tCO2'),

        projectId: Joi.string().required(),

        projectName: Joi.string().max(200).required(),

        unitId: Joi.string()
          .pattern(/^CC-\d{3}$/)
          .required(),

        methodology: Joi.string()
          .valid('baseline', 'enhanced', 'innovative')
          .default('baseline'),

        verification: Joi.object({
          verifier: Joi.string().required(),
          verificationMethod: Joi.string()
            .valid('ai_prediction', 'manual_audit', 'third_party')
            .required(),
          verificationDate: Joi.date().default(Date.now),
          confidenceScore: Joi.number().min(0).max(100).required(),
          evidence: Joi.array().items(Joi.string()).default([])
        }).required(),

        compliance: Joi.object({
          registry: Joi.string()
            .valid('verra', 'gold_standard', 'american_carbon_registry')
            .required(),
          standards: Joi.array().items(
            Joi.string().valid('corsia', 'icca', 'cdm')
          ).default([]),
          certifications: Joi.array().items(
            Joi.object({
              name: Joi.string().required(),
              issuer: Joi.string().required(),
              issueDate: Joi.date().required()
            })
          ).default([])
        }).required()
      }),

      tradeCredit: Joi.object({
        creditId: Joi.string().required(),
        amount: Joi.number().min(0.001).required(),
        price: Joi.number().min(0).required(),
        buyer: Joi.string().required(),
        seller: Joi.string().required()
      })
    };
  }

  /**
   * Validate data against a schema
   * @param {Object} data - Data to validate
   * @param {Object} schema - Joi schema
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  async validate(data, schema, options = {}) {
    try {
      const { error, value } = schema.validate(data, {
        abortEarly: false,
        stripUnknown: true,
        ...options
      });

      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context.value
        }));

        logger.warn('Validation failed', {
          errors: errors.length,
          data: JSON.stringify(data).substring(0, 500)
        });

        throw new ApiError(
          'Validation failed',
          400,
          'VALIDATION_ERROR',
          { errors }
        );
      }

      // Sanitize HTML in string fields
      const sanitized = this._sanitizeData(value);

      return {
        success: true,
        data: sanitized,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error('Validation error:', error);
      throw new ApiError(
        'Validation service error',
        500,
        'VALIDATION_SERVICE_ERROR',
        { error: error.message }
      );
    }
  }

  /**
   * Validate user input
   * @param {Object} data - User data
   * @param {string} operation - Operation type ('create', 'update', 'login', 'changePassword')
   * @returns {Promise<Object>} Validation result
   */
  async validateUser(data, operation = 'create') {
    const schema = this.userSchemas[operation];
    if (!schema) {
      throw new ApiError(
        `Invalid user validation operation: ${operation}`,
        400,
        'INVALID_VALIDATION_OPERATION'
      );
    }

    return this.validate(data, schema);
  }

  /**
   * Validate carbon capture unit input
   * @param {Object} data - Unit data
   * @param {string} operation - Operation type ('create', 'update')
   * @returns {Promise<Object>} Validation result
   */
  async validateUnit(data, operation = 'create') {
    const schema = this.unitSchemas[operation];
    if (!schema) {
      throw new ApiError(
        `Invalid unit validation operation: ${operation}`,
        400,
        'INVALID_VALIDATION_OPERATION'
      );
    }

    return this.validate(data, schema);
  }

  /**
   * Validate sensor data input
   * @param {Object} data - Sensor data
   * @param {string} operation - Operation type ('reading', 'calibration')
   * @returns {Promise<Object>} Validation result
   */
  async validateSensor(data, operation = 'reading') {
    const schema = this.sensorSchemas[operation];
    if (!schema) {
      throw new ApiError(
        `Invalid sensor validation operation: ${operation}`,
        400,
        'INVALID_VALIDATION_OPERATION'
      );
    }

    return this.validate(data, schema);
  }

  /**
   * Validate carbon credit input
   * @param {Object} data - Credit data
   * @param {string} operation - Operation type ('create', 'trade')
   * @returns {Promise<Object>} Validation result
   */
  async validateCredit(data, operation = 'create') {
    const schema = this.creditSchemas[operation];
    if (!schema) {
      throw new ApiError(
        `Invalid credit validation operation: ${operation}`,
        400,
        'INVALID_VALIDATION_OPERATION'
      );
    }

    return this.validate(data, schema);
  }

  /**
   * Validate file upload
   * @param {Object} file - File object
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validateFile(file, options = {}) {
    const {
      maxSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
      allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/gif,application/pdf').split(','),
      allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf']
    } = options;

    const errors = [];

    // Check file size
    if (file.size > maxSize) {
      errors.push({
        field: 'file',
        message: `File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`,
        value: file.size
      });
    }

    // Check file type
    if (!allowedTypes.includes(file.mimetype)) {
      errors.push({
        field: 'file',
        message: `File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
        value: file.mimetype
      });
    }

    // Check file extension
    const fileExtension = '.' + file.originalname.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      errors.push({
        field: 'file',
        message: `File extension ${fileExtension} is not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`,
        value: fileExtension
      });
    }

    if (errors.length > 0) {
      throw new ApiError(
        'File validation failed',
        400,
        'FILE_VALIDATION_ERROR',
        { errors }
      );
    }

    return {
      success: true,
      file: {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        extension: fileExtension
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Validate API request parameters
   * @param {Object} params - Request parameters
   * @param {Object} schema - Joi schema for parameters
   * @returns {Promise<Object>} Validation result
   */
  async validateParams(params, schema) {
    return this.validate(params, schema, { allowUnknown: false });
  }

  /**
   * Sanitize data by removing HTML and potentially harmful content
   * @param {any} data - Data to sanitize
   * @returns {any} Sanitized data
   */
  _sanitizeData(data) {
    if (typeof data === 'string') {
      return sanitizeHtml(data, {
        allowedTags: [],
        allowedAttributes: {},
        disallowedTagsMode: 'recursiveEscape'
      });
    }

    if (Array.isArray(data)) {
      return data.map(item => this._sanitizeData(item));
    }

    if (data && typeof data === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this._sanitizeData(value);
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Cache validation schema for performance
   * @param {string} key - Cache key
   * @param {Object} schema - Joi schema
   */
  _cacheSchema(key, schema) {
    this.cache.set(key, {
      schema,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached schema
   * @param {string} key - Cache key
   * @returns {Object|null} Cached schema or null
   */
  _getCachedSchema(key) {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.schema;
    }

    if (cached) {
      this.cache.delete(key);
    }

    return null;
  }

  /**
   * Clear validation cache
   */
  clearCache() {
    this.cache.clear();
    logger.info('Validation cache cleared');
  }

  /**
   * Get validation statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      cacheTimeout: this.cacheTimeout,
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
export default new ValidationService();
