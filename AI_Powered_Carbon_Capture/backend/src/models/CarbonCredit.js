import mongoose from 'mongoose';

const carbonCreditSchema = new mongoose.Schema({
  // Credit identification
  creditId: {
    type: String,
    required: [true, 'Please add credit ID'],
    unique: true,
    trim: true,
    maxlength: [50, 'Credit ID can not be more than 50 characters']
  },

  // Associated unit
  unitId: {
    type: String,
    required: [true, 'Please add unit ID'],
    ref: 'CarbonCaptureUnit'
  },

  // Credit details
  amount: {
    type: Number,
    required: [true, 'Please add credit amount'],
    min: [0, 'Credit amount must be positive']
  },

  // Credit type and methodology
  type: {
    type: String,
    required: [true, 'Please add credit type'],
    enum: [
      'removal', 'reduction', 'avoidance',
      'nature_based', 'technology_based', 'other'
    ],
    default: 'removal'
  },

  methodology: {
    type: String,
    required: [true, 'Please add methodology'],
    enum: [
      'direct_air_capture', 'carbon_capture_utilization_storage',
      'reforestation', 'avoided_deforestation', 'soil_carbon',
      'ocean_carbon', 'mineralization', 'biochar', 'other'
    ]
  },

  // Standard and protocol
  standard: {
    type: String,
    enum: [
      'verra_vcrs', 'gold_standard', 'american_carbon_registry',
      'climate_action_reserve', 'iso_14064', 'other'
    ],
    default: 'verra_vcrs'
  },

  protocol: {
    type: String,
    enum: [
      'ccus', 'arr', 'redd+', 'ifm', 'cookstove', 'other'
    ]
  },

  // Vintage and validity
  vintage: {
    type: Number,
    required: [true, 'Please add vintage year'],
    min: [2000, 'Vintage year must be 2000 or later'],
    max: [new Date().getFullYear() + 1, 'Vintage year cannot be in the future']
  },

  validFrom: {
    type: Date,
    required: [true, 'Please add valid from date']
  },

  validUntil: {
    type: Date,
    required: [true, 'Please add valid until date']
  },

  // Ownership and transfer
  currentOwner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please add current owner']
  },

  originalOwner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please add original owner']
  },

  // Transfer history
  transferHistory: [{
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Transfer amount must be positive']
    },
    price: {
      type: Number,
      min: [0, 'Price must be positive']
    },
    transactionType: {
      type: String,
      enum: ['sale', 'transfer', 'retirement', 'donation'],
      default: 'transfer'
    },
    transactionId: {
      type: String,
      required: true,
      unique: true
    },
    blockchainTx: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    notes: String
  }],

  // Retirement details
  retirement: {
    isRetired: {
      type: Boolean,
      default: false
    },
    retiredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    retirementReason: {
      type: String,
      enum: ['compliance', 'voluntary', 'offsetting', 'other']
    },
    retirementDate: Date,
    retirementCertificate: String,
    retirementNotes: String
  },

  // Verification and certification
  verification: {
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected', 'expired'],
      default: 'pending'
    },
    verifiedBy: String,
    verificationDate: Date,
    verificationBody: String,
    verificationReport: String,
    nextVerificationDue: Date,
    verificationHistory: [{
      status: {
        type: String,
        enum: ['pending', 'verified', 'rejected']
      },
      verifiedBy: String,
      verificationDate: { type: Date, default: Date.now },
      notes: String
    }]
  },

  // Project details
  project: {
    name: String,
    description: String,
    location: {
      country: String,
      region: String,
      coordinates: {
        latitude: Number,
        longitude: Number
      }
    },
    startDate: Date,
    endDate: Date,
    totalCapacity: Number, // total credits expected
    currentCapacity: Number, // credits issued so far
  },

  // Environmental impact
  environmental: {
    co2Captured: {
      type: Number,
      required: true,
      min: [0, 'CO2 captured must be positive']
    },
    co2Equivalent: Number, // for different greenhouse gases
    permanence: {
      type: Number,
      min: [0, 'Permanence must be positive'],
      max: [100, 'Permanence cannot exceed 100%']
    },
    leakage: {
      type: Number,
      min: [0, 'Leakage must be non-negative'],
      max: [100, 'Leakage cannot exceed 100%']
    },
    additionality: {
      type: Boolean,
      default: true
    }
  },

  // Market information
  market: {
    listed: {
      type: Boolean,
      default: false
    },
    marketplace: String,
    askingPrice: Number,
    reservePrice: Number,
    currency: {
      type: String,
      default: 'USD'
    },
    listedDate: Date,
    delistedDate: Date,
    bids: [{
      bidder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      amount: Number,
      price: Number,
      timestamp: { type: Date, default: Date.now },
      status: {
        type: String,
        enum: ['active', 'accepted', 'rejected', 'expired'],
        default: 'active'
      }
    }]
  },

  // Financial tracking
  financial: {
    issuanceCost: Number,
    transactionFees: Number,
    totalValue: Number,
    currency: {
      type: String,
      default: 'USD'
    },
    paymentHistory: [{
      amount: Number,
      currency: String,
      from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      transactionId: String,
      timestamp: { type: Date, default: Date.now },
      type: {
        type: String,
        enum: ['issuance', 'transfer', 'sale', 'fee']
      }
    }]
  },

  // Compliance and reporting
  compliance: {
    regulatoryBody: String,
    compliancePeriod: String,
    reportingRequirements: [String],
    lastReported: Date,
    nextReportDue: Date,
    complianceHistory: [{
      status: {
        type: String,
        enum: ['compliant', 'non_compliant', 'pending']
      },
      reportedBy: String,
      reportDate: { type: Date, default: Date.now },
      notes: String
    }]
  },

  // Blockchain integration
  blockchain: {
    tokenId: String,
    contractAddress: String,
    network: {
      type: String,
      enum: ['ethereum', 'polygon', 'bsc', 'solana', 'other']
    },
    tokenStandard: {
      type: String,
      enum: ['erc721', 'erc1155', 'spl', 'other']
    },
    metadataURI: String,
    transactionHistory: [{
      txHash: String,
      event: String,
      from: String,
      to: String,
      amount: Number,
      timestamp: { type: Date, default: Date.now },
      blockNumber: Number
    }]
  },

  // Metadata
  tags: [String],
  customFields: mongoose.Schema.Types.Mixed,
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
carbonCreditSchema.index({ creditId: 1 });
carbonCreditSchema.index({ unitId: 1 });
carbonCreditSchema.index({ currentOwner: 1 });
carbonCreditSchema.index({ originalOwner: 1 });
carbonCreditSchema.index({ type: 1 });
carbonCreditSchema.index({ methodology: 1 });
carbonCreditSchema.index({ vintage: -1 });
carbonCreditSchema.index({ 'verification.status': 1 });
carbonCreditSchema.index({ 'retirement.isRetired': 1 });
carbonCreditSchema.index({ 'market.listed': 1 });
carbonCreditSchema.index({ 'blockchain.tokenId': 1 });
carbonCreditSchema.index({ createdAt: -1 });

