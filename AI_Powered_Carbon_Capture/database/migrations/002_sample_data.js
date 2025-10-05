/**
 * Sample data migration
 * Inserts sample carbon capture units, sensors, and initial data for testing
 */

const migration = {
  version: 2,
  name: 'sample_data',

  async up(db) {
    console.log('Inserting sample data...');

    // Sample carbon capture units
    const sampleUnits = [
      {
        id: 'CC-001',
        name: 'Downtown Manhattan Unit',
        location: {
          latitude: 40.7589,
          longitude: -73.9851,
          address: '123 Broadway Ave',
          city: 'New York',
          state: 'NY',
          country: 'United States',
          postalCode: '10001',
          timezone: 'America/New_York'
        },
        type: 'commercial',
        status: 'active',
        capacity: {
          co2PerDay: 150,
          energyConsumption: 850,
          efficiency: 87.5,
          maxCapacity: 200,
          currentLoad: 75
        },
        sensors: [
          {
            sensorId: 'temp_01',
            type: 'temperature',
            location: 'intake',
            critical: true,
            lastReading: {
              value: 25.3,
              timestamp: new Date(),
              quality: 'good'
            }
          },
          {
            sensorId: 'co2_01',
            type: 'co2_concentration',
            location: 'outlet',
            critical: true,
            lastReading: {
              value: 412.5,
              timestamp: new Date(),
              quality: 'good'
            }
          }
        ],
        aiOptimization: {
          enabled: true,
          currentEfficiency: 87.5,
          predictedEfficiency: 89.2,
          optimizationSuggestions: [
            {
              id: 'opt_001',
              type: 'efficiency',
              title: 'Temperature Optimization',
              description: 'Reduce operating temperature by 2°C to improve sorbent performance',
              impact: {
                co2Increase: 5.2,
                energySavings: 25.5,
                costSavings: 18.50
              },
              priority: 'high',
              status: 'pending',
              createdAt: new Date()
            }
          ],
          predictiveMaintenance: [],
          energyOptimization: {
            renewableEnergyUsage: 67.8,
            gridEnergyUsage: 32.2,
            peakDemandReduction: 45.2,
            costOptimization: 125.50,
            carbonFootprint: 890.5
          },
          lastOptimization: new Date(),
          aiModelVersion: '1.0.0'
        },
        carbonCredits: {
          totalCredits: 1250.5,
          availableCredits: 1180.5,
          retiredCredits: 70.0,
          creditPrice: 42.50,
          verificationStatus: 'verified',
          lastTransaction: new Date()
        },
        maintenance: {
          lastMaintenance: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
          nextScheduledMaintenance: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
          maintenanceHistory: [
            {
              date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              type: 'preventive',
              description: 'Routine filter replacement and calibration',
              technician: 'John Smith',
              parts: ['HEPA filter', 'calibration kit'],
              cost: 450.00,
              duration: 4
            }
          ],
          maintenanceAlerts: []
        },
        performance: {
          uptime: 96.8,
          averageEfficiency: 87.5,
          totalCO2Captured: 4520.5,
          energyIntensity: 195.2,
          costPerTon: 47.25,
          roi: 28.5
        },
        owner: (await db.collection('users').findOne({ username: 'admin' }))._id,
        metadata: {
          installationDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          warrantyExpiration: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000),
          manufacturer: 'CarbonTech Solutions',
          model: 'CT-150',
          firmwareVersion: '2.1.4'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'CC-002',
        name: 'Berlin Industrial Complex',
        location: {
          latitude: 52.5200,
          longitude: 13.4050,
          address: '456 Industriestraße',
          city: 'Berlin',
          state: 'Berlin',
          country: 'Germany',
          postalCode: '10115',
          timezone: 'Europe/Berlin'
        },
        type: 'industrial',
        status: 'active',
        capacity: {
          co2PerDay: 500,
          energyConsumption: 2100,
          efficiency: 85.2,
          maxCapacity: 750,
          currentLoad: 80
        },
        sensors: [
          {
            sensorId: 'flow_02',
            type: 'flow_rate',
            location: 'main_line',
            critical: true,
            lastReading: {
              value: 485.3,
              timestamp: new Date(),
              quality: 'good'
            }
          }
        ],
        aiOptimization: {
          enabled: true,
          currentEfficiency: 85.2,
          predictedEfficiency: 87.8,
          optimizationSuggestions: [],
          predictiveMaintenance: [
            {
              id: 'pm_001',
              component: 'blower_motor',
              alertType: 'warning',
              message: 'Motor vibration levels elevated, potential bearing wear',
              probability: 0.75,
              predictedFailureDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
              recommendedAction: 'Schedule vibration analysis and bearing inspection',
              status: 'active',
              createdAt: new Date()
            }
          ],
          energyOptimization: {
            renewableEnergyUsage: 45.2,
            gridEnergyUsage: 54.8,
            peakDemandReduction: 125.8,
            costOptimization: 485.50,
            carbonFootprint: 2150.5
          },
          lastOptimization: new Date(),
          aiModelVersion: '1.0.0'
        },
        carbonCredits: {
          totalCredits: 3875.2,
          availableCredits: 3875.2,
          retiredCredits: 0,
          creditPrice: 42.30,
          verificationStatus: 'verified',
          lastTransaction: new Date()
        },
        owner: (await db.collection('users').findOne({ username: 'admin' }))._id,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Insert sample units
    await db.collection('carboncaptureunits').insertMany(sampleUnits);
    console.log(`Inserted ${sampleUnits.length} sample units`);

    // Sample sensor data (last 24 hours)
    const sensorData = [];
    const now = new Date();

    for (let i = 0; i < 24; i++) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);

      // Temperature sensor readings
      sensorData.push({
        sensorId: 'temp_01',
        unitId: 'CC-001',
        sensorType: 'temperature',
        value: 25.0 + Math.sin(i / 24 * 2 * Math.PI) * 5 + (Math.random() - 0.5) * 2,
        unit: '°C',
        timestamp: timestamp,
        quality: 'good',
        location: {
          latitude: 40.7589,
          longitude: -73.9851
        },
        processed: true,
        anomaly: false,
        metadata: {
          calibrationOffset: 0.1,
          rawValue: 25.0 + Math.sin(i / 24 * 2 * Math.PI) * 5 + (Math.random() - 0.5) * 2,
          confidence: 0.95
        },
        createdAt: timestamp,
        updatedAt: timestamp
      });

      // CO2 concentration readings
      sensorData.push({
        sensorId: 'co2_01',
        unitId: 'CC-001',
        sensorType: 'co2_concentration',
        value: 420 + Math.random() * 20 - 10,
        unit: 'ppm',
        timestamp: timestamp,
        quality: 'good',
        location: {
          latitude: 40.7589,
          longitude: -73.9851
        },
        processed: true,
        anomaly: false,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }

    await db.collection('sensordatas').insertMany(sensorData);
    console.log(`Inserted ${sensorData.length} sample sensor readings`);

    // Sample carbon credits
    const sampleCredits = [
      {
        tokenId: 'CC1234567890123456789012345678901234567890',
        serialNumber: 'CC-2024-CC001-0001',
        vintage: 2024,
        amount: 125.5,
        unit: 'tCO2',
        projectId: 'NYC_Downtown_001',
        projectName: 'Downtown Manhattan Carbon Capture',
        unitId: 'CC-001',
        owner: (await db.collection('users').findOne({ username: 'admin' }))._id,
        issueDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        status: 'active',
        verification: {
          verifier: 'admin',
          verificationMethod: 'ai_prediction',
          verificationDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
          confidenceScore: 95,
          evidence: ['ipfs://QmEvidence1', 'ipfs://QmEvidence2'],
          methodology: 'hybrid'
        },
        marketData: {
          currentPrice: 42.50,
          priceHistory: [
            { price: 40.00, timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), source: 'market' },
            { price: 42.50, timestamp: new Date(), source: 'market' }
          ]
        },
        compliance: {
          registry: 'verra',
          standards: ['corsia', 'icca'],
          certifications: [
            {
              name: 'ISO 14064-2',
              issuer: 'International Organization for Standardization',
              issueDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
            }
          ]
        },
        metadata: {
          captureStartDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          captureEndDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          methodologyDetails: 'Direct air capture using enhanced sorbent materials',
          coBenefits: ['air_quality_improvement', 'job_creation']
        },
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date()
      }
    ];

    await db.collection('carboncredits').insertMany(sampleCredits);
    console.log(`Inserted ${sampleCredits.length} sample carbon credits`);

    // Sample AI optimization records
    const aiOptimizations = [
      {
        unitId: 'CC-001',
        timestamp: new Date(),
        optimizationType: 'efficiency',
        modelVersion: '1.0.0',
        inputData: {
          temperature: 25.3,
          pressure: 101.3,
          flowRate: 485.2,
          co2Concentration: 412.5
        },
        outputData: {
          predictedEfficiency: 89.2,
          optimizationSuggestions: [
            {
              type: 'temperature',
              action: 'decrease',
              targetValue: 23.5,
              expectedImprovement: 2.8,
              confidence: 0.85
            }
          ],
          energySavings: 25.5,
          costSavings: 18.50
        },
        performanceMetrics: {
          processingTime: 0.245,
          modelAccuracy: 0.92,
          predictionConfidence: 0.88
        }
      }
    ];

    await db.collection('aioptimizations').insertMany(aiOptimizations);
    console.log(`Inserted ${aiOptimizations.length} sample AI optimization records`);

    console.log('Sample data migration completed successfully');
  },

  async down(db) {
    console.log('Rolling back sample data migration...');

    // Remove sample data
    await db.collection('carboncaptureunits').deleteMany({
      id: { $in: ['CC-001', 'CC-002'] }
    });

    await db.collection('sensordatas').deleteMany({
      unitId: { $in: ['CC-001', 'CC-002'] }
    });

    await db.collection('carboncredits').deleteMany({
      unitId: 'CC-001'
    });

    await db.collection('aioptimizations').deleteMany({
      unitId: { $in: ['CC-001', 'CC-002'] }
    });

    console.log('Sample data migration rollback completed');
  }
};

module.exports = migration;
