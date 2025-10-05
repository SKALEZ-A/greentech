import { asyncHandler } from '../middleware/errorHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import CarbonCredit from '../models/CarbonCredit.js';
import CarbonCaptureUnit from '../models/CarbonCaptureUnit.js';
import User from '../models/User.js';

// @desc    Get all carbon credits
// @route   GET /api/credits
// @access  Private
export const getCredits = asyncHandler(async (req, res, next) => {
  // Build query
  let query = {};

  // Filter by owner (users can only see their own credits unless admin)
  if (req.user.role !== 'admin') {
    query.currentOwner = req.user.id;
  }

  // Filter by unit
  if (req.query.unitId) {
    query.unitId = req.query.unitId;
  }

  // Filter by status
  if (req.query.status === 'active') {
    query['retirement.isRetired'] = false;
    query.validUntil = { $gt: new Date() };
    query['verification.status'] = 'verified';
  } else if (req.query.status === 'retired') {
    query['retirement.isRetired'] = true;
  } else if (req.query.status === 'expired') {
    query.validUntil = { $lte: new Date() };
  }

  // Filter by vintage
  if (req.query.vintage) {
    query.vintage = parseInt(req.query.vintage);
  }

  // Filter by methodology
  if (req.query.methodology) {
    query.methodology = req.query.methodology;
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;

  // Sorting
  let sortOptions = {};
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    sortOptions = sortBy;
  } else {
    sortOptions = '-createdAt';
  }

  const total = await CarbonCredit.countDocuments(query);
  const credits = await CarbonCredit.find(query)
    .populate('currentOwner', 'name email')
    .populate('originalOwner', 'name email')
    .sort(sortOptions)
    .skip(startIndex)
    .limit(limit);

  // Pagination result
  const pagination = {
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    totalCredits: total,
    hasNext: page * limit < total,
    hasPrev: page > 1
  };

  res.status(200).json({
    success: true,
    count: credits.length,
    pagination,
    data: credits
  });
});

// @desc    Get single carbon credit
// @route   GET /api/credits/:id
// @access  Private
export const getCredit = asyncHandler(async (req, res, next) => {
  const credit = await CarbonCredit.findOne({ creditId: req.params.id })
    .populate('currentOwner', 'name email organization')
    .populate('originalOwner', 'name email organization')
    .populate('transferHistory.from', 'name email')
    .populate('transferHistory.to', 'name email')
    .populate('market.bids.bidder', 'name email');

  if (!credit) {
    return next(new ApiError('Carbon credit not found', 404, 'CREDIT_NOT_FOUND'));
  }

  // Check permissions
  if (req.user.role !== 'admin' &&
      credit.currentOwner._id.toString() !== req.user.id &&
      credit.originalOwner._id.toString() !== req.user.id) {
    return next(new ApiError('Not authorized to access this credit', 403, 'NOT_AUTHORIZED'));
  }

  res.status(200).json({
    success: true,
    data: credit
  });
});

// @desc    Create new carbon credit
// @route   POST /api/credits
// @access  Private (Admin or Unit Owner)
export const createCredit = asyncHandler(async (req, res, next) => {
  const {
    unitId,
    amount,
    vintage,
    methodology,
    co2Captured,
    validFrom,
    validUntil
  } = req.body;

  // Validate required fields
  if (!unitId || !amount || !vintage || !methodology || !co2Captured) {
    return next(new ApiError('unitId, amount, vintage, methodology, and co2Captured are required', 400, 'VALIDATION_ERROR'));
  }

  // Check if unit exists and user has permission
  const unit = await CarbonCaptureUnit.findOne({ id: unitId });
  if (!unit) {
    return next(new ApiError('Unit not found', 404, 'UNIT_NOT_FOUND'));
  }

  if (req.user.role !== 'admin' && unit.owner.toString() !== req.user.id) {
    return next(new ApiError('Not authorized to create credits for this unit', 403, 'NOT_AUTHORIZED'));
  }

  // Validate CO2 captured amount
  if (co2Captured > unit.capacity.co2PerDay) {
    return next(new ApiError('CO2 captured cannot exceed unit capacity', 400, 'INVALID_AMOUNT'));
  }

  // Generate credit ID
  const count = await CarbonCredit.countDocuments();
  const creditId = `CC-${vintage}-${String(count + 1).padStart(6, '0')}`;

  // Set default validity period if not provided
  const validFromDate = validFrom ? new Date(validFrom) : new Date();
  const validUntilDate = validUntil ? new Date(validUntil) : new Date(validFromDate.getFullYear() + 1, validFromDate.getMonth(), validFromDate.getDate());

  const creditData = {
    creditId,
    unitId,
    amount,
    vintage,
    methodology,
    currentOwner: req.user.id,
    originalOwner: req.user.id,
    validFrom: validFromDate,
    validUntil: validUntilDate,
    environmental: {
      co2Captured,
      co2Equivalent: co2Captured, // Assuming 1:1 ratio initially
      permanence: 95, // Default high permanence
      additionality: true
    },
    createdBy: req.user.id
  };

  const credit = await CarbonCredit.create(creditData);

  // Update unit's carbon credits
  await CarbonCaptureUnit.findOneAndUpdate(
    { id: unitId },
    {
      $inc: {
        'carbonCredits.totalCredits': amount,
        'carbonCredits.availableCredits': amount,
        'environmental.co2Captured.total': co2Captured,
        'environmental.co2Captured.thisMonth': co2Captured,
        'environmental.co2Captured.thisYear': co2Captured
      },
      $set: {
        'carbonCredits.lastCreditGeneration': new Date()
      }
    }
  );

  // Update user's carbon credits
  await User.findByIdAndUpdate(req.user.id, {
    $inc: {
      'carbonCredits.totalCredits': amount,
      'carbonCredits.availableCredits': amount
    }
  });

  res.status(201).json({
    success: true,
    data: credit
  });
});