// Virtuals
carbonCreditSchema.virtual('isExpired').get(function() {
  return this.validUntil < new Date();
});

carbonCreditSchema.virtual('isActive').get(function() {
  return !this.retirement.isRetired && !this.isExpired && this.verification.status === 'verified';
});

carbonCreditSchema.virtual('availableAmount').get(function() {
  const transferred = this.transferHistory.reduce((sum, transfer) => sum + transfer.amount, 0);
  return Math.max(0, this.amount - transferred);
});

carbonCreditSchema.virtual('age').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

carbonCreditSchema.virtual('daysToExpiry').get(function() {
  if (this.isExpired) return 0;
  return Math.floor((this.validUntil - new Date()) / (1000 * 60 * 60 * 24));
});

// Instance methods
carbonCreditSchema.methods = {
  // Transfer credits
  transfer: function(toUserId, amount, price = null, transactionType = 'transfer') {
    if (amount > this.availableAmount) {
      throw new Error('Insufficient credit amount available for transfer');
    }

    const transfer = {
      from: this.currentOwner,
      to: toUserId,
      amount,
      price,
      transactionType,
      transactionId: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    this.transferHistory.push(transfer);
    this.currentOwner = toUserId;

    return this.save();
  },

  // Retire credits
  retire: function(retiredBy, reason = 'voluntary', notes = null) {
    if (this.retirement.isRetired) {
      throw new Error('Credit is already retired');
    }

    this.retirement = {
      isRetired: true,
      retiredBy,
      retirementReason: reason,
      retirementDate: new Date(),
      retirementNotes: notes
    };

    return this.save();
  },

  // Verify credit
  verify: function(verifiedBy, verificationBody = null, report = null) {
    this.verification.status = 'verified';
    this.verification.verifiedBy = verifiedBy;
    this.verification.verificationDate = new Date();
    this.verification.verificationBody = verificationBody;
    this.verification.verificationReport = report;

    this.verification.verificationHistory.push({
      status: 'verified',
      verifiedBy,
      verificationDate: new Date()
    });

    return this.save();
  },

  // List on marketplace
  listOnMarketplace: function(marketplace, askingPrice, reservePrice = null) {
    this.market.listed = true;
    this.market.marketplace = marketplace;
    this.market.askingPrice = askingPrice;
    this.market.reservePrice = reservePrice;
    this.market.listedDate = new Date();

    return this.save();
  },

  // Delist from marketplace
  delistFromMarketplace: function() {
    this.market.listed = false;
    this.market.delistedDate = new Date();

    return this.save();
  },

  // Add bid
  addBid: function(bidderId, amount, price) {
    if (!this.market.listed) {
      throw new Error('Credit is not listed on marketplace');
    }

    if (amount > this.availableAmount) {
      throw new Error('Bid amount exceeds available credits');
    }

    this.market.bids.push({
      bidder: bidderId,
      amount,
      price,
      timestamp: new Date(),
      status: 'active'
    });

    return this.save();
  },

  // Accept bid
  acceptBid: function(bidId, acceptedBy) {
    const bid = this.market.bids.id(bidId);
    if (!bid) {
      throw new Error('Bid not found');
    }

    if (bid.status !== 'active') {
      throw new Error('Bid is not active');
    }

    bid.status = 'accepted';

    // Transfer the credit
    return this.transfer(bid.bidder, bid.amount, bid.price, 'sale');
  },

  // Add blockchain transaction
  addBlockchainTransaction: function(txHash, event, from, to, amount, blockNumber = null) {
    this.blockchain.transactionHistory.push({
      txHash,
      event,
      from,
      to,
      amount,
      blockNumber,
      timestamp: new Date()
    });

    return this.save();
  },

  // Get credit details
  getDetails: function() {
    return {
      creditId: this.creditId,
      amount: this.amount,
      availableAmount: this.availableAmount,
      type: this.type,
      methodology: this.methodology,
      vintage: this.vintage,
      currentOwner: this.currentOwner,
      isActive: this.isActive,
      isRetired: this.retirement.isRetired,
      isExpired: this.isExpired,
      verificationStatus: this.verification.status,
      marketListed: this.market.listed,
      askingPrice: this.market.askingPrice,
      daysToExpiry: this.daysToExpiry
    };
  },

  // Calculate credit value
  calculateValue: function(marketPrice = null) {
    const price = marketPrice || this.market.askingPrice || 25; // Default $25 per credit
    return {
      totalValue: this.availableAmount * price,
      unitPrice: price,
      currency: this.market.currency || 'USD'
    };
  }
};

// Static methods
carbonCreditSchema.statics = {
  // Find credits by owner
  findByOwner: function(ownerId) {
    return this.find({ currentOwner: ownerId, 'retirement.isRetired': false });
  },

  // Find credits by unit
  findByUnit: function(unitId) {
    return this.find({ unitId, 'retirement.isRetired': false });
  },

  // Find verified credits
  findVerified: function() {
    return this.find({
      'verification.status': 'verified',
      'retirement.isRetired': false,
      validUntil: { $gt: new Date() }
    });
  },

  // Find credits on marketplace
  findListed: function() {
    return this.find({
      'market.listed': true,
      'retirement.isRetired': false,
      validUntil: { $gt: new Date() }
    });
  },

  // Get market statistics
  getMarketStats: async function() {
    const stats = await this.aggregate([
      {
        $match: {
          'market.listed': true,
          'retirement.isRetired': false,
          validUntil: { $gt: new Date() }
        }
      },
      {
        $group: {
          _id: null,
          totalCreditsListed: { $sum: '$amount' },
          avgPrice: { $avg: '$market.askingPrice' },
          minPrice: { $min: '$market.askingPrice' },
          maxPrice: { $max: '$market.askingPrice' },
          totalListings: { $sum: 1 }
        }
      }
    ]);

    return stats[0] || {
      totalCreditsListed: 0,
      avgPrice: 0,
      minPrice: 0,
      maxPrice: 0,
      totalListings: 0
    };
  },

  // Get credits by vintage
  getCreditsByVintage: function(vintage) {
    return this.find({
      vintage,
      'retirement.isRetired': false,
      'verification.status': 'verified'
    });
  },

  // Get expiring credits
  getExpiringCredits: function(daysAhead = 30) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysAhead);

    return this.find({
      validUntil: { $lte: expiryDate, $gt: new Date() },
      'retirement.isRetired': false
    });
  }
};

export default mongoose.model('CarbonCredit', carbonCreditSchema);