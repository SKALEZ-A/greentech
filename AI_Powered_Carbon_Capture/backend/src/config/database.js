import mongoose from 'mongoose';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'database-config' },
  transports: [
    new winston.transports.File({ filename: 'logs/database.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

const databaseConfig = {
  // Database connection settings
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/carbon-capture',
  testUri: process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/carbon-capture-test',

  // Connection options
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    bufferCommands: false,
    bufferMaxEntries: 0,
    maxIdleTimeMS: 30000,
    family: 4 // Use IPv4, skip trying IPv6
  },

  // Collection names
  collections: {
    users: 'users',
    carbonCaptureUnits: 'carboncaptureunits',
    sensorData: 'sensordatas',
    carbonCredits: 'carboncredits',
    aiOptimizations: 'aioptimizations',
    maintenanceAlerts: 'maintenancealerts',
    systemLogs: 'systemlogs',
    auditLogs: 'auditlogs',
    systemConfig: 'systemconfig'
  },

  // Indexes configuration
  indexes: {
    // User indexes
    users: [
      { key: { email: 1 }, options: { unique: true, name: 'email_unique' } },
      { key: { username: 1 }, options: { unique: true, name: 'username_unique' } },
      { key: { role: 1, isActive: 1 }, options: { name: 'role_active' } },
      { key: { lastLogin: -1 }, options: { name: 'last_login' } },
      { key: { 'carbonCredits.totalCredits': -1 }, options: { name: 'carbon_credits_total' } }
    ],

    // Carbon capture unit indexes
    carbonCaptureUnits: [
      { key: { id: 1 }, options: { unique: true, name: 'id_unique' } },
      { key: { 'location': '2dsphere' }, options: { name: 'location_2dsphere' } },
      { key: { status: 1, updatedAt: -1 }, options: { name: 'status_timestamp' } },
      { key: { type: 1, 'location.country': 1 }, options: { name: 'type_location' } },
      { key: { owner: 1, status: 1 }, options: { name: 'owner_status' } },
      { key: { 'capacity.efficiency': -1, 'performance.uptime': -1 }, options: { name: 'efficiency_performance' } },
      { key: { 'maintenance.nextScheduledMaintenance': 1 }, options: { name: 'maintenance_schedule' } }
    ],

    // Sensor data indexes
    sensorData: [
      { key: { sensorId: 1, timestamp: -1 }, options: { name: 'sensor_timestamp' } },
      { key: { unitId: 1, timestamp: -1 }, options: { name: 'unit_timestamp' } },
      { key: { sensorType: 1, timestamp: -1 }, options: { name: 'sensor_type_timestamp' } },
      { key: { quality: 1, timestamp: -1 }, options: { name: 'quality_timestamp' } },
      { key: { 'location': '2dsphere' }, options: { name: 'location_2dsphere' } },
      { key: { processed: 1, timestamp: -1 }, options: { name: 'processed_timestamp' } },
      { key: { anomaly: 1, timestamp: -1 }, options: { name: 'anomaly_timestamp' } }
    ],

    // Carbon credit indexes
    carbonCredits: [
      { key: { tokenId: 1 }, options: { unique: true, name: 'token_id_unique' } },
      { key: { serialNumber: 1 }, options: { unique: true, name: 'serial_number_unique' } },
      { key: { owner: 1, status: 1 }, options: { name: 'owner_status' } },
      { key: { unitId: 1, vintage: 1 }, options: { name: 'unit_vintage' } },
      { key: { status: 1, amount: -1 }, options: { name: 'status_amount' } },
      { key: { verificationStatus: 1, createdAt: -1 }, options: { name: 'verification_status' } }
    ],

    // AI optimization indexes
    aiOptimizations: [
      { key: { unitId: 1, timestamp: -1 }, options: { name: 'unit_timestamp' } },
      { key: { modelVersion: 1, timestamp: -1 }, options: { name: 'model_version' } },
      { key: { optimizationType: 1, timestamp: -1 }, options: { name: 'optimization_type' } }
    ],

    // Maintenance alert indexes
    maintenanceAlerts: [
      { key: { unitId: 1, severity: 1, createdAt: -1 }, options: { name: 'unit_severity' } },
      { key: { status: 1, createdAt: -1 }, options: { name: 'status_created' } },
      { key: { component: 1, alertType: 1 }, options: { name: 'component_type' } }
    ],

    // Audit log indexes
    auditLogs: [
      { key: { timestamp: -1 }, options: { name: 'timestamp_desc' } },
      { key: { userId: 1, action: 1, timestamp: -1 }, options: { name: 'user_action' } },
      { key: { resourceType: 1, resourceId: 1, action: 1 }, options: { name: 'resource_action' } }
    ]
  },

  // Schema validation levels
  validationLevel: 'moderate', // 'off', 'strict', 'moderate'
  validationAction: 'error', // 'error', 'warn'

  // Connection monitoring
  connection: {
    retryAttempts: 5,
    retryDelay: 1000,
    heartbeatFrequencyMS: 10000,
    maxIdleTimeMS: 30000
  },

  // Migration settings
  migration: {
    enabled: process.env.ENABLE_MIGRATIONS !== 'false',
    directory: 'database/migrations',
    collection: 'migrations'
  },

  // Backup settings
  backup: {
    enabled: process.env.BACKUP_ENABLED === 'true',
    schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *', // Daily at 2 AM
    retention: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
    directory: 'backups'
  }
};

/**
 * Connect to MongoDB
 * @returns {Promise<void>}
 */
export const connectDB = async () => {
  try {
    const uri = process.env.NODE_ENV === 'test' ? databaseConfig.testUri : databaseConfig.uri;

    const connection = await mongoose.connect(uri, databaseConfig.options);

    logger.info(`MongoDB Connected: ${connection.connection.host}`);
    logger.info(`Database: ${connection.connection.name}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    // Enable mongoose debug mode in development
    if (process.env.NODE_ENV === 'development' && process.env.DB_DEBUG === 'true') {
      mongoose.set('debug', true);
    }

    return connection;

  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    throw error;
  }
};

/**
 * Disconnect from MongoDB
 * @returns {Promise<void>}
 */
export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected successfully');
  } catch (error) {
    logger.error('MongoDB disconnection failed:', error);
    throw error;
  }
};

/**
 * Check database health
 * @returns {Promise<Object>} Health status
 */
export const checkDBHealth = async () => {
  try {
    const connection = mongoose.connection;

    const stats = await connection.db.stats();

    return {
      status: 'healthy',
      connected: connection.readyState === 1,
      database: connection.name,
      collections: stats.collections,
      dataSize: stats.dataSize,
      storageSize: stats.storageSize,
      indexes: stats.indexes,
      indexSize: stats.indexSize,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Database health check failed:', error);
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Create database indexes
 * @param {string} collectionName - Collection name
 * @returns {Promise<void>}
 */
export const createIndexes = async (collectionName) => {
  try {
    const indexes = databaseConfig.indexes[collectionName];
    if (!indexes) {
      logger.warn(`No indexes defined for collection: ${collectionName}`);
      return;
    }

    const collection = mongoose.connection.db.collection(collectionName);

    for (const indexSpec of indexes) {
      try {
        await collection.createIndex(indexSpec.key, indexSpec.options);
        logger.info(`Created index: ${indexSpec.options.name} on ${collectionName}`);
      } catch (error) {
        if (error.code === 11000) {
          logger.warn(`Index ${indexSpec.options.name} already exists on ${collectionName}`);
        } else {
          logger.error(`Failed to create index ${indexSpec.options.name} on ${collectionName}:`, error);
        }
      }
    }

  } catch (error) {
    logger.error(`Failed to create indexes for ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Drop database indexes
 * @param {string} collectionName - Collection name
 * @param {string} indexName - Index name (optional)
 * @returns {Promise<void>}
 */
export const dropIndexes = async (collectionName, indexName = null) => {
  try {
    const collection = mongoose.connection.db.collection(collectionName);

    if (indexName) {
      await collection.dropIndex(indexName);
      logger.info(`Dropped index: ${indexName} from ${collectionName}`);
    } else {
      await collection.dropIndexes();
      logger.info(`Dropped all indexes from ${collectionName}`);
    }

  } catch (error) {
    logger.error(`Failed to drop indexes for ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Get database statistics
 * @returns {Promise<Object>} Database statistics
 */
export const getDBStats = async () => {
  try {
    const stats = await mongoose.connection.db.stats();

    return {
      db: stats.db,
      collections: stats.collections,
      objects: stats.objects,
      avgObjSize: stats.avgObjSize,
      dataSize: stats.dataSize,
      storageSize: stats.storageSize,
      numExtents: stats.numExtents,
      indexes: stats.indexes,
      indexSize: stats.indexSize,
      fileSize: stats.fileSize,
      nsSizeMB: stats.nsSizeMB,
      extentFreeList: stats.extentFreeList,
      dataFileVersion: stats.dataFileVersion,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Failed to get database statistics:', error);
    throw error;
  }
};

/**
 * Run database maintenance
 * @returns {Promise<Object>} Maintenance results
 */
export const runMaintenance = async () => {
  try {
    const db = mongoose.connection.db;
    const results = {};

    // Repair database (if needed)
    try {
      await db.admin().command({ repairDatabase: 1 });
      results.repair = 'completed';
    } catch (error) {
      results.repair = `failed: ${error.message}`;
    }

    // Compact collections
    const collections = await db.listCollections().toArray();
    for (const collection of collections) {
      try {
        await db.command({ compact: collection.name });
        results[`compact_${collection.name}`] = 'completed';
      } catch (error) {
        results[`compact_${collection.name}`] = `failed: ${error.message}`;
      }
    }

    logger.info('Database maintenance completed', results);
    return results;

  } catch (error) {
    logger.error('Database maintenance failed:', error);
    throw error;
  }
};

export default databaseConfig;
