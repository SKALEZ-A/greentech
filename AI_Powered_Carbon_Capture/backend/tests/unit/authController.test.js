const { expect } = require('chai');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const authController = require('../../src/controllers/authController');
const User = require('../../src/models/User');

describe('AuthController', function() {
  let req, res, next;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock request object
    req = {
      body: {},
      user: null,
      ip: '127.0.0.1',
      headers: {}
    };

    // Mock response object
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub().returnsThis(),
      cookie: sinon.stub().returnsThis(),
      clearCookie: sinon.stub().returnsThis()
    };

    // Mock next function
    next = sinon.stub();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('register', function() {
    it('should register a new user successfully', async function() {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'operator'
      };

      req.body = userData;

      // Mock User model
      const mockUser = {
        _id: 'user123',
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        isActive: true,
        save: sinon.stub().resolvesThis()
      };

      sandbox.stub(User, 'findOne').resolves(null);
      sandbox.stub(bcrypt, 'hash').resolves('hashedPassword');
      sandbox.stub(User.prototype, 'save').resolves(mockUser);

      await authController.register(req, res, next);

      expect(res.status.calledWith(201)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('message', 'User registered successfully');
      expect(res.json.firstCall.args[0]).to.have.property('user');
      expect(res.json.firstCall.args[0].user).to.have.property('email', userData.email);
    });

    it('should return error if user already exists', async function() {
      const userData = {
        email: 'existing@example.com',
        password: 'password123'
      };

      req.body = userData;

      const existingUser = { email: userData.email };
      sandbox.stub(User, 'findOne').resolves(existingUser);

      await authController.register(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.an('error');
      expect(next.firstCall.args[0].message).to.equal('User already exists');
    });

    it('should handle validation errors', async function() {
      req.body = {
        email: 'invalid-email',
        password: '123'
      };

      await authController.register(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.an('error');
    });
  });

  describe('login', function() {
    it('should login user with correct credentials', async function() {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      req.body = loginData;

      const mockUser = {
        _id: 'user123',
        email: loginData.email,
        password: 'hashedPassword',
        firstName: 'John',
        lastName: 'Doe',
        role: 'operator',
        isActive: true,
        loginAttempts: 0,
        lockUntil: null,
        save: sinon.stub().resolvesThis()
      };

      sandbox.stub(User, 'findOne').resolves(mockUser);
      sandbox.stub(bcrypt, 'compare').resolves(true);
      sandbox.stub(jwt, 'sign').returns('mockToken');

      await authController.login(req, res, next);

      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('message', 'Login successful');
      expect(res.json.firstCall.args[0]).to.have.property('token');
      expect(res.json.firstCall.args[0]).to.have.property('user');
    });

    it('should return error for invalid credentials', async function() {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      req.body = loginData;

      const mockUser = {
        _id: 'user123',
        email: loginData.email,
        password: 'hashedPassword',
        loginAttempts: 0,
        save: sinon.stub().resolvesThis()
      };

      sandbox.stub(User, 'findOne').resolves(mockUser);
      sandbox.stub(bcrypt, 'compare').resolves(false);

      await authController.login(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.an('error');
      expect(next.firstCall.args[0].message).to.equal('Invalid credentials');
    });

    it('should lock account after max failed attempts', async function() {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      req.body = loginData;

      const mockUser = {
        _id: 'user123',
        email: loginData.email,
        password: 'hashedPassword',
        loginAttempts: 4, // One less than max
        save: sinon.stub().resolvesThis()
      };

      sandbox.stub(User, 'findOne').resolves(mockUser);
      sandbox.stub(bcrypt, 'compare').resolves(false);

      await authController.login(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.an('error');
      expect(next.firstCall.args[0].message).to.equal('Account locked due to too many failed login attempts');
    });
  });

  describe('logout', function() {
    it('should logout user successfully', async function() {
      req.user = { _id: 'user123' };

      await authController.logout(req, res, next);

      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('message', 'Logout successful');
      expect(res.clearCookie.calledWith('token')).to.be.true;
    });
  });

  describe('getProfile', function() {
    it('should return user profile', async function() {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'operator',
        isActive: true
      };

      req.user = mockUser;

      await authController.getProfile(req, res, next);

      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('user');
      expect(res.json.firstCall.args[0].user).to.have.property('email', mockUser.email);
    });
  });

  describe('updateProfile', function() {
    it('should update user profile', async function() {
      const updateData = {
        firstName: 'Jane',
        lastName: 'Smith'
      };

      req.body = updateData;
      req.user = {
        _id: 'user123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        save: sinon.stub().resolvesThis()
      };

      await authController.updateProfile(req, res, next);

      expect(req.user.firstName).to.equal(updateData.firstName);
      expect(req.user.lastName).to.equal(updateData.lastName);
      expect(req.user.save.calledOnce).to.be.true;
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('message', 'Profile updated successfully');
    });
  });

  describe('changePassword', function() {
    it('should change password successfully', async function() {
      const passwordData = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123'
      };

      req.body = passwordData;
      req.user = {
        _id: 'user123',
        password: 'hashedOldPassword',
        save: sinon.stub().resolvesThis()
      };

      sandbox.stub(bcrypt, 'compare').resolves(true);
      sandbox.stub(bcrypt, 'hash').resolves('hashedNewPassword');

      await authController.changePassword(req, res, next);

      expect(bcrypt.hash.calledWith(passwordData.newPassword)).to.be.true;
      expect(req.user.password).to.equal('hashedNewPassword');
      expect(req.user.save.calledOnce).to.be.true;
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('message', 'Password changed successfully');
    });

    it('should reject weak passwords', async function() {
      req.body = {
        currentPassword: 'oldpassword',
        newPassword: '123'
      };
      req.user = { _id: 'user123' };

      await authController.changePassword(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.an('error');
      expect(next.firstCall.args[0].message).to.contain('Password does not meet requirements');
    });
  });

  describe('requestPasswordReset', function() {
    it('should initiate password reset for valid user', async function() {
      const resetData = { email: 'test@example.com' };
      req.body = resetData;

      const mockUser = {
        _id: 'user123',
        email: resetData.email,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        save: sinon.stub().resolvesThis()
      };

      sandbox.stub(User, 'findOne').resolves(mockUser);
      sandbox.stub(require('../../src/services/notificationService'), 'sendPasswordResetEmail').resolves();

      await authController.requestPasswordReset(req, res, next);

      expect(mockUser.resetPasswordToken).to.not.be.null;
      expect(mockUser.resetPasswordExpires).to.not.be.null;
      expect(mockUser.save.calledOnce).to.be.true;
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('message', 'Password reset email sent');
    });

    it('should handle non-existent email gracefully', async function() {
      req.body = { email: 'nonexistent@example.com' };

      sandbox.stub(User, 'findOne').resolves(null);

      await authController.requestPasswordReset(req, res, next);

      // Should still return success to prevent email enumeration
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('message', 'Password reset email sent');
    });
  });

  describe('resetPassword', function() {
    it('should reset password with valid token', async function() {
      const resetData = {
        token: 'valid-reset-token',
        newPassword: 'newpassword123'
      };

      req.body = resetData;

      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        resetPasswordToken: 'hashedToken',
        resetPasswordExpires: new Date(Date.now() + 3600000), // Valid for another hour
        save: sinon.stub().resolvesThis()
      };

      sandbox.stub(User, 'findOne').resolves(mockUser);
      sandbox.stub(bcrypt, 'compare').resolves(true); // Token matches
      sandbox.stub(bcrypt, 'hash').resolves('hashedNewPassword');

      await authController.resetPassword(req, res, next);

      expect(mockUser.password).to.equal('hashedNewPassword');
      expect(mockUser.resetPasswordToken).to.be.null;
      expect(mockUser.resetPasswordExpires).to.be.null;
      expect(mockUser.save.calledOnce).to.be.true;
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('message', 'Password reset successfully');
    });

    it('should reject expired reset token', async function() {
      const resetData = {
        token: 'expired-token',
        newPassword: 'newpassword123'
      };

      req.body = resetData;

      const mockUser = {
        _id: 'user123',
        resetPasswordToken: 'hashedToken',
        resetPasswordExpires: new Date(Date.now() - 3600000) // Expired 1 hour ago
      };

      sandbox.stub(User, 'findOne').resolves(mockUser);

      await authController.resetPassword(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.an('error');
      expect(next.firstCall.args[0].message).to.equal('Password reset token is invalid or has expired');
    });
  });

  describe('verifyEmail', function() {
    it('should verify email with valid token', async function() {
      const verificationData = { token: 'valid-verification-token' };
      req.body = verificationData;

      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        emailVerificationToken: 'hashedToken',
        isEmailVerified: false,
        save: sinon.stub().resolvesThis()
      };

      sandbox.stub(User, 'findOne').resolves(mockUser);
      sandbox.stub(bcrypt, 'compare').resolves(true);

      await authController.verifyEmail(req, res, next);

      expect(mockUser.isEmailVerified).to.be.true;
      expect(mockUser.emailVerificationToken).to.be.null;
      expect(mockUser.save.calledOnce).to.be.true;
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('message', 'Email verified successfully');
    });
  });

  describe('enable2FA', function() {
    it('should enable 2FA for user', async function() {
      req.user = {
        _id: 'user123',
        twoFactorEnabled: false,
        twoFactorSecret: null,
        save: sinon.stub().resolvesThis()
      };

      // Mock speakeasy for TOTP
      const mockSpeakeasy = {
        generateSecret: sinon.stub().returns({ base32: 'JBSWY3DPEHPK3PXP' }),
        otpauthURL: sinon.stub().returns('otpauth://totp/Test:user@example.com?secret=JBSWY3DPEHPK3PXP')
      };

      // Replace the actual module
      const speakeasy = require.cache[require.resolve('speakeasy')];
      require.cache[require.resolve('speakeasy')] = {
        exports: mockSpeakeasy
      };

      await authController.enable2FA(req, res, next);

      // Restore original module
      if (speakeasy) require.cache[require.resolve('speakeasy')] = speakeasy;

      expect(req.user.twoFactorSecret).to.equal('JBSWY3DPEHPK3PXP');
      expect(req.user.twoFactorEnabled).to.be.false; // Still false until verified
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('secret');
      expect(res.json.firstCall.args[0]).to.have.property('otpauth_url');
    });
  });

  describe('verify2FA', function() {
    it('should verify and enable 2FA', async function() {
      const verificationData = { token: '123456' };
      req.body = verificationData;

      req.user = {
        _id: 'user123',
        twoFactorEnabled: false,
        twoFactorSecret: 'JBSWY3DPEHPK3PXP',
        save: sinon.stub().resolvesThis()
      };

      // Mock speakeasy verification
      const mockSpeakeasy = {
        totp: {
          verify: sinon.stub().returns(true)
        }
      };

      const speakeasy = require.cache[require.resolve('speakeasy')];
      require.cache[require.resolve('speakeasy')] = {
        exports: mockSpeakeasy
      };

      await authController.verify2FA(req, res, next);

      if (speakeasy) require.cache[require.resolve('speakeasy')] = speakeasy;

      expect(req.user.twoFactorEnabled).to.be.true;
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('message', '2FA enabled successfully');
    });

    it('should reject invalid 2FA token', async function() {
      const verificationData = { token: 'invalid' };
      req.body = verificationData;

      req.user = {
        _id: 'user123',
        twoFactorEnabled: false,
        twoFactorSecret: 'JBSWY3DPEHPK3PXP'
      };

      const mockSpeakeasy = {
        totp: {
          verify: sinon.stub().returns(false)
        }
      };

      const speakeasy = require.cache[require.resolve('speakeasy')];
      require.cache[require.resolve('speakeasy')] = {
        exports: mockSpeakeasy
      };

      await authController.verify2FA(req, res, next);

      if (speakeasy) require.cache[require.resolve('speakeasy')] = speakeasy;

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.an('error');
      expect(next.firstCall.args[0].message).to.equal('Invalid 2FA token');
    });
  });
});
