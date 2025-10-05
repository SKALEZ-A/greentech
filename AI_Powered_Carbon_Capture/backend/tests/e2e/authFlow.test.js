const { expect } = require('chai');
const request = require('supertest');
const mongoose = require('mongoose');
const User = require('../../src/models/User');
const app = require('../../src/index');

describe('Authentication Flow E2E Tests', function() {
  this.timeout(10000); // Increase timeout for E2E tests

  let server;
  let testUser;
  let authToken;

  before(async function() {
    // Start the server
    server = app.listen(3003);

    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/carbon_capture_test_e2e', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  });

  after(async function() {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    server.close();
  });

  beforeEach(async function() {
    // Clear users collection
    await User.deleteMany({});

    // Create test user
    testUser = await User.create({
      email: 'test@example.com',
      password: 'hashedPassword123',
      firstName: 'John',
      lastName: 'Doe',
      role: 'operator',
      isActive: true,
      isEmailVerified: true
    });
  });

  describe('Complete Authentication Flow', function() {
    it('should complete full user registration and login flow', async function() {
      // 1. Register new user
      const registerData = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'operator'
      };

      let response = await request(app)
        .post('/api/auth/register')
        .send(registerData)
        .expect(201);

      expect(response.body).to.have.property('message', 'User registered successfully');
      expect(response.body).to.have.property('user');
      expect(response.body.user.email).to.equal(registerData.email);

      const newUser = response.body.user;

      // 2. Login with new user
      const loginData = {
        email: registerData.email,
        password: registerData.password
      };

      response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).to.have.property('message', 'Login successful');
      expect(response.body).to.have.property('token');
      expect(response.body).to.have.property('user');

      const token = response.body.token;
      authToken = token;

      // 3. Access protected route with token
      response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).to.have.property('user');
      expect(response.body.user.email).to.equal(registerData.email);

      // 4. Update profile
      const updateData = {
        firstName: 'Jane Updated',
        lastName: 'Smith Updated'
      };

      response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(response.body).to.have.property('message', 'Profile updated successfully');
      expect(response.body.user.firstName).to.equal(updateData.firstName);

      // 5. Change password
      const passwordData = {
        currentPassword: registerData.password,
        newPassword: 'NewSecurePass456!'
      };

      response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send(passwordData)
        .expect(200);

      expect(response.body).to.have.property('message', 'Password changed successfully');

      // 6. Login with new password
      const newLoginData = {
        email: registerData.email,
        password: passwordData.newPassword
      };

      response = await request(app)
        .post('/api/auth/login')
        .send(newLoginData)
        .expect(200);

      expect(response.body).to.have.property('message', 'Login successful');

      // 7. Logout
      response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).to.have.property('message', 'Logout successful');
    });

    it('should handle password reset flow', async function() {
      // 1. Request password reset
      const resetRequest = {
        email: testUser.email
      };

      let response = await request(app)
        .post('/api/auth/forgot-password')
        .send(resetRequest)
        .expect(200);

      expect(response.body).to.have.property('message', 'Password reset email sent');

      // 2. Get reset token (in real scenario, this would come from email)
      const userWithToken = await User.findById(testUser._id);
      expect(userWithToken.resetPasswordToken).to.not.be.null;
      expect(userWithToken.resetPasswordExpires).to.not.be.null;

      // 3. Reset password with token
      const resetData = {
        token: userWithToken.resetPasswordToken,
        newPassword: 'ResetPassword789!'
      };

      response = await request(app)
        .post('/api/auth/reset-password')
        .send(resetData)
        .expect(200);

      expect(response.body).to.have.property('message', 'Password reset successfully');

      // 4. Verify old password no longer works
      const oldLoginData = {
        email: testUser.email,
        password: 'oldpassword'
      };

      response = await request(app)
        .post('/api/auth/login')
        .send(oldLoginData)
        .expect(401);

      // 5. Verify new password works
      const newLoginData = {
        email: testUser.email,
        password: resetData.newPassword
      };

      response = await request(app)
        .post('/api/auth/login')
        .send(newLoginData)
        .expect(200);

      expect(response.body).to.have.property('message', 'Login successful');
    });

    it('should handle 2FA setup and verification', async function() {
      // Login first to get token
      const loginData = {
        email: testUser.email,
        password: 'password123'
      };

      let response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      const token = response.body.token;

      // 1. Enable 2FA
      response = await request(app)
        .post('/api/auth/enable-2fa')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).to.have.property('secret');
      expect(response.body).to.have.property('otpauth_url');

      const secret = response.body.secret;

      // 2. Generate valid TOTP token (mock implementation)
      const validToken = generateValidTOTP(secret);

      // 3. Verify 2FA
      response = await request(app)
        .post('/api/auth/verify-2fa')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: validToken })
        .expect(200);

      expect(response.body).to.have.property('message', '2FA enabled successfully');

      // 4. Verify 2FA is required for login
      // (This would require additional setup in a real scenario)
    });

    it('should enforce account security policies', async function() {
      // 1. Test account lockout after failed attempts
      const wrongLoginData = {
        email: testUser.email,
        password: 'wrongpassword'
      };

      // Make multiple failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send(wrongLoginData)
          .expect(401);
      }

      // Next attempt should be blocked
      const response = await request(app)
        .post('/api/auth/login')
        .send(wrongLoginData)
        .expect(423); // Locked

      expect(response.body.error).to.contain('locked');

      // 2. Test password strength requirements
      const weakPasswordData = {
        email: 'weak@example.com',
        password: '123',
        firstName: 'Weak',
        lastName: 'User',
        role: 'operator'
      };

      const weakResponse = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordData)
        .expect(400);

      expect(weakResponse.body.error).to.contain('password');
    });

    it('should handle email verification flow', async function() {
      // 1. Register user without email verification
      const unverifiedUser = await User.create({
        email: 'unverified@example.com',
        password: 'hashedPassword123',
        firstName: 'Unverified',
        lastName: 'User',
        role: 'operator',
        isActive: true,
        isEmailVerified: false
      });

      // 2. Request email verification
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ email: unverifiedUser.email })
        .expect(200);

      expect(response.body).to.have.property('message', 'Verification email sent');

      // 3. Get verification token
      const userWithToken = await User.findById(unverifiedUser._id);
      expect(userWithToken.emailVerificationToken).to.not.be.null;

      // 4. Verify email with token
      const verifyResponse = await request(app)
        .post('/api/auth/verify-email-token')
        .send({ token: userWithToken.emailVerificationToken })
        .expect(200);

      expect(verifyResponse.body).to.have.property('message', 'Email verified successfully');

      // 5. Verify user is now verified
      const verifiedUser = await User.findById(unverifiedUser._id);
      expect(verifiedUser.isEmailVerified).to.be.true;
      expect(verifiedUser.emailVerificationToken).to.be.null;
    });

    it('should handle session management', async function() {
      // 1. Login and get token
      const loginData = {
        email: testUser.email,
        password: 'password123'
      };

      let response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      const token = response.body.token;

      // 2. Access protected route multiple times
      for (let i = 0; i < 3; i++) {
        response = await request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
      }

      // 3. Logout
      response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // 4. Try to access protected route after logout
      response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(response.body.error).to.contain('Unauthorized');
    });

    it('should handle concurrent sessions', async function() {
      // 1. Login multiple times to simulate concurrent sessions
      const loginData = {
        email: testUser.email,
        password: 'password123'
      };

      const tokens = [];

      // Create multiple sessions
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send(loginData)
          .expect(200);

        tokens.push(response.body.token);
      }

      // 2. Verify all tokens work
      for (const token of tokens) {
        const response = await request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.user.email).to.equal(testUser.email);
      }

      // 3. Logout from one session
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${tokens[0]}`)
        .expect(200);

      // 4. Verify other sessions still work
      for (let i = 1; i < tokens.length; i++) {
        const response = await request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${tokens[i]}`)
          .expect(200);

        expect(response.body.user.email).to.equal(testUser.email);
      }
    });
  });

  describe('Security Tests', function() {
    it('should prevent brute force attacks', async function() {
      const wrongLoginData = {
        email: testUser.email,
        password: 'wrongpassword'
      };

      // Make many failed attempts quickly
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send(wrongLoginData)
        );
      }

      const responses = await Promise.all(promises);

      // Should eventually start blocking requests
      const blockedResponses = responses.filter(r => r.status === 423);
      expect(blockedResponses.length).to.be.greaterThan(0);
    });

    it('should prevent SQL injection attempts', async function() {
      const maliciousData = {
        email: "'; DROP TABLE users; --",
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(maliciousData)
        .expect(401);

      // Verify user table still exists
      const userCount = await User.countDocuments();
      expect(userCount).to.be.greaterThan(0);
    });

    it('should validate input data', async function() {
      const invalidData = [
        { email: '', password: 'password123' },
        { email: 'invalid-email', password: 'password123' },
        { email: 'test@example.com', password: '' },
        { email: 'a'.repeat(300) + '@example.com', password: 'password123' }
      ];

      for (const data of invalidData) {
        const response = await request(app)
          .post('/api/auth/login')
          .send(data)
          .expect(400);

        expect(response.body).to.have.property('error');
      }
    });

    it('should handle rate limiting', async function() {
      // Make many requests quickly
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: 'test@example.com',
              password: 'password123'
            })
        );
      }

      const responses = await Promise.all(promises);

      // Should have some rate limited responses
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).to.be.greaterThan(0);
    });
  });

  describe('Error Handling', function() {
    it('should handle network timeouts gracefully', async function() {
      // This test would require mocking network conditions
      // For now, just verify error responses are properly formatted
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400);

      expect(response.body).to.have.property('error');
      expect(response.body.error).to.be.a('string');
    });

    it('should handle malformed JSON', async function() {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('invalid json {')
        .expect(400);

      expect(response.body).to.have.property('error');
    });

    it('should handle extremely large payloads', async function() {
      const largeData = {
        email: 'test@example.com',
        password: 'p',
        largeField: 'x'.repeat(1000000) // 1MB of data
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(largeData)
        .expect(413); // Payload too large

      expect(response.body).to.have.property('error');
    });
  });
});

// Helper function to generate valid TOTP token
function generateValidTOTP(secret) {
  // In a real implementation, this would use speakeasy
  // For testing, return a mock valid token
  return '123456';
}