// @desc    Transfer carbon credit
// @route   POST /api/credits/:id/transfer
// @access  Private
export const transferCredit = asyncHandler(async (req, res, next) => {
  const { toUserId, amount, price, transactionType = 'transfer' } = req.body;

  const credit = await CarbonCredit.findOne({ creditId: req.params.id });

  if (!credit) {
    return next(new ApiError('Carbon credit not found', 404, 'CREDIT_NOT_FOUND'));
  }

  // Check ownership
  if (req.user.role !== 'admin' && credit.currentOwner.toString() !== req.user.id) {
    return next(new ApiError('Not authorized to transfer this credit', 403, 'NOT_AUTHORIZED'));
  }

  // Validate amount
  if (amount > credit.availableAmount) {
    return next(new ApiError('Transfer amount exceeds available credits', 400, 'INSUFFICIENT_AMOUNT'));
  }

  // Check recipient exists
  const recipient = await User.findById(toUserId);
  if (!recipient) {
    return next(new ApiError('Recipient not found', 404, 'USER_NOT_FOUND'));
  }

  // Perform transfer
  await credit.transfer(toUserId, amount, price, transactionType);

  // Update user carbon credit balances
  await User.findByIdAndUpdate(credit.currentOwner, {
    $inc: { 'carbonCredits.availableCredits': -amount }
  });

  await User.findByIdAndUpdate(toUserId, {
    $inc: {
      'carbonCredits.totalCredits': amount,
      'carbonCredits.availableCredits': amount
    }
  });

  res.status(200).json({
    success: true,
    message: 'Credit transferred successfully',
    data: {
      creditId: credit.creditId,
      transferred: amount,
      from: credit.currentOwner,
      to: toUserId,
      transactionId: credit.transferHistory.slice(-1)[0].transactionId
    }
  });
});

// @desc    Retire carbon credit
// @route   POST /api/credits/:id/retire
// @access  Private
export const retireCredit = asyncHandler(async (req, res, next) => {
  const { reason = 'voluntary', notes } = req.body;

  const credit = await CarbonCredit.findOne({ creditId: req.params.id });

  if (!credit) {
    return next(new ApiError('Carbon credit not found', 404, 'CREDIT_NOT_FOUND'));
  }

  // Check ownership
  if (req.user.role !== 'admin' && credit.currentOwner.toString() !== req.user.id) {
    return next(new ApiError('Not authorized to retire this credit', 403, 'NOT_AUTHORIZED'));
  }

  if (credit.retirement.isRetired) {
    return next(new ApiError('Credit is already retired', 400, 'ALREADY_RETIRED'));
  }

  await credit.retire(req.user.id, reason, notes);

  // Update user carbon credit balances
  await User.findByIdAndUpdate(credit.currentOwner, {
    $inc: {
      'carbonCredits.availableCredits': -credit.amount,
      'carbonCredits.retiredCredits': credit.amount
    }
  });

  res.status(200).json({
    success: true,
    message: 'Credit retired successfully',
    data: {
      creditId: credit.creditId,
      retiredAmount: credit.amount,
      retirementReason: reason,
      retirementDate: credit.retirement.retirementDate
    }
  });
});

