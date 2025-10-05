const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
const sensorRoutes = require('../../src/routes/sensors');
const SensorData = require('../../src/models/SensorData');
const CarbonCaptureUnit = require('../../src/models/CarbonCaptureUnit');

describe('Sensor Controller Integration Tests', function() {
  let app;
  let server;
  let testUnit;
  let testSensor;

  before(async function() {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/carbon_capture_test', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    // Create test app
    app = express();
    app.use(express.json());

    // Mock authentication middleware
    app.use('/api/sensors', (req, res, next) => {
      req.user = {
        _id: 'test_user_123',
        role: 'operator'
      };
      next();
    });

    app.use('/api/sensors', sensorRoutes);

    server = app.listen(3002);
  });

  after(async function() {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    server.close();
  });

  beforeEach(async function() {
    // Clear collections
    await SensorData.deleteMany({});
    await CarbonCaptureUnit.deleteMany({});

    // Create test unit
    testUnit = await CarbonCaptureUnit.create({
      name: 'Test Carbon Capture Unit',
      type: 'direct_air_capture',
      capacity_tons_per_day: 100,
      location: {
        latitude: 40.7128,
        longitude: -74.0060
      },
      operators: ['test_user_123'],
      sensors: []
    });

    // Create test sensor data
    testSensor = await SensorData.create({
      sensor_id: 'TEMP-001',
      sensor_type: 'temperature',
      unit_id: testUnit._id,
      value: 25.5,
      unit: 'celsius',
      quality: 'good',
      timestamp: new Date(),
      metadata: {
        reading_number: 1,
        calibration_drift: 0.1
      }
    });
  });

  describe('GET /api/sensors', function() {
    it('should return all sensors for authorized user', async function() {
      const response = await request(app)
        .get('/api/sensors')
        .expect(200);

      expect(response.body).to.have.property('sensors');
      expect(response.body.sensors).to.be.an('array');
      expect(response.body.sensors.length).to.be.greaterThan(0);
    });

    it('should filter sensors by unit', async function() {
      const response = await request(app)
        .get('/api/sensors')
        .query({ unit_id: testUnit._id.toString() })
        .expect(200);

      expect(response.body.sensors).to.be.an('array');
      expect(response.body.sensors.length).to.be.greaterThan(0);
      response.body.sensors.forEach(sensor => {
        expect(sensor.unit_id.toString()).to.equal(testUnit._id.toString());
      });
    });

    it('should filter sensors by type', async function() {
      const response = await request(app)
        .get('/api/sensors')
        .query({ type: 'temperature' })
        .expect(200);

      expect(response.body.sensors).to.be.an('array');
      response.body.sensors.forEach(sensor => {
        expect(sensor.sensor_type).to.equal('temperature');
      });
    });

    it('should support pagination', async function() {
      // Create multiple sensors
      const sensors = [];
      for (let i = 0; i < 5; i++) {
        sensors.push({
          sensor_id: `TEMP-00${i + 2}`,
          sensor_type: 'temperature',
          unit_id: testUnit._id,
          value: 25 + i,
          unit: 'celsius',
          quality: 'good',
          timestamp: new Date()
        });
      }
      await SensorData.insertMany(sensors);

      const response = await request(app)
        .get('/api/sensors')
        .query({ page: 1, limit: 3 })
        .expect(200);

      expect(response.body.sensors).to.have.length(3);
      expect(response.body).to.have.property('pagination');
      expect(response.body.pagination).to.have.property('page', 1);
      expect(response.body.pagination).to.have.property('limit', 3);
    });
  });

  describe('GET /api/sensors/:id', function() {
    it('should return specific sensor', async function() {
      const response = await request(app)
        .get(`/api/sensors/${testSensor._id}`)
        .expect(200);

      expect(response.body).to.have.property('sensor');
      expect(response.body.sensor._id).to.equal(testSensor._id.toString());
      expect(response.body.sensor.sensor_id).to.equal('TEMP-001');
    });

    it('should return 404 for non-existent sensor', async function() {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/sensors/${fakeId}`)
        .expect(404);

      expect(response.body).to.have.property('error', 'Sensor not found');
    });
  });

  describe('POST /api/sensors', function() {
    it('should create new sensor data', async function() {
      const newSensorData = {
        sensor_id: 'PRESS-001',
        sensor_type: 'pressure',
        unit_id: testUnit._id.toString(),
        value: 45.2,
        unit: 'psi',
        quality: 'good',
        timestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/sensors')
        .send(newSensorData)
        .expect(201);

      expect(response.body).to.have.property('sensor');
      expect(response.body.sensor.sensor_id).to.equal('PRESS-001');
      expect(response.body.sensor.value).to.equal(45.2);

      // Verify sensor was added to unit
      const updatedUnit = await CarbonCaptureUnit.findById(testUnit._id);
      expect(updatedUnit.sensors).to.include(response.body.sensor._id);
    });

    it('should validate required fields', async function() {
      const invalidSensorData = {
        sensor_id: 'INVALID-001'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/sensors')
        .send(invalidSensorData)
        .expect(400);

      expect(response.body).to.have.property('error');
    });

    it('should validate sensor value ranges', async function() {
      const invalidSensorData = {
        sensor_id: 'TEMP-002',
        sensor_type: 'temperature',
        unit_id: testUnit._id.toString(),
        value: 200, // Invalid temperature
        unit: 'celsius',
        quality: 'good'
      };

      const response = await request(app)
        .post('/api/sensors')
        .send(invalidSensorData)
        .expect(400);

      expect(response.body).to.have.property('error');
    });
  });

  describe('PUT /api/sensors/:id', function() {
    it('should update sensor data', async function() {
      const updateData = {
        value: 28.5,
        quality: 'fair'
      };

      const response = await request(app)
        .put(`/api/sensors/${testSensor._id}`)
        .send(updateData)
        .expect(200);

      expect(response.body).to.have.property('sensor');
      expect(response.body.sensor.value).to.equal(28.5);
      expect(response.body.sensor.quality).to.equal('fair');

      // Verify in database
      const updatedSensor = await SensorData.findById(testSensor._id);
      expect(updatedSensor.value).to.equal(28.5);
      expect(updatedSensor.quality).to.equal('fair');
    });

    it('should return 404 for non-existent sensor', async function() {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .put(`/api/sensors/${fakeId}`)
        .send({ value: 30 })
        .expect(404);

      expect(response.body).to.have.property('error', 'Sensor not found');
    });
  });

  describe('DELETE /api/sensors/:id', function() {
    it('should delete sensor data', async function() {
      const response = await request(app)
        .delete(`/api/sensors/${testSensor._id}`)
        .expect(200);

      expect(response.body).to.have.property('message', 'Sensor deleted successfully');

      // Verify sensor was removed from database
      const deletedSensor = await SensorData.findById(testSensor._id);
      expect(deletedSensor).to.be.null;

      // Verify sensor was removed from unit
      const updatedUnit = await CarbonCaptureUnit.findById(testUnit._id);
      expect(updatedUnit.sensors).to.not.include(testSensor._id);
    });
  });

  describe('POST /api/sensors/:id/readings', function() {
    it('should add sensor reading', async function() {
      const readingData = {
        value: 26.8,
        quality: 'good',
        timestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post(`/api/sensors/${testSensor._id}/readings`)
        .send(readingData)
        .expect(201);

      expect(response.body).to.have.property('reading');
      expect(response.body.reading.value).to.equal(26.8);
      expect(response.body.reading.quality).to.equal('good');
    });

    it('should validate reading data', async function() {
      const invalidReading = {
        value: 'not-a-number',
        quality: 'invalid'
      };

      const response = await request(app)
        .post(`/api/sensors/${testSensor._id}/readings`)
        .send(invalidReading)
        .expect(400);

      expect(response.body).to.have.property('error');
    });
  });

  describe('GET /api/sensors/:id/readings', function() {
    beforeEach(async function() {
      // Add multiple readings
      const readings = [];
      for (let i = 0; i < 5; i++) {
        readings.push({
          sensor_id: testSensor.sensor_id,
          sensor_type: testSensor.sensor_type,
          unit_id: testSensor.unit_id,
          value: 25 + i * 0.5,
          unit: 'celsius',
          quality: 'good',
          timestamp: new Date(Date.now() - (4 - i) * 60 * 1000) // 4 minutes ago to now
        });
      }
      await SensorData.insertMany(readings);
    });

    it('should return sensor readings', async function() {
      const response = await request(app)
        .get(`/api/sensors/${testSensor._id}/readings`)
        .expect(200);

      expect(response.body).to.have.property('readings');
      expect(response.body.readings).to.be.an('array');
      expect(response.body.readings.length).to.be.greaterThan(0);

      // Verify readings are sorted by timestamp (newest first)
      for (let i = 0; i < response.body.readings.length - 1; i++) {
        const current = new Date(response.body.readings[i].timestamp);
        const next = new Date(response.body.readings[i + 1].timestamp);
        expect(current.getTime()).to.be.greaterThanOrEqual(next.getTime());
      }
    });

    it('should filter readings by time range', async function() {
      const startTime = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // 2 minutes ago
      const endTime = new Date().toISOString();

      const response = await request(app)
        .get(`/api/sensors/${testSensor._id}/readings`)
        .query({ startTime, endTime })
        .expect(200);

      expect(response.body.readings).to.be.an('array');
      response.body.readings.forEach(reading => {
        const readingTime = new Date(reading.timestamp);
        expect(readingTime.getTime()).to.be.greaterThanOrEqual(new Date(startTime).getTime());
        expect(readingTime.getTime()).to.be.lessThanOrEqual(new Date(endTime).getTime());
      });
    });

    it('should support pagination for readings', async function() {
      const response = await request(app)
        .get(`/api/sensors/${testSensor._id}/readings`)
        .query({ page: 1, limit: 2 })
        .expect(200);

      expect(response.body.readings).to.have.length(2);
      expect(response.body).to.have.property('pagination');
    });
  });

  describe('GET /api/sensors/:id/alerts', function() {
    beforeEach(async function() {
      // Create sensors with anomalous readings
      await SensorData.insertMany([
        {
          sensor_id: testSensor.sensor_id,
          sensor_type: 'temperature',
          unit_id: testUnit._id,
          value: 80, // Anomalous high temperature
          unit: 'celsius',
          quality: 'good',
          timestamp: new Date(),
          metadata: {
            reading_number: 2,
            calibration_drift: 0.2,
            is_anomaly: true
          }
        },
        {
          sensor_id: testSensor.sensor_id,
          sensor_type: 'temperature',
          unit_id: testUnit._id,
          value: 25.2,
          unit: 'celsius',
          quality: 'poor', // Poor quality
          timestamp: new Date(Date.now() - 60 * 1000),
          metadata: {
            reading_number: 3,
            calibration_drift: 0.1,
            is_anomaly: false
          }
        }
      ]);
    });

    it('should return sensor alerts', async function() {
      const response = await request(app)
        .get(`/api/sensors/${testSensor._id}/alerts`)
        .expect(200);

      expect(response.body).to.have.property('alerts');
      expect(response.body.alerts).to.be.an('array');
      expect(response.body.alerts.length).to.be.greaterThan(0);

      // Check alert structure
      response.body.alerts.forEach(alert => {
        expect(alert).to.have.property('type');
        expect(alert).to.have.property('message');
        expect(alert).to.have.property('severity');
        expect(alert).to.have.property('timestamp');
      });
    });

    it('should filter alerts by time range', async function() {
      const hours = 1;
      const response = await request(app)
        .get(`/api/sensors/${testSensor._id}/alerts`)
        .query({ hours })
        .expect(200);

      expect(response.body.alerts).to.be.an('array');
    });
  });

  describe('POST /api/sensors/:id/calibrate', function() {
    it('should calibrate sensor', async function() {
      const calibrationData = {
        offset: -0.5,
        notes: 'Temperature sensor calibration'
      };

      const response = await request(app)
        .post(`/api/sensors/${testSensor._id}/calibrate`)
        .send(calibrationData)
        .expect(200);

      expect(response.body).to.have.property('message', 'Sensor calibrated successfully');

      // Verify calibration was recorded
      const updatedSensor = await SensorData.findById(testSensor._id);
      expect(updatedSensor).to.have.property('calibration_history');
      expect(updatedSensor.calibration_history).to.be.an('array');
      expect(updatedSensor.calibration_history.length).to.be.greaterThan(0);
    });

    it('should validate calibration data', async function() {
      const invalidCalibration = {
        offset: 'not-a-number',
        notes: 'Invalid calibration'
      };

      const response = await request(app)
        .post(`/api/sensors/${testSensor._id}/calibrate`)
        .send(invalidCalibration)
        .expect(400);

      expect(response.body).to.have.property('error');
    });
  });

  describe('GET /api/sensors/:id/statistics', function() {
    beforeEach(async function() {
      // Create multiple readings for statistics
      const readings = [];
      for (let i = 0; i < 24; i++) { // 24 hours of data
        readings.push({
          sensor_id: testSensor.sensor_id,
          sensor_type: testSensor.sensor_type,
          unit_id: testUnit._id,
          value: 25 + Math.sin(i / 24 * 2 * Math.PI) * 2, // Sine wave pattern
          unit: 'celsius',
          quality: i % 10 === 0 ? 'poor' : 'good', // Some poor quality readings
          timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000), // Hourly readings
          metadata: {
            reading_number: i + 2,
            calibration_drift: Math.random() * 0.2 - 0.1,
            is_anomaly: Math.random() < 0.05 // 5% anomaly rate
          }
        });
      }
      await SensorData.insertMany(readings);
    });

    it('should return sensor statistics', async function() {
      const response = await request(app)
        .get(`/api/sensors/${testSensor._id}/statistics`)
        .query({ days: 1 })
        .expect(200);

      expect(response.body).to.have.property('statistics');
      const stats = response.body.statistics;

      expect(stats).to.have.property('total_readings');
      expect(stats).to.have.property('avg_value');
      expect(stats).to.have.property('min_value');
      expect(stats).to.have.property('max_value');
      expect(stats).to.have.property('std_dev');
      expect(stats).to.have.property('anomaly_rate');
      expect(stats).to.have.property('quality_distribution');

      expect(stats.total_readings).to.be.greaterThan(0);
      expect(stats.avg_value).to.be.a('number');
      expect(stats.anomaly_rate).to.be.a('number');
      expect(stats.quality_distribution).to.be.an('object');
    });

    it('should calculate correct statistics', async function() {
      const response = await request(app)
        .get(`/api/sensors/${testSensor._id}/statistics`)
        .query({ days: 1 })
        .expect(200);

      const stats = response.body.statistics;

      // Verify statistical calculations
      expect(stats.avg_value).to.be.closeTo(25, 3); // Should be close to 25
      expect(stats.min_value).to.be.lessThan(stats.avg_value);
      expect(stats.max_value).to.be.greaterThan(stats.avg_value);
      expect(stats.std_dev).to.be.greaterThan(0);
      expect(stats.anomaly_rate).to.be.at.least(0);
      expect(stats.anomaly_rate).to.be.at.most(1);
    });
  });

  describe('Error Handling', function() {
    it('should handle database connection errors', async function() {
      // Temporarily disconnect from database
      await mongoose.connection.close();

      const response = await request(app)
        .get('/api/sensors')
        .expect(500);

      expect(response.body).to.have.property('error');

      // Reconnect for other tests
      await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/carbon_capture_test');
    });

    it('should handle invalid sensor IDs', async function() {
      const response = await request(app)
        .get('/api/sensors/invalid-id')
        .expect(400);

      expect(response.body).to.have.property('error');
    });

    it('should handle unauthorized access', async function() {
      // Remove authentication middleware temporarily
      app._router.stack = app._router.stack.filter(layer =>
        !layer.route || layer.route.path !== '/api/sensors'
      );

      const response = await request(app)
        .post('/api/sensors')
        .send({ sensor_id: 'TEST-001' })
        .expect(401);

      expect(response.body).to.have.property('error');
    });
  });
});
