/**
 * Integration tests for Sensor Controller
 */

const chai = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const { expect } = chai;

// Mock models
const SensorData = mongoose.model('SensorData', {
  sensorId: String,
  unitId: String,
  type: String,
  value: Number,
  unit: String,
  timestamp: Date,
  quality: { type: Number, min: 0, max: 1 },
  location: String,
  metadata: mongoose.Schema.Types.Mixed
});

const CarbonCaptureUnit = mongoose.model('CarbonCaptureUnit', {
  unitId: String,
  location: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  sensors: [{
    sensorId: String,
    type: String,
    status: String,
    lastReading: Date
  }]
});

// Mock the sensor controller
const sensorController = {
  receiveSensorData: async (req, res, next) => {
    try {
      const { sensorId, unitId, type, value, unit, quality, location, metadata } = req.body;

      // Validate required fields
      if (!sensorId || !unitId || !type || value === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: sensorId, unitId, type, value'
        });
      }

      // Create sensor data entry
      const sensorData = new SensorData({
        sensorId,
        unitId,
        type,
        value,
        unit: unit || 'default',
        timestamp: new Date(),
        quality: quality || 1.0,
        location,
        metadata
      });

      // Save to database
      await sensorData.save();

      // Update unit's sensor status
      await CarbonCaptureUnit.findOneAndUpdate(
        { unitId },
        {
          $set: {
            'sensors.$[elem].lastReading': new Date(),
            'sensors.$[elem].status': 'active'
          }
        },
        {
          arrayFilters: [{ 'elem.sensorId': sensorId }]
        }
      );

      // Check for anomalies
      const anomalyDetected = await checkForAnomalies(sensorData);

      res.status(201).json({
        success: true,
        data: {
          id: sensorData._id,
          sensorId: sensorData.sensorId,
          unitId: sensorData.unitId,
          type: sensorData.type,
          value: sensorData.value,
          timestamp: sensorData.timestamp,
          anomalyDetected
        }
      });
    } catch (error) {
      next(error);
    }
  },

  getSensorHistory: async (req, res, next) => {
    try {
      const { unitId, sensorId, type } = req.params;
      const { startDate, endDate, limit = 100, page = 1 } = req.query;

      let query = {};
      if (unitId) query.unitId = unitId;
      if (sensorId) query.sensorId = sensorId;
      if (type) query.type = type;

      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      }

      const skip = (page - 1) * limit;
      const sensorData = await SensorData.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const total = await SensorData.countDocuments(query);

      res.status(200).json({
        success: true,
        data: {
          sensorData,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            itemsPerPage: parseInt(limit)
          },
          summary: {
            averageValue: sensorData.length > 0 ?
              sensorData.reduce((sum, item) => sum + item.value, 0) / sensorData.length : 0,
            minValue: sensorData.length > 0 ? Math.min(...sensorData.map(item => item.value)) : 0,
            maxValue: sensorData.length > 0 ? Math.max(...sensorData.map(item => item.value)) : 0
          }
        }
      });
    } catch (error) {
      next(error);
    }
  },

  getSensorStatus: async (req, res, next) => {
    try {
      const { unitId } = req.params;

      const unit = await CarbonCaptureUnit.findOne({ unitId })
        .select('sensors unitId')
        .lean();

      if (!unit) {
        return res.status(404).json({
          success: false,
          error: 'Unit not found'
        });
      }

      const sensorStatuses = await Promise.all(
        unit.sensors.map(async (sensor) => {
          const latestReading = await SensorData.findOne({ sensorId: sensor.sensorId })
            .sort({ timestamp: -1 })
            .select('timestamp value quality')
            .lean();

          return {
            sensorId: sensor.sensorId,
            type: sensor.type,
            status: sensor.status,
            lastReading: latestReading ? {
              timestamp: latestReading.timestamp,
              value: latestReading.value,
              quality: latestReading.quality
            } : null,
            isActive: latestReading &&
              (new Date() - new Date(latestReading.timestamp)) < (5 * 60 * 1000) // 5 minutes
          };
        })
      );

      res.status(200).json({
        success: true,
        data: {
          unitId,
          sensors: sensorStatuses,
          summary: {
            totalSensors: sensorStatuses.length,
            activeSensors: sensorStatuses.filter(s => s.isActive).length,
            inactiveSensors: sensorStatuses.filter(s => !s.isActive).length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
};

// Mock anomaly detection function
async function checkForAnomalies(sensorData) {
  // Simple anomaly detection based on value thresholds
  const thresholds = {
    temperature: { min: -10, max: 100 },
    pressure: { min: 0, max: 200 },
    co2_concentration: { min: 0, max: 1000 },
    flow_rate: { min: 0, max: 1000 }
  };

  const threshold = thresholds[sensorData.type];
  if (threshold) {
    return sensorData.value < threshold.min || sensorData.value > threshold.max;
  }

  return false;
}

describe('Sensor Controller Integration', () => {
  let req, res, next;
  let sensorDataSaveStub, unitUpdateStub;

  beforeEach(() => {
    // Setup request/response mocks
    req = {
      params: {},
      query: {},
      user: { id: 'user123', role: 'operator' },
    };

    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub().returnsThis(),
    };

    next = sinon.stub();

    // Stub database operations
    sensorDataSaveStub = sinon.stub(SensorData.prototype, 'save').resolves();
    unitUpdateStub = sinon.stub(CarbonCaptureUnit, 'findOneAndUpdate').resolves();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('receiveSensorData', () => {
    it('should successfully receive and store sensor data', async () => {
      // Setup
      req.body = {
        sensorId: 'TEMP-001',
        unitId: 'CC-001',
        type: 'temperature',
        value: 75.5,
        unit: 'celsius',
        quality: 0.95,
        location: 'Intake Chamber',
        metadata: { calibration_date: '2024-01-15' }
      };

      // Mock the saved document
      const mockSavedDoc = {
        _id: '507f1f77bcf86cd799439011',
        ...req.body,
        timestamp: new Date()
      };

      sensorDataSaveStub.resolves(mockSavedDoc);

      // Execute
      await sensorController.receiveSensorData(req, res, next);

      // Assert
      expect(sensorDataSaveStub.calledOnce).to.be.true;
      expect(unitUpdateStub.calledOnce).to.be.true;
      expect(res.status.calledWith(201)).to.be.true;
      expect(res.json.calledOnce).to.be.true;

      const response = res.json.firstCall.args[0];
      expect(response.success).to.be.true;
      expect(response.data.sensorId).to.equal('TEMP-001');
      expect(response.data.unitId).to.equal('CC-001');
      expect(response.data.anomalyDetected).to.be.false; // 75.5 is within temperature range
    });

    it('should detect temperature anomaly', async () => {
      req.body = {
        sensorId: 'TEMP-001',
        unitId: 'CC-001',
        type: 'temperature',
        value: 150, // Above max threshold of 100
        unit: 'celsius'
      };

      const mockSavedDoc = {
        _id: '507f1f77bcf86cd799439012',
        ...req.body,
        timestamp: new Date()
      };

      sensorDataSaveStub.resolves(mockSavedDoc);

      await sensorController.receiveSensorData(req, res, next);

      const response = res.json.firstCall.args[0];
      expect(response.data.anomalyDetected).to.be.true;
    });

    it('should reject data with missing required fields', async () => {
      req.body = {
        sensorId: 'TEMP-001',
        // Missing unitId, type, and value
        unit: 'celsius'
      };

      await sensorController.receiveSensorData(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      const response = res.json.firstCall.args[0];
      expect(response.success).to.be.false;
      expect(response.error).to.include('Missing required fields');
    });

    it('should handle database save errors', async () => {
      req.body = {
        sensorId: 'TEMP-001',
        unitId: 'CC-001',
        type: 'temperature',
        value: 75.5
      };

      sensorDataSaveStub.rejects(new Error('Database connection failed'));

      await sensorController.receiveSensorData(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.an('error');
      expect(next.firstCall.args[0].message).to.equal('Database connection failed');
    });

    it('should set default values for optional fields', async () => {
      req.body = {
        sensorId: 'TEMP-001',
        unitId: 'CC-001',
        type: 'temperature',
        value: 75.5
        // No unit, quality, location, or metadata provided
      };

      const mockSavedDoc = {
        _id: '507f1f77bcf86cd799439013',
        ...req.body,
        unit: 'default', // Should be set to default
        quality: 1.0, // Should be set to 1.0
        timestamp: new Date()
      };

      sensorDataSaveStub.resolves(mockSavedDoc);

      await sensorController.receiveSensorData(req, res, next);

      expect(sensorDataSaveStub.calledOnce).to.be.true;
      const savedData = sensorDataSaveStub.thisValues[0];
      expect(savedData.unit).to.equal('default');
      expect(savedData.quality).to.equal(1.0);
    });
  });

  describe('getSensorHistory', () => {
    let findStub, countStub;

    beforeEach(() => {
      findStub = sinon.stub(SensorData, 'find').returns({
        sort: sinon.stub().returns({
          skip: sinon.stub().returns({
            limit: sinon.stub().returns({
              lean: sinon.stub().resolves([
                { sensorId: 'TEMP-001', value: 75.5, timestamp: new Date(), type: 'temperature' },
                { sensorId: 'TEMP-001', value: 76.2, timestamp: new Date(Date.now() - 3600000), type: 'temperature' }
              ])
            })
          })
        })
      });

      countStub = sinon.stub(SensorData, 'countDocuments').resolves(50);
    });

    it('should retrieve sensor history with pagination', async () => {
      req.params = { unitId: 'CC-001', sensorId: 'TEMP-001' };
      req.query = { limit: '10', page: '2' };

      await sensorController.getSensorHistory(req, res, next);

      expect(findStub.calledOnce).to.be.true;
      expect(countStub.calledOnce).to.be.true;
      expect(res.status.calledWith(200)).to.be.true;

      const response = res.json.firstCall.args[0];
      expect(response.success).to.be.true;
      expect(response.data.sensorData).to.be.an('array');
      expect(response.data.pagination.currentPage).to.equal(2);
      expect(response.data.pagination.totalItems).to.equal(50);
      expect(response.data.summary.averageValue).to.be.above(0);
    });

    it('should filter by date range', async () => {
      req.params = { unitId: 'CC-001' };
      req.query = {
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z'
      };

      await sensorController.getSensorHistory(req, res, next);

      expect(findStub.calledOnce).to.be.true;
      const query = findStub.firstCall.args[0];
      expect(query.timestamp).to.have.property('$gte');
      expect(query.timestamp).to.have.property('$lte');
    });

    it('should filter by sensor type', async () => {
      req.params = { unitId: 'CC-001', type: 'temperature' };

      await sensorController.getSensorHistory(req, res, next);

      expect(findStub.calledOnce).to.be.true;
      const query = findStub.firstCall.args[0];
      expect(query.type).to.equal('temperature');
    });

    it('should handle empty results', async () => {
      findStub.returns({
        sort: sinon.stub().returns({
          skip: sinon.stub().returns({
            limit: sinon.stub().returns({
              lean: sinon.stub().resolves([])
            })
          })
        })
      });
      countStub.resolves(0);

      req.params = { unitId: 'CC-001' };

      await sensorController.getSensorHistory(req, res, next);

      const response = res.json.firstCall.args[0];
      expect(response.data.sensorData).to.be.an('array').with.length(0);
      expect(response.data.summary.averageValue).to.equal(0);
      expect(response.data.summary.minValue).to.equal(0);
      expect(response.data.summary.maxValue).to.equal(0);
    });
  });

  describe('getSensorStatus', () => {
    let findOneStub;

    beforeEach(() => {
      findOneStub = sinon.stub(CarbonCaptureUnit, 'findOne');
      sinon.stub(SensorData, 'findOne').resolves({
        timestamp: new Date(),
        value: 75.5,
        quality: 0.95
      });
    });

    it('should return sensor status for a unit', async () => {
      const mockUnit = {
        unitId: 'CC-001',
        sensors: [
          { sensorId: 'TEMP-001', type: 'temperature', status: 'active' },
          { sensorId: 'PRESS-001', type: 'pressure', status: 'active' }
        ]
      };

      findOneStub.resolves(mockUnit);

      req.params = { unitId: 'CC-001' };

      await sensorController.getSensorStatus(req, res, next);

      expect(findOneStub.calledOnce).to.be.true;
      expect(res.status.calledWith(200)).to.be.true;

      const response = res.json.firstCall.args[0];
      expect(response.success).to.be.true;
      expect(response.data.unitId).to.equal('CC-001');
      expect(response.data.sensors).to.be.an('array').with.length(2);
      expect(response.data.summary.totalSensors).to.equal(2);
    });

    it('should handle unit not found', async () => {
      findOneStub.resolves(null);

      req.params = { unitId: 'NONEXISTENT' };

      await sensorController.getSensorStatus(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
      const response = res.json.firstCall.args[0];
      expect(response.success).to.be.false;
      expect(response.error).to.equal('Unit not found');
    });

    it('should identify inactive sensors', async () => {
      const mockUnit = {
        unitId: 'CC-001',
        sensors: [
          { sensorId: 'TEMP-001', type: 'temperature', status: 'active' }
        ]
      };

      findOneStub.resolves(mockUnit);

      // Mock old reading (more than 5 minutes ago)
      SensorData.findOne.resolves({
        timestamp: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        value: 75.5,
        quality: 0.95
      });

      req.params = { unitId: 'CC-001' };

      await sensorController.getSensorStatus(req, res, next);

      const response = res.json.firstCall.args[0];
      expect(response.data.sensors[0].isActive).to.be.false;
      expect(response.data.summary.activeSensors).to.equal(0);
      expect(response.data.summary.inactiveSensors).to.equal(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      sensorDataSaveStub.rejects(new Error('Connection timeout'));

      req.body = {
        sensorId: 'TEMP-001',
        unitId: 'CC-001',
        type: 'temperature',
        value: 75.5
      };

      await sensorController.receiveSensorData(req, res, next);

      expect(next.calledOnce).to.be.true;
    });

    it('should handle invalid date parameters', async () => {
      sinon.stub(SensorData, 'find').throws(new Error('Invalid date format'));

      req.params = { unitId: 'CC-001' };
      req.query = { startDate: 'invalid-date' };

      await sensorController.getSensorHistory(req, res, next);

      expect(next.calledOnce).to.be.true;
    });

    it('should handle malformed sensor data', async () => {
      req.body = {
        sensorId: 'TEMP-001',
        unitId: 'CC-001',
        type: 'temperature',
        value: 'not-a-number' // Invalid value
      };

      await sensorController.receiveSensorData(req, res, next);

      // Should still attempt to save, but database validation would catch this
      expect(sensorDataSaveStub.calledOnce).to.be.true;
    });
  });

  describe('Data Validation', () => {
    it('should validate sensor value ranges', async () => {
      req.body = {
        sensorId: 'TEMP-001',
        unitId: 'CC-001',
        type: 'temperature',
        value: -50 // Below minimum threshold
      };

      const mockSavedDoc = {
        _id: '507f1f77bcf86cd799439014',
        ...req.body,
        timestamp: new Date()
      };

      sensorDataSaveStub.resolves(mockSavedDoc);

      await sensorController.receiveSensorData(req, res, next);

      const response = res.json.firstCall.args[0];
      expect(response.data.anomalyDetected).to.be.true;
    });

    it('should handle unknown sensor types gracefully', async () => {
      req.body = {
        sensorId: 'UNKNOWN-001',
        unitId: 'CC-001',
        type: 'unknown_sensor_type',
        value: 100
      };

      const mockSavedDoc = {
        _id: '507f1f77bcf86cd799439015',
        ...req.body,
        timestamp: new Date()
      };

      sensorDataSaveStub.resolves(mockSavedDoc);

      await sensorController.receiveSensorData(req, res, next);

      const response = res.json.firstCall.args[0];
      expect(response.data.anomalyDetected).to.be.false; // No anomaly detection for unknown types
    });
  });

  describe('Performance', () => {
    it('should handle high-frequency data ingestion', async function() {
      this.timeout(10000); // 10 second timeout

      const numReadings = 100;
      const promises = [];

      for (let i = 0; i < numReadings; i++) {
        const req_i = {
          body: {
            sensorId: `TEMP-${i.toString().padStart(3, '0')}`,
            unitId: 'CC-001',
            type: 'temperature',
            value: 20 + Math.random() * 30
          }
        };

        const res_i = {
          status: sinon.stub().returnsThis(),
          json: sinon.stub().returnsThis(),
        };

        promises.push(sensorController.receiveSensorData(req_i, res_i, sinon.stub()));
      }

      const startTime = Date.now();
      await Promise.all(promises);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      const avgTimePerRequest = totalTime / numReadings;

      expect(avgTimePerRequest).to.be.below(100); // Less than 100ms per request
    });
  });
});