// @desc    List credit on marketplace
// @route   POST /api/credits/:id/list
// @access  Private
export const listCredit = asyncHandler(async (req, res, next) => {
  const { askingPrice, reservePrice } = req.body;

  if (!askingPrice || askingPrice <= 0) {
    return next(new ApiError('Valid asking price is required', 400, 'VALIDATION_ERROR'));
  }

  const credit = await CarbonCredit.findOne({ creditId: req.params.id });

  if (!credit) {
    return next(new ApiError('Carbon credit not found', 404, 'CREDIT_NOT_FOUND'));
  }

  // Check ownership
  if (req.user.role !== 'admin' && credit.currentOwner.toString() !== req.user.id) {
    return next(new ApiError('Not authorized to list this credit', 403, 'NOT_AUTHORIZED'));
  }

  if (credit.market.listed) {
    return next(new ApiError('Credit is already listed on marketplace', 400, 'ALREADY_LISTED'));
  }

  await credit.listOnMarketplace('platform', askingPrice, reservePrice);

  res.status(200).json({
    success: true,
    message: 'Credit listed on marketplace successfully',
    data: {
      creditId: credit.creditId,
      askingPrice,
      reservePrice,
      listedDate: credit.market.listedDate
    }
  });
});

// @desc    Delist credit from marketplace
// @route   POST /api/credits/:id/delist
// @access  Private
export const delistCredit = asyncHandler(async (req, res, next) => {
  const credit = await CarbonCredit.findOne({ creditId: req.params.id });

  if (!credit) {
    return next(new ApiError('Carbon credit not found', 404, 'CREDIT_NOT_FOUND'));
  }

  // Check ownership
  if (req.user.role !== 'admin' && credit.currentOwner.toString() !== req.user.id) {
    return next(new ApiError('Not authorized to delist this credit', 403, 'NOT_AUTHORIZED'));
  }

  if (!credit.market.listed) {
    return next(new ApiError('Credit is not listed on marketplace', 400, 'NOT_LISTED'));
  }

  await credit.delistFromMarketplace();

  res.status(200).json({
    success: true,
    message: 'Credit delisted from marketplace successfully'
  });
});

// @desc    Place bid on credit
// @route   POST /api/credits/:id/bid
// @access  Private
export const placeBid = asyncHandler(async (req, res, next) => {
  const { amount, price } = req.body;

  if (!amount || !price || amount <= 0 || price <= 0) {
    return next(new ApiError('Valid amount and price are required', 400, 'VALIDATION_ERROR'));
  }

  const credit = await CarbonCredit.findOne({ creditId: req.params.id });

  if (!credit) {
    return next(new ApiError('Carbon credit not found', 404, 'CREDIT_NOT_FOUND'));
  }

  if (!credit.market.listed) {
    return next(new ApiError('Credit is not listed on marketplace', 400, 'NOT_LISTED'));
  }

  // Can't bid on your own credit
  if (credit.currentOwner.toString() === req.user.id) {
    return next(new ApiError('Cannot bid on your own credit', 400, 'SELF_BID'));
  }

  await credit.addBid(req.user.id, amount, price);

  res.status(200).json({
    success: true,
    message: 'Bid placed successfully'
  });
});

// @desc    Accept bid on credit
// @route   POST /api/credits/:id/bids/:bidId/accept
// @access  Private
export const acceptBid = asyncHandler(async (req, res, next) => {
  const credit = await CarbonCredit.findOne({ creditId: req.params.id });

  if (!credit) {
    return next(new ApiError('Carbon credit not found', 404, 'CREDIT_NOT_FOUND'));
  }

  // Check ownership
  if (req.user.role !== 'admin' && credit.currentOwner.toString() !== req.user.id) {
    return next(new ApiError('Not authorized to accept bids for this credit', 403, 'NOT_AUTHORIZED'));
  }

  if (!credit.market.listed) {
    return next(new ApiError('Credit is not listed on marketplace', 400, 'NOT_LISTED'));
  }

  await credit.acceptBid(req.params.bidId, req.user.id);

  // Update user carbon credit balances
  const bid = credit.market.bids.id(req.params.bidId);
  await User.findByIdAndUpdate(credit.currentOwner, {
    $inc: { 'carbonCredits.availableCredits': -bid.amount }
  });

  await User.findByIdAndUpdate(bid.bidder, {
    $inc: {
      'carbonCredits.totalCredits': bid.amount,
      'carbonCredits.availableCredits': bid.amount
    }
  });

  res.status(200).json({
    success: true,
    message: 'Bid accepted successfully',
    data: {
      creditId: credit.creditId,
      soldAmount: bid.amount,
      soldPrice: bid.price,
      buyer: bid.bidder
    }
  });
});

