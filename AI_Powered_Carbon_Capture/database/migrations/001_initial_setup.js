/**
 * Initial database setup migration
 * Creates collections, indexes, and initial data for the carbon capture network
 */

const migration = {
  version: 1,
  name: 'initial_setup',

  async up(db) {
    console.log('Running initial setup migration...');

    // Create collections
    const collections = [
      'carboncaptureunits',
      'sensordatas',
      'carboncredits',
      'users',
      'aioptimizations',
      'maintenancealerts',
      'systemlogs',
      'auditlogs'
    ];

    for (const collection of collections) {
      try {
        await db.createCollection(collection);
        console.log(`Created collection: ${collection}`);
      } catch (error) {
        if (error.code !== 48) { // Collection already exists
          throw error;
        }
      }
    }

    // Create indexes for carboncaptureunits
    await db.collection('carboncaptureunits').createIndexes([
      {
        name: 'id_unique',
        key: { id: 1 },
        unique: true
      },
      {
        name: 'location_2dsphere',
        key: { 'location': '2dsphere' }
      },
      {
        name: 'status_timestamp',
        key: { status: 1, updatedAt: -1 }
      },
      {
        name: 'type_location',
        key: { type: 1, 'location.country': 1 }
      },
      {
        name: 'owner_status',
        key: { owner: 1, status: 1 }
      },
      {
        name: 'efficiency_performance',
        key: { 'capacity.efficiency': -1, 'performance.uptime': -1 }
      },
      {
        name: 'maintenance_schedule',
        key: { 'maintenance.nextScheduledMaintenance': 1 }
      }
    ]);

    // Create indexes for sensordatas
    await db.collection('sensordatas').createIndexes([
      {
        name: 'sensor_timestamp',
        key: { sensorId: 1, timestamp: -1 }
      },
      {
        name: 'unit_timestamp',
        key: { unitId: 1, timestamp: -1 }
      },
      {
        name: 'sensor_type_timestamp',
        key: { sensorType: 1, timestamp: -1 }
      },
      {
        name: 'quality_timestamp',
        key: { quality: 1, timestamp: -1 }
      },
      {
        name: 'location_2dsphere',
        key: { 'location': '2dsphere' }
      },
      {
        name: 'processed_timestamp',
        key: { processed: 1, timestamp: -1 }
      },
      {
        name: 'anomaly_timestamp',
        key: { anomaly: 1, timestamp: -1 }
      }
    ]);

    // Create indexes for carboncredits
    await db.collection('carboncredits').createIndexes([
      {
        name: 'token_id_unique',
        key: { tokenId: 1 },
        unique: true
      },
      {
        name: 'serial_number_unique',
        key: { serialNumber: 1 },
        unique: true
      },
      {
        name: 'owner_status',
        key: { owner: 1, status: 1 }
      },
      {
        name: 'unit_vintage',
        key: { unitId: 1, vintage: 1 }
      },
      {
        name: 'status_amount',
        key: { status: 1, amount: -1 }
      },
      {
        name: 'verification_status',
        key: { verificationStatus: 1, createdAt: -1 }
      }
    ]);

    // Create indexes for users
    await db.collection('users').createIndexes([
      {
        name: 'email_unique',
        key: { email: 1 },
        unique: true
      },
      {
        name: 'username_unique',
        key: { username: 1 },
        unique: true
      },
      {
        name: 'role_active',
        key: { role: 1, isActive: 1 }
      },
      {
        name: 'last_login',
        key: { lastLogin: -1 }
      },
      {
        name: 'carbon_credits_total',
        key: { 'carbonCredits.totalCredits': -1 }
      }
    ]);

    // Create indexes for aioptimizations
    await db.collection('aioptimizations').createIndexes([
      {
        name: 'unit_timestamp',
        key: { unitId: 1, timestamp: -1 }
      },
      {
        name: 'model_version',
        key: { modelVersion: 1, timestamp: -1 }
      },
      {
        name: 'optimization_type',
        key: { optimizationType: 1, timestamp: -1 }
      }
    ]);

    // Create indexes for maintenancealerts
    await db.collection('maintenancealerts').createIndexes([
      {
        name: 'unit_severity',
        key: { unitId: 1, severity: 1, createdAt: -1 }
      },
      {
        name: 'status_created',
        key: { status: 1, createdAt: -1 }
      },
      {
        name: 'component_type',
        key: { component: 1, alertType: 1 }
      }
    ]);

    // Create indexes for auditlogs
    await db.collection('auditlogs').createIndexes([
      {
        name: 'timestamp_desc',
        key: { timestamp: -1 }
      },
      {
        name: 'user_action',
        key: { userId: 1, action: 1, timestamp: -1 }
      },
      {
        name: 'resource_action',
        key: { resourceType: 1, resourceId: 1, action: 1 }
      }
    ]);

    // Insert initial system configuration
    await db.collection('systemconfig').insertOne({
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      features: {
        aiOptimization: true,
        predictiveMaintenance: true,
        carbonTrading: true,
        realTimeMonitoring: true,
        blockchainIntegration: true
      },
      limits: {
        maxUnitsPerUser: 50,
        maxSensorsPerUnit: 20,
        maxApiRequestsPerHour: 1000,
        maxFileUploadSize: 10 * 1024 * 1024 // 10MB
      },
      integrations: {
        aiEngineUrl: process.env.AI_ENGINE_URL || 'http://localhost:5000',
        blockchainNetwork: process.env.BLOCKCHAIN_NETWORK || 'polygon',
        ipfsGateway: process.env.IPFS_GATEWAY || 'https://ipfs.infura.io'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Insert default admin user (in production, this should be done securely)
    const bcrypt = require('bcryptjs');
    const adminPassword = await bcrypt.hash('admin123!@#', 12);

    await db.collection('users').insertOne({
      username: 'admin',
      email: 'admin@carboncapture.com',
      password: adminPassword,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'admin',
      isActive: true,
      isVerified: true,
      carbonCredits: {
        totalCredits: 0,
        availableCredits: 0,
        retiredCredits: 0,
        totalValue: 0,
        transactions: []
      },
      ownedUnits: [],
      preferences: {
        notifications: {
          email: true,
          sms: false,
          push: true
        },
        dashboard: {
          defaultView: 'overview',
          theme: 'light'
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('Initial setup migration completed successfully');
  },

  async down(db) {
    console.log('Rolling back initial setup migration...');

    // Drop all created collections
    const collections = [
      'carboncaptureunits',
      'sensordatas',
      'carboncredits',
      'users',
      'aioptimizations',
      'maintenancealerts',
      'systemlogs',
      'auditlogs',
      'systemconfig'
    ];

    for (const collection of collections) {
      try {
        await db.collection(collection).drop();
        console.log(`Dropped collection: ${collection}`);
      } catch (error) {
        console.warn(`Could not drop collection ${collection}: ${error.message}`);
      }
    }

    console.log('Initial setup migration rollback completed');
  }
};

module.exports = migration;
