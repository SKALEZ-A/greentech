const { expect } = require('chai');
const sinon = require('sinon');
const unitController = require('../../src/controllers/unitController');
const CarbonCaptureUnit = require('../../src/models/CarbonCaptureUnit');

describe('UnitController', function() {
  let req, res, next;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = {
      body: {},
      params: {},
      query: {},
      user: {
        _id: 'user123',
        role: 'operator'
      }
    };

    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub().returnsThis(),
      send: sinon.stub().returnsThis()
    };

    next = sinon.stub();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getAllUnits', function() {
    it('should return all units for admin user', async function() {
      req.user.role = 'admin';

      const mockUnits = [
        {
          _id: 'unit1',
          name: 'Unit 1',
          status: 'operational',
          efficiency: 85
        },
        {
          _id: 'unit2',
          name: 'Unit 2',
          status: 'maintenance',
          efficiency: 78
        }
      ];

      const mockQuery = {
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        exec: sandbox.stub().resolves(mockUnits)
      };

      sandbox.stub(CarbonCaptureUnit, 'find').returns(mockQuery);

      await unitController.getAllUnits(req, res, next);

      expect(CarbonCaptureUnit.find.calledOnce).to.be.true;
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('units');
      expect(res.json.firstCall.args[0].units).to.deep.equal(mockUnits);
    });

    it('should filter units by operator ownership', async function() {
      req.user.role = 'operator';
      req.user._id = 'operator123';

      const mockUnits = [
        {
          _id: 'unit1',
          name: 'Unit 1',
          operators: ['operator123'],
          status: 'operational'
        }
      ];

      const mockQuery = {
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        exec: sandbox.stub().resolves(mockUnits)
      };

      sandbox.stub(CarbonCaptureUnit, 'find').returns(mockQuery);

      await unitController.getAllUnits(req, res, next);

      expect(CarbonCaptureUnit.find.calledWith({
        $or: [
          { operators: 'operator123' },
          { createdBy: 'operator123' }
        ]
      })).to.be.true;
    });

    it('should apply status filter', async function() {
      req.query.status = 'operational';

      const mockQuery = {
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        exec: sandbox.stub().resolves([])
      };

      sandbox.stub(CarbonCaptureUnit, 'find').returns(mockQuery);

      await unitController.getAllUnits(req, res, next);

      expect(CarbonCaptureUnit.find.calledWith(sinon.match({
        status: 'operational'
      }))).to.be.true;
    });

    it('should apply pagination', async function() {
      req.query.page = '2';
      req.query.limit = '10';

      const mockQuery = {
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        exec: sandbox.stub().resolves([])
      };

      sandbox.stub(CarbonCaptureUnit, 'find').returns(mockQuery);

      await unitController.getAllUnits(req, res, next);

      expect(mockQuery.skip.calledWith(10)).to.be.true;
      expect(mockQuery.limit.calledWith(10)).to.be.true;
    });
  });

  describe('getUnitById', function() {
    it('should return unit by ID', async function() {
      req.params.id = 'unit123';

      const mockUnit = {
        _id: 'unit123',
        name: 'Test Unit',
        status: 'operational',
        efficiency: 85,
        populate: sandbox.stub().resolvesThis()
      };

      sandbox.stub(CarbonCaptureUnit, 'findById').resolves(mockUnit);

      await unitController.getUnitById(req, res, next);

      expect(CarbonCaptureUnit.findById.calledWith('unit123')).to.be.true;
      expect(mockUnit.populate.calledWith('operators sensors')).to.be.true;
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('unit', mockUnit);
    });

    it('should return 404 for non-existent unit', async function() {
      req.params.id = 'nonexistent';

      sandbox.stub(CarbonCaptureUnit, 'findById').resolves(null);

      await unitController.getUnitById(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.an('error');
      expect(next.firstCall.args[0].statusCode).to.equal(404);
      expect(next.firstCall.args[0].message).to.equal('Unit not found');
    });

    it('should handle database errors', async function() {
      req.params.id = 'unit123';

      const dbError = new Error('Database connection failed');
      sandbox.stub(CarbonCaptureUnit, 'findById').rejects(dbError);

      await unitController.getUnitById(req, res, next);

      expect(next.calledWith(dbError)).to.be.true;
    });
  });

  describe('createUnit', function() {
    it('should create a new unit', async function() {
      const unitData = {
        name: 'New Carbon Capture Unit',
        type: 'direct_air_capture',
        capacity_tons_per_day: 100,
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          address: 'New York, NY'
        }
      };

      req.body = unitData;
      req.user.role = 'admin';

      const mockUnit = {
        _id: 'new_unit_123',
        ...unitData,
        createdBy: req.user._id,
        operators: [],
        sensors: [],
        save: sandbox.stub().resolvesThis()
      };

      sandbox.stub(CarbonCaptureUnit.prototype, 'save').resolves(mockUnit);

      await unitController.createUnit(req, res, next);

      expect(res.status.calledWith(201)).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('unit');
      expect(res.json.firstCall.args[0].unit).to.have.property('name', unitData.name);
      expect(res.json.firstCall.args[0].unit).to.have.property('createdBy', req.user._id);
    });

    it('should validate required fields', async function() {
      req.body = { name: 'Incomplete Unit' };
      req.user.role = 'admin';

      await unitController.createUnit(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.an('error');
      expect(next.firstCall.args[0].message).to.contain('Validation failed');
    });

    it('should prevent non-admin users from creating units', async function() {
      req.body = {
        name: 'Test Unit',
        type: 'direct_air_capture',
        capacity_tons_per_day: 100
      };
      req.user.role = 'operator';

      await unitController.createUnit(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.an('error');
      expect(next.firstCall.args[0].statusCode).to.equal(403);
    });
  });

  describe('updateUnit', function() {
    it('should update unit successfully', async function() {
      req.params.id = 'unit123';
      req.body = {
        name: 'Updated Unit Name',
        efficiency: 90
      };
      req.user.role = 'admin';

      const mockUnit = {
        _id: 'unit123',
        name: 'Original Name',
        efficiency: 85,
        save: sandbox.stub().resolvesThis()
      };

      sandbox.stub(CarbonCaptureUnit, 'findById').resolves(mockUnit);

      await unitController.updateUnit(req, res, next);

      expect(mockUnit.name).to.equal('Updated Unit Name');
      expect(mockUnit.efficiency).to.equal(90);
      expect(mockUnit.save.calledOnce).to.be.true;
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('unit', mockUnit);
    });

    it('should allow operators to update their assigned units', async function() {
      req.params.id = 'unit123';
      req.body = { efficiency: 88 };
      req.user.role = 'operator';
      req.user._id = 'operator123';

      const mockUnit = {
        _id: 'unit123',
        name: 'Test Unit',
        efficiency: 85,
        operators: ['operator123'],
        save: sandbox.stub().resolvesThis()
      };

      sandbox.stub(CarbonCaptureUnit, 'findById').resolves(mockUnit);

      await unitController.updateUnit(req, res, next);

      expect(mockUnit.efficiency).to.equal(88);
      expect(res.status.calledWith(200)).to.be.true;
    });

    it('should prevent operators from updating unassigned units', async function() {
      req.params.id = 'unit123';
      req.body = { efficiency: 88 };
      req.user.role = 'operator';
      req.user._id = 'operator123';

      const mockUnit = {
        _id: 'unit123',
        name: 'Test Unit',
        operators: ['different_operator']
      };

      sandbox.stub(CarbonCaptureUnit, 'findById').resolves(mockUnit);

      await unitController.updateUnit(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.an('error');
      expect(next.firstCall.args[0].statusCode).to.equal(403);
    });
  });

  describe('deleteUnit', function() {
    it('should delete unit successfully', async function() {
      req.params.id = 'unit123';
      req.user.role = 'admin';

      const mockUnit = {
        _id: 'unit123',
        name: 'Test Unit',
        remove: sandbox.stub().resolves()
      };

      sandbox.stub(CarbonCaptureUnit, 'findById').resolves(mockUnit);

      await unitController.deleteUnit(req, res, next);

      expect(mockUnit.remove.calledOnce).to.be.true;
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('message', 'Unit deleted successfully');
    });

    it('should prevent non-admin users from deleting units', async function() {
      req.params.id = 'unit123';
      req.user.role = 'operator';

      const mockUnit = {
        _id: 'unit123',
        name: 'Test Unit'
      };

      sandbox.stub(CarbonCaptureUnit, 'findById').resolves(mockUnit);

      await unitController.deleteUnit(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.an('error');
      expect(next.firstCall.args[0].statusCode).to.equal(403);
    });
  });

  describe('addOperator', function() {
    it('should add operator to unit', async function() {
      req.params.id = 'unit123';
      req.body.userId = 'operator456';
      req.user.role = 'admin';

      const mockUnit = {
        _id: 'unit123',
        name: 'Test Unit',
        operators: ['operator123'],
        save: sandbox.stub().resolvesThis()
      };

      sandbox.stub(CarbonCaptureUnit, 'findById').resolves(mockUnit);

      await unitController.addOperator(req, res, next);

      expect(mockUnit.operators).to.include('operator456');
      expect(mockUnit.save.calledOnce).to.be.true;
      expect(res.status.calledWith(200)).to.be.true;
    });

    it('should prevent adding duplicate operators', async function() {
      req.params.id = 'unit123';
      req.body.userId = 'operator123'; // Already in operators array
      req.user.role = 'admin';

      const mockUnit = {
        _id: 'unit123',
        operators: ['operator123']
      };

      sandbox.stub(CarbonCaptureUnit, 'findById').resolves(mockUnit);

      await unitController.addOperator(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.an('error');
      expect(next.firstCall.args[0].message).to.equal('Operator already assigned to this unit');
    });
  });

  describe('removeOperator', function() {
    it('should remove operator from unit', async function() {
      req.params.id = 'unit123';
      req.params.userId = 'operator456';
      req.user.role = 'admin';

      const mockUnit = {
        _id: 'unit123',
        operators: ['operator123', 'operator456'],
        save: sandbox.stub().resolvesThis()
      };

      sandbox.stub(CarbonCaptureUnit, 'findById').resolves(mockUnit);

      await unitController.removeOperator(req, res, next);

      expect(mockUnit.operators).to.not.include('operator456');
      expect(mockUnit.save.calledOnce).to.be.true;
      expect(res.status.calledWith(200)).to.be.true;
    });

    it('should handle removing non-existent operator', async function() {
      req.params.id = 'unit123';
      req.params.userId = 'nonexistent';
      req.user.role = 'admin';

      const mockUnit = {
        _id: 'unit123',
        operators: ['operator123']
      };

      sandbox.stub(CarbonCaptureUnit, 'findById').resolves(mockUnit);

      await unitController.removeOperator(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.an('error');
      expect(next.firstCall.args[0].message).to.equal('Operator not found in unit');
    });
  });

  describe('getUnitSensors', function() {
    it('should return unit sensors', async function() {
      req.params.id = 'unit123';

      const mockUnit = {
        _id: 'unit123',
        sensors: ['sensor1', 'sensor2'],
        populate: sandbox.stub().resolvesThis()
      };

      const populatedUnit = {
        ...mockUnit,
        sensors: [
          { _id: 'sensor1', type: 'temperature', sensor_id: 'TEMP-001' },
          { _id: 'sensor2', type: 'pressure', sensor_id: 'PRESS-001' }
        ]
      };

      mockUnit.populate.resolves(populatedUnit);

      sandbox.stub(CarbonCaptureUnit, 'findById').resolves(mockUnit);

      await unitController.getUnitSensors(req, res, next);

      expect(mockUnit.populate.calledWith('sensors')).to.be.true;
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('sensors');
      expect(res.json.firstCall.args[0].sensors).to.have.length(2);
    });
  });

  describe('getUnitAlerts', function() {
    it('should return unit alerts', async function() {
      req.params.id = 'unit123';
      req.query.hours = '24';

      const mockAlerts = [
        {
          _id: 'alert1',
          type: 'warning',
          message: 'High temperature detected',
          timestamp: new Date(),
          acknowledged: false
        }
      ];

      // Mock the alert query
      const mockAlertQuery = {
        sort: sandbox.stub().returnsThis(),
        populate: sandbox.stub().returnsThis(),
        exec: sandbox.stub().resolves(mockAlerts)
      };

      sandbox.stub(require('../../src/models/SensorData'), 'find').returns(mockAlertQuery);

      await unitController.getUnitAlerts(req, res, next);

      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('alerts');
    });
  });

  describe('acknowledgeAlert', function() {
    it('should acknowledge alert', async function() {
      req.params.id = 'unit123';
      req.params.alertId = 'alert123';

      const mockAlert = {
        _id: 'alert123',
        acknowledged: false,
        acknowledgedBy: null,
        acknowledgedAt: null,
        save: sandbox.stub().resolvesThis()
      };

      sandbox.stub(require('../../src/models/SensorData'), 'findById').resolves(mockAlert);

      await unitController.acknowledgeAlert(req, res, next);

      expect(mockAlert.acknowledged).to.be.true;
      expect(mockAlert.acknowledgedBy).to.equal(req.user._id);
      expect(mockAlert.acknowledgedAt).to.be.instanceOf(Date);
      expect(mockAlert.save.calledOnce).to.be.true;
      expect(res.status.calledWith(200)).to.be.true;
    });

    it('should handle non-existent alert', async function() {
      req.params.alertId = 'nonexistent';

      sandbox.stub(require('../../src/models/SensorData'), 'findById').resolves(null);

      await unitController.acknowledgeAlert(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.an('error');
      expect(next.firstCall.args[0].statusCode).to.equal(404);
    });
  });

  describe('getUnitStatistics', function() {
    it('should return unit statistics', async function() {
      req.params.id = 'unit123';
      req.query.days = '7';

      const mockStats = {
        totalReadings: 1008,
        avgEfficiency: 85.2,
        uptime: 95.3,
        alertsCount: 12,
        maintenanceCount: 2
      };

      // Mock aggregation pipeline
      sandbox.stub(require('../../src/models/SensorData'), 'aggregate').resolves([mockStats]);

      await unitController.getUnitStatistics(req, res, next);

      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('statistics');
    });
  });

  describe('getSystemHealth', function() {
    it('should return system health status', async function() {
      const mockHealth = {
        overall: 'healthy',
        units: {
          operational: 8,
          warning: 2,
          critical: 0,
          offline: 1
        },
        sensors: {
          active: 45,
          inactive: 3,
          error: 2
        },
        lastUpdated: new Date()
      };

      sandbox.stub(CarbonCaptureUnit, 'aggregate').resolves([mockHealth]);

      await unitController.getSystemHealth(req, res, next);

      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('health');
    });
  });
});