// @desc    Get marketplace listings
// @route   GET /api/credits/marketplace
// @access  Private
export const getMarketplace = asyncHandler(async (req, res, next) => {
  const credits = await CarbonCredit.findListed()
    .populate('currentOwner', 'name email organization')
    .sort('-market.listedDate');

  // Get market statistics
  const stats = await CarbonCredit.getMarketStats();

  res.status(200).json({
    success: true,
    count: credits.length,
    marketStats: stats,
    data: credits
  });
});

// @desc    Get credit statistics
// @route   GET /api/credits/stats
// @access  Private
export const getCreditStats = asyncHandler(async (req, res, next) => {
  let query = {};

  // Filter by accessible credits
  if (req.user.role !== 'admin') {
    query = {
      $or: [
        { currentOwner: req.user.id },
        { originalOwner: req.user.id }
      ]
    };
  }

  const credits = await CarbonCredit.find(query);

  const stats = {
    totalCredits: credits.reduce((sum, c) => sum + c.amount, 0),
    availableCredits: credits.reduce((sum, c) => sum + c.availableAmount, 0),
    retiredCredits: credits.filter(c => c.retirement.isRetired)
                          .reduce((sum, c) => sum + c.amount, 0),
    expiredCredits: credits.filter(c => c.isExpired)
                           .reduce((sum, c) => sum + c.amount, 0),
    listedCredits: credits.filter(c => c.market.listed)
                          .reduce((sum, c) => sum + c.availableAmount, 0),
    byVintage: {},
    byMethodology: {},
    totalValue: 0
  };

  // Group by vintage and methodology
  credits.forEach(credit => {
    // Vintage stats
    if (!stats.byVintage[credit.vintage]) {
      stats.byVintage[credit.vintage] = 0;
    }
    stats.byVintage[credit.vintage] += credit.amount;

    // Methodology stats
    if (!stats.byMethodology[credit.methodology]) {
      stats.byMethodology[credit.methodology] = 0;
    }
    stats.byMethodology[credit.methodology] += credit.amount;

    // Total value
    stats.totalValue += credit.calculateValue().totalValue;
  });

  res.status(200).json({
    success: true,
    data: stats
  });
});

// @desc    Verify carbon credit
// @route   POST /api/credits/:id/verify
// @access  Private (Admin only)
export const verifyCredit = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new ApiError('Not authorized to verify credits', 403, 'NOT_AUTHORIZED'));
  }

  const { verificationBody, report } = req.body;

  const credit = await CarbonCredit.findOne({ creditId: req.params.id });

  if (!credit) {
    return next(new ApiError('Carbon credit not found', 404, 'CREDIT_NOT_FOUND'));
  }

  if (credit.verification.status === 'verified') {
    return next(new ApiError('Credit is already verified', 400, 'ALREADY_VERIFIED'));
  }

  await credit.verify(req.user.id, verificationBody, report);

  res.status(200).json({
    success: true,
    message: 'Credit verified successfully'
  });
});

// @desc    Get credits by vintage
// @route   GET /api/credits/vintage/:year
// @access  Private
export const getCreditsByVintage = asyncHandler(async (req, res, next) => {
  const vintage = parseInt(req.params.year);

  if (!vintage || vintage < 2000 || vintage > new Date().getFullYear() + 1) {
    return next(new ApiError('Invalid vintage year', 400, 'INVALID_VINTAGE'));
  }

  const credits = await CarbonCredit.findCreditsByVintage(vintage)
    .populate('currentOwner', 'name email')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    vintage,
    count: credits.length,
    data: credits
  });
});

// @desc    Get expiring credits
// @route   GET /api/credits/expiring
// @access  Private
export const getExpiringCredits = asyncHandler(async (req, res, next) => {
  const daysAhead = parseInt(req.query.days, 10) || 30;

  let credits;
  if (req.user.role === 'admin') {
    credits = await CarbonCredit.getExpiringCredits(daysAhead);
  } else {
    // For regular users, only show their credits
    credits = await CarbonCredit.find({
      currentOwner: req.user.id,
      validUntil: { $lte: new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000), $gt: new Date() }
    });
  }

  credits = await CarbonCredit.populate(credits, { path: 'currentOwner', select: 'name email' });

  res.status(200).json({
    success: true,
    daysAhead,
    count: credits.length,
    data: credits
  });
});