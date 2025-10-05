import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true,
    maxlength: [50, 'Name can not be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 8,
    select: false // Don't include password in queries by default
  },
  role: {
    type: String,
    enum: ['user', 'operator', 'admin', 'service'],
    default: 'user'
  },
  organization: {
    type: String,
    trim: true,
    maxlength: [100, 'Organization name can not be more than 100 characters']
  },
  phone: {
    type: String,
    match: [/^\+?[1-9]\d{1,14}$/, 'Please add a valid phone number']
  },
  avatar: {
    type: String,
    default: null
  },

  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  emailVerifiedAt: {
    type: Date,
    default: null
  },

  // Security
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false
  },
  failedLoginAttempts: {
    type: Number,
    default: 0,
    select: false
  },
  lockUntil: {
    type: Date,
    default: null,
    select: false
  },
  lastFailedLogin: {
    type: Date,
    default: null,
    select: false
  },

  // Activity tracking
  lastLogin: {
    type: Date,
    default: null
  },
  lastActivity: {
    type: Date,
    default: null
  },
  loginCount: {
    type: Number,
    default: 0
  },
  apiCalls: {
    type: Number,
    default: 0
  },

  // Password reset
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },

  // Email verification
  emailVerificationToken: {
    type: String,
    select: false
  },
  emailVerificationExpires: {
    type: Date,
    select: false
  },

  // User preferences
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true }
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    },
    language: {
      type: String,
      default: 'en'
    },
    timezone: {
      type: String,
      default: 'UTC'
    }
  },

  // Business information
  businessInfo: {
    industry: String,
    companySize: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-1000', '1000+']
    },
    carbonGoals: {
      annualTarget: Number, // tons CO2
      deadline: Date,
      currentProgress: { type: Number, default: 0 } // percentage
    }
  },

  // Carbon credit portfolio
  carbonCredits: {
    totalCredits: { type: Number, default: 0 },
    availableCredits: { type: Number, default: 0 },
    retiredCredits: { type: Number, default: 0 },
    transactions: [{
      type: { type: String, enum: ['purchase', 'sale', 'retirement', 'transfer'] },
      amount: Number,
      price: Number, // USD per credit
      counterparty: String,
      transactionId: String,
      timestamp: { type: Date, default: Date.now },
      blockchainTx: String
    }]
  },

  // Associated units
  units: [{
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'CarbonCaptureUnit' },
    role: { type: String, enum: ['owner', 'operator', 'viewer'], default: 'owner' },
    permissions: [{
      type: String,
      enum: ['read', 'write', 'admin', 'optimize']
    }],
    addedAt: { type: Date, default: Date.now }
  }],

  // API keys for service access
  apiKeys: [{
    name: String,
    key: { type: String, unique: true, sparse: true },
    permissions: [String],
    lastUsed: Date,
    expiresAt: Date,
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
  }],

  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ organization: 1 });
