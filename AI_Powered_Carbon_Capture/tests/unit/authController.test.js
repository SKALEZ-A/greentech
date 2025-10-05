/**
 * Unit tests for Authentication Controller
 */

const chai = require('chai');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { expect } = chai;

// Mock dependencies
const User = require('../../backend/src/models/User');

// Import controller functions (you might need to refactor to make them testable)
const {
  register,
  login,
  getMe,
  updateDetails,
  updatePassword,
  generateApiKey,
  getApiKeys,
  deleteApiKey,
} = require('../../backend/src/controllers/authController');

describe('Auth Controller', () => {
  let req, res, next;
  let userStub, jwtStub, bcryptStub;

  beforeEach(() => {
    // Setup mocks
    req = {
      body: {},
      user: { id: 'user123' },
      params: {},
    };

    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub().returnsThis(),
    };

    next = sinon.stub();

    // Stub external dependencies
    userStub = sinon.stub(User);
    jwtStub = sinon.stub(jwt);
    bcryptStub = sinon.stub(bcrypt);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      // Setup
      req.body = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
      };

      const mockUser = {
        _id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        isVerified: false,
        createdAt: new Date(),
      };

      // Mock User.findOne to return null (user doesn't exist)
      userStub.findOne.resolves(null);

      // Mock User.create to return the new user
      userStub.create.resolves(mockUser);

      // Mock jwt.sign
      jwtStub.sign.returns('mocktoken');

      // Execute
      await register(req, res, next);

      // Assert
      expect(res.status.calledWith(201)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0].success).to.be.true;
      expect(res.json.firstCall.args[0].data.user.username).to.equal('testuser');
      expect(res.json.firstCall.args[0].data.tokens.accessToken).to.equal('mocktoken');
    });

    it('should return error if user already exists', async () => {
      // Setup
      req.body = {
        username: 'existinguser',
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'Existing',
        lastName: 'User',
      };

      // Mock User.findOne to return existing user
      userStub.findOne.resolves({ _id: 'existing123' });

      // Execute
      await register(req, res, next);

      // Assert
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].message).to.equal('User already exists');
    });

    it('should return error if required fields are missing', async () => {
      // Setup - missing required fields
      req.body = {
        email: 'test@example.com',
        // missing username, password, firstName, lastName
      };

      // Execute
      await register(req, res, next);

      // Assert
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].message).to.equal('Please provide all required fields');
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      // Setup
      req.body = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        password: 'hashedpassword',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        isVerified: true,
        isActive: true,
        lastLogin: null,
        matchPassword: sinon.stub().resolves(true),
        updateLastLogin: sinon.stub().resolves(),
      };

      // Mock User.findOne
      userStub.findOne.resolves(mockUser);

      // Mock jwt.sign
      jwtStub.sign.returns('mocktoken');

      // Execute
      await login(req, res, next);

      // Assert
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0].success).to.be.true;
      expect(res.json.firstCall.args[0].data.user.email).to.equal('test@example.com');
      expect(mockUser.updateLastLogin.calledOnce).to.be.true;
    });

    it('should return error for invalid credentials', async () => {
      // Setup
      req.body = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      // Mock User.findOne to return null
      userStub.findOne.resolves(null);

      // Execute
      await login(req, res, next);

      // Assert
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].message).to.equal('Invalid credentials');
    });

    it('should return error for inactive account', async () => {
      // Setup
      req.body = {
        email: 'inactive@example.com',
        password: 'password123',
      };

      const mockUser = {
        _id: 'user123',
        email: 'inactive@example.com',
        isActive: false,
        matchPassword: sinon.stub().resolves(true),
      };

      // Mock User.findOne
      userStub.findOne.resolves(mockUser);

      // Execute
      await login(req, res, next);

      // Assert
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].message).to.equal('Account is deactivated');
    });
  });

  describe('getMe', () => {
    it('should return current user details', async () => {
      // Setup
      req.user = { id: 'user123' };

      const mockUser = {
        _id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        isActive: true,
      };

      // Mock User.findById
      userStub.findById.resolves(mockUser);

      // Execute
      await getMe(req, res, next);

      // Assert
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0].success).to.be.true;
      expect(res.json.firstCall.args[0].data.username).to.equal('testuser');
    });
  });

  describe('updateDetails', () => {
    it('should update user details successfully', async () => {
      // Setup
      req.user = { id: 'user123' };
      req.body = {
        firstName: 'Updated',
        lastName: 'Name',
        phone: '123-456-7890',
      };

      const mockUpdatedUser = {
        _id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Updated',
        lastName: 'Name',
        phone: '123-456-7890',
        role: 'user',
      };

      // Mock User.findByIdAndUpdate
      userStub.findByIdAndUpdate.resolves(mockUpdatedUser);

      // Execute
      await updateDetails(req, res, next);

      // Assert
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0].success).to.be.true;
      expect(res.json.firstCall.args[0].data.firstName).to.equal('Updated');
    });
  });

  describe('updatePassword', () => {
    it('should update password successfully', async () => {
      // Setup
      req.user = { id: 'user123' };
      req.body = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
      };

      const mockUser = {
        _id: 'user123',
        password: 'hashedoldpassword',
        matchPassword: sinon.stub().resolves(true),
        save: sinon.stub().resolves(),
      };

      // Mock User.findById
      userStub.findById.resolves(mockUser);

      // Execute
      await updatePassword(req, res, next);

      // Assert
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0].success).to.be.true;
      expect(mockUser.save.calledOnce).to.be.true;
    });

    it('should return error for incorrect current password', async () => {
      // Setup
      req.user = { id: 'user123' };
      req.body = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123',
      };

      const mockUser = {
        _id: 'user123',
        password: 'hashedoldpassword',
        matchPassword: sinon.stub().resolves(false),
      };

      // Mock User.findById
      userStub.findById.resolves(mockUser);

      // Execute
      await updatePassword(req, res, next);

      // Assert
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].message).to.equal('Password is incorrect');
    });
  });

  describe('generateApiKey', () => {
    it('should generate API key successfully', async () => {
      // Setup
      req.user = { id: 'user123' };
      req.body = {
        name: 'Test API Key',
        permissions: ['read', 'write'],
      };

      const mockUser = {
        _id: 'user123',
        username: 'testuser',
        generateApiKey: sinon.stub().returns('test-api-key-123'),
        save: sinon.stub().resolves(),
      };

      // Mock User.findById
      userStub.findById.resolves(mockUser);

      // Execute
      await generateApiKey(req, res, next);

      // Assert
      expect(res.status.calledWith(201)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0].success).to.be.true;
      expect(res.json.firstCall.args[0].data.apiKey).to.equal('test-api-key-123');
      expect(mockUser.save.calledOnce).to.be.true;
    });
  });

  describe('getApiKeys', () => {
    it('should return user API keys', async () => {
      // Setup
      req.user = { id: 'user123' };

      const mockApiKeys = [
        {
          name: 'Key 1',
          permissions: ['read'],
          createdAt: new Date(),
          isActive: true,
        },
        {
          name: 'Key 2',
          permissions: ['read', 'write'],
          createdAt: new Date(),
          isActive: true,
        },
      ];

      const mockUser = {
        _id: 'user123',
        apiKeys: mockApiKeys,
      };

      // Mock User.findById
      userStub.findById.resolves(mockUser);

      // Execute
      await getApiKeys(req, res, next);

      // Assert
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0].success).to.be.true;
      expect(res.json.firstCall.args[0].data).to.equal(mockApiKeys);
    });
  });

  describe('deleteApiKey', () => {
    it('should delete API key successfully', async () => {
      // Setup
      req.user = { id: 'user123' };
      req.params = { keyId: 'key123' };

      const mockUser = {
        _id: 'user123',
        apiKeys: [
          { _id: 'key123', name: 'Test Key' },
          { _id: 'key456', name: 'Another Key' },
        ],
        save: sinon.stub().resolves(),
      };

      // Mock User.findById
      userStub.findById.resolves(mockUser);

      // Execute
      await deleteApiKey(req, res, next);

      // Assert
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0].success).to.be.true;
      expect(mockUser.save.calledOnce).to.be.true;
    });
  });
});