userSchema.index({ 'carbonCredits.totalCredits': -1 });
userSchema.index({ lastActivity: -1 });
userSchema.index({ createdAt: -1 });

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return this.name;
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only run if password is modified
  if (!this.isModified('password')) {
    next();
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Instance methods
userSchema.methods = {
  // Check password
  matchPassword: async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
  },

  // Generate JWT token
  getSignedJwtToken: function() {
    return jwt.sign(
      { userId: this._id },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: process.env.JWT_EXPIRE || '30d' }
    );
  },

  // Generate password reset token
  getResetPasswordToken: function() {
    const resetToken = crypto.randomBytes(20).toString('hex');

    this.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    return resetToken;
  },

  // Generate email verification token
  getEmailVerificationToken: function() {
    const verificationToken = crypto.randomBytes(20).toString('hex');

    this.emailVerificationToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    return verificationToken;
  },

  // Check if password reset token is valid
  checkResetPasswordToken: function(token) {
    if (!this.passwordResetToken || !this.passwordResetExpires) {
      return false;
    }

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    return hashedToken === this.passwordResetToken &&
           this.passwordResetExpires > Date.now();
  },

  // Add unit to user
  addUnit: function(unitId, role = 'owner', permissions = ['read', 'write']) {
    if (!this.units.some(u => u.unitId.toString() === unitId.toString())) {
      this.units.push({
        unitId,
        role,
        permissions,
        addedAt: new Date()
      });
    }
    return this.save();
  },

  // Remove unit from user
  removeUnit: function(unitId) {
    this.units = this.units.filter(u => u.unitId.toString() !== unitId.toString());
    return this.save();
  },

  // Check if user has permission for unit
  hasUnitPermission: function(unitId, permission) {
    const unit = this.units.find(u => u.unitId.toString() === unitId.toString());
    return unit && unit.permissions.includes(permission);
  },

  // Generate API key
  generateApiKey: function(name, permissions = ['read'], expiresIn = 365 * 24 * 60 * 60 * 1000) {
    const apiKey = crypto.randomBytes(32).toString('hex');

    this.apiKeys.push({
      name,
      key: crypto.createHash('sha256').update(apiKey).digest('hex'),
      permissions,
      expiresAt: new Date(Date.now() + expiresIn),
      isActive: true,
      createdAt: new Date()
    });

    this.save();
    return apiKey;
  },

  // Validate API key
  validateApiKey: function(apiKey) {
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
    const keyRecord = this.apiKeys.find(k =>
      k.key === hashedKey &&
      k.isActive &&
      (!k.expiresAt || k.expiresAt > new Date())
    );

    if (keyRecord) {
      keyRecord.lastUsed = new Date();
      this.save();
      return keyRecord.permissions;
    }

    return null;
  },

  // Get user statistics
  getStats: function() {
    return {
      totalUnits: this.units.length,
      activeUnits: this.units.filter(u => u.role !== 'viewer').length,
      totalCarbonCredits: this.carbonCredits.totalCredits,
      availableCredits: this.carbonCredits.availableCredits,
      retiredCredits: this.carbonCredits.retiredCredits,
      recentTransactions: this.carbonCredits.transactions.slice(-5),
      accountAge: Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24)), // days
      loginCount: this.loginCount,
      apiCalls: this.apiCalls
    };
  },

  // Update carbon credit balance
  updateCarbonCredits: function(amount, type, price = null, counterparty = null, blockchainTx = null) {
    const transaction = {
      type,
      amount: Math.abs(amount),
      price,
      counterparty,
      timestamp: new Date(),
      blockchainTx
    };

    if (type === 'purchase' || type === 'transfer') {
      this.carbonCredits.totalCredits += amount;
      this.carbonCredits.availableCredits += amount;
    } else if (type === 'sale') {
      this.carbonCredits.availableCredits -= amount;
    } else if (type === 'retirement') {
      this.carbonCredits.availableCredits -= amount;
      this.carbonCredits.retiredCredits += amount;
    }

    this.carbonCredits.transactions.push(transaction);
    return this.save();
  },

  // Lock account
  lockAccount: function(duration = 2 * 60 * 60 * 1000) { // 2 hours default
    this.lockUntil = Date.now() + duration;
    this.failedLoginAttempts = 0;
    return this.save();
  },

  // Unlock account
  unlockAccount: function() {
    this.lockUntil = null;
    this.failedLoginAttempts = 0;
    return this.save();
  },

  // Increment failed login attempts
  incrementFailedLoginAttempts: function() {
    this.failedLoginAttempts += 1;
    this.lastFailedLogin = new Date();

    // Auto-lock after 5 failed attempts
    if (this.failedLoginAttempts >= 5) {
      this.lockAccount();
    }

    return this.save();
  },

  // Reset failed login attempts
  resetFailedLoginAttempts: function() {
    this.failedLoginAttempts = 0;
    this.lockUntil = null;
    this.lastFailedLogin = null;
    return this.save();
  }
};

// Static methods
userSchema.statics = {
  // Find user by email
  findByEmail: function(email) {
    return this.findOne({ email: email.toLowerCase() });
  },

  // Find users by role
  findByRole: function(role) {
    return this.find({ role, isActive: true });
  },

  // Find users by organization
  findByOrganization: function(organization) {
    return this.find({
      organization: new RegExp(organization, 'i'),
      isActive: true
    });
  },

  // Get user statistics
  getUserStats: async function() {
    const stats = await this.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
          verifiedUsers: { $sum: { $cond: ['$isVerified', 1, 0] } },
          totalCarbonCredits: { $sum: '$carbonCredits.totalCredits' },
          totalUnits: { $sum: { $size: '$units' } }
        }
      }
    ]);

    return stats[0] || {
      totalUsers: 0,
      activeUsers: 0,
      verifiedUsers: 0,
      totalCarbonCredits: 0,
      totalUnits: 0
    };
  }
};

// Middleware to update updatedAt
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('User', userSchema);