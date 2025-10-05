import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';
import winston from 'winston';
import fs from 'fs';
import path from 'path';
import { ApiError } from '../middleware/errorHandler.js';
import CarbonCredit from '../models/CarbonCredit.js';
import User from '../models/User.js';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'carbon-credit-service' },
  transports: [
    new winston.transports.File({ filename: 'logs/carbon-credit-service.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

class CarbonCreditService {
  constructor() {
    this.web3 = null;
    this.contracts = {};
    this.account = null;
    this.isInitialized = false;

    // Contract ABIs (simplified for this implementation)
    this.contractABIs = {
      carbonCredit: JSON.parse(fs.readFileSync(path.join(process.cwd(), 'blockchain/build/contracts/CarbonCredit.json'), 'utf8')).abi,
      marketplace: JSON.parse(fs.readFileSync(path.join(process.cwd(), 'blockchain/build/contracts/CarbonCreditMarketplace.json'), 'utf8')).abi
    };

    this.contractAddresses = {
      carbonCredit: process.env.CARBON_CREDIT_CONTRACT_ADDRESS,
      marketplace: process.env.MARKETPLACE_CONTRACT_ADDRESS
    };
  }

  /**
   * Initialize blockchain connection and contracts
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      if (this.isInitialized) {
        return;
      }

      // Initialize Web3
      const providerUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://localhost:8545';
      this.web3 = new Web3(providerUrl);

      // Check connection
      const isConnected = await this.web3.eth.net.isListening();
      if (!isConnected) {
        throw new Error('Cannot connect to blockchain network');
      }

      // Initialize account
      const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
      if (privateKey) {
        this.account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
        this.web3.eth.accounts.wallet.add(this.account);
        this.web3.eth.defaultAccount = this.account.address;
      }

      // Initialize contracts
      this.contracts.carbonCredit = new this.web3.eth.Contract(
        this.contractABIs.carbonCredit,
        this.contractAddresses.carbonCredit
      );

      this.contracts.marketplace = new this.web3.eth.Contract(
        this.contractABIs.marketplace,
        this.contractAddresses.marketplace
      );

      this.isInitialized = true;

      logger.info('Carbon Credit Service initialized successfully', {
        network: await this.web3.eth.net.getId(),
        account: this.account?.address
      });

    } catch (error) {
      logger.error('Failed to initialize Carbon Credit Service:', error);
      throw new ApiError(
        'Blockchain service initialization failed',
        500,
        'BLOCKCHAIN_INIT_FAILED',
        { error: error.message }
      );
    }
  }

  /**
   * Mint new carbon credits on the blockchain
   * @param {Object} creditData - Credit information
   * @returns {Promise<Object>} Minting result
   */
  async mintCredit(creditData) {
    try {
      await this.initialize();

      const {
        serialNumber,
        amount,
        vintage,
        projectId,
        unitId,
        owner
      } = creditData;

      // Generate token ID (simplified - in production use proper hashing)
      const tokenId = this.web3.utils.keccak256(
        `${serialNumber}-${vintage}-${Date.now()}`
      );

      // Convert amount to blockchain units (assuming 18 decimals)
      const amountInWei = this.web3.utils.toWei(amount.toString(), 'ether');

      // Mint token
      const mintTx = await this.contracts.carbonCredit.methods
        .mintCredit(tokenId, amountInWei, vintage, projectId)
        .send({
          from: this.account.address,
          gas: 200000
        });

      // Create database record
      const credit = await CarbonCredit.create({
        tokenId,
        serialNumber,
        vintage,
        amount,
        unit: 'tCO2',
        projectId,
        projectName: creditData.projectName,
        unitId,
        owner,
        status: 'active',
        verification: {
          verifier: 'ai_system',
          verificationMethod: 'ai_prediction',
          verificationDate: new Date(),
          confidenceScore: 95,
          evidence: [`tx:${mintTx.transactionHash}`]
        },
        compliance: {
          registry: 'verra',
          standards: ['corsia', 'icca'],
          certifications: []
        },
        metadata: {
          captureStartDate: creditData.captureStartDate,
          captureEndDate: creditData.captureEndDate,
          methodologyDetails: 'Direct air capture with AI optimization',
          coBenefits: ['air_quality_improvement', 'job_creation']
        }
      });

      logger.info('Carbon credit minted successfully', {
        tokenId,
        serialNumber,
        amount,
        transactionHash: mintTx.transactionHash
      });

      return {
        success: true,
        credit,
        blockchain: {
          tokenId,
          transactionHash: mintTx.transactionHash,
          blockNumber: mintTx.blockNumber
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Credit minting failed:', error);
      throw new ApiError(
        'Carbon credit minting failed',
        500,
        'CREDIT_MINTING_FAILED',
        { error: error.message }
      );
    }
  }

  /**
   * Transfer carbon credits between users
   * @param {string} fromUserId - Sender user ID
   * @param {string} toUserId - Receiver user ID
   * @param {string} creditId - Credit ID
   * @param {number} amount - Amount to transfer
   * @returns {Promise<Object>} Transfer result
   */
  async transferCredit(fromUserId, toUserId, creditId, amount) {
    try {
      await this.initialize();

      // Get credit and users
      const credit = await CarbonCredit.findById(creditId);
      const fromUser = await User.findById(fromUserId);
      const toUser = await User.findById(toUserId);

      if (!credit || !fromUser || !toUser) {
        throw new Error('Credit or user not found');
      }

      if (credit.owner.toString() !== fromUserId) {
        throw new Error('Unauthorized: Credit does not belong to sender');
      }

      if (credit.amount < amount) {
        throw new Error('Insufficient credit balance');
      }

      // Transfer on blockchain
      const transferTx = await this.contracts.carbonCredit.methods
        .transferCredit(credit.tokenId, toUser.blockchainAddress || toUser._id.toString(), amount)
        .send({
          from: this.account.address,
          gas: 150000
        });

      // Update database
      if (credit.amount === amount) {
        // Full transfer
        credit.owner = toUser._id;
        credit.status = 'transferred';
      } else {
        // Partial transfer - create new credit for recipient
        await CarbonCredit.create({
          ...credit.toObject(),
          _id: undefined,
          owner: toUser._id,
          amount: amount,
          status: 'active',
          serialNumber: `${credit.serialNumber}-T${Date.now()}`,
          metadata: {
            ...credit.metadata,
            transferSource: credit._id,
            transferDate: new Date()
          }
        });

        // Reduce original credit amount
        credit.amount -= amount;
      }

      await credit.save();

      // Update user carbon credit totals
      await this._updateUserCreditTotals(fromUser._id);
      await this._updateUserCreditTotals(toUser._id);

      logger.info('Carbon credit transferred successfully', {
        fromUserId,
        toUserId,
        creditId,
        amount,
        transactionHash: transferTx.transactionHash
      });

      return {
        success: true,
        transfer: {
          from: fromUserId,
          to: toUserId,
          creditId,
          amount,
          transactionHash: transferTx.transactionHash
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Credit transfer failed:', error);
      throw new ApiError(
        'Carbon credit transfer failed',
        500,
        'CREDIT_TRANSFER_FAILED',
        { error: error.message }
      );
    }
  }

  /**
   * List carbon credits for sale in marketplace
   * @param {string} userId - User ID
   * @param {string} creditId - Credit ID
   * @param {number} amount - Amount to list
   * @param {number} price - Price per credit
   * @returns {Promise<Object>} Listing result
   */
  async listCreditForSale(userId, creditId, amount, price) {
    try {
      await this.initialize();

      const credit = await CarbonCredit.findById(creditId);
      const user = await User.findById(userId);

      if (!credit || !user) {
        throw new Error('Credit or user not found');
      }

      if (credit.owner.toString() !== userId) {
        throw new Error('Unauthorized: Credit does not belong to user');
      }

      if (credit.amount < amount) {
        throw new Error('Insufficient credit balance');
      }

      // List on marketplace contract
      const listTx = await this.contracts.marketplace.methods
        .listCredit(credit.tokenId, amount, this.web3.utils.toWei(price.toString(), 'ether'))
        .send({
          from: this.account.address,
          gas: 150000
        });

      // Update credit status
      credit.marketData = {
        ...credit.marketData,
        isListed: true,
        listingPrice: price,
        listedAmount: amount,
        listingDate: new Date(),
        listingTx: listTx.transactionHash
      };

      await credit.save();

      logger.info('Carbon credit listed for sale', {
        userId,
        creditId,
        amount,
        price,
        transactionHash: listTx.transactionHash
      });

      return {
        success: true,
        listing: {
          creditId,
          amount,
          price,
          transactionHash: listTx.transactionHash
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Credit listing failed:', error);
      throw new ApiError(
        'Carbon credit listing failed',
        500,
        'CREDIT_LISTING_FAILED',
        { error: error.message }
      );
    }
  }

  /**
   * Purchase carbon credits from marketplace
   * @param {string} buyerId - Buyer user ID
   * @param {string} listingId - Marketplace listing ID
   * @param {number} amount - Amount to purchase
   * @returns {Promise<Object>} Purchase result
   */
  async purchaseCredit(buyerId, listingId, amount) {
    try {
      await this.initialize();

      const buyer = await User.findById(buyerId);
      if (!buyer) {
        throw new Error('Buyer not found');
      }

      // Get listing details from marketplace contract
      const listing = await this.contracts.marketplace.methods
        .getListing(listingId)
        .call();

      if (!listing.active) {
        throw new Error('Listing is not active');
      }

      const price = this.web3.utils.fromWei(listing.price, 'ether');
      const totalCost = amount * parseFloat(price);

      // Check buyer balance (simplified - in production integrate with payment processor)
      if (buyer.carbonCredits.availableCredits < totalCost) {
        throw new Error('Insufficient funds');
      }

      // Execute purchase on blockchain
      const purchaseTx = await this.contracts.marketplace.methods
        .purchaseCredit(listingId, amount)
        .send({
          from: buyer.blockchainAddress || buyer._id.toString(),
          value: this.web3.utils.toWei(totalCost.toString(), 'ether'),
          gas: 200000
        });

      // Update database records
      const credit = await CarbonCredit.findOne({ tokenId: listing.tokenId });
      if (credit) {
        // Create new credit for buyer
        await CarbonCredit.create({
          ...credit.toObject(),
          _id: undefined,
          owner: buyer._id,
          amount: amount,
          status: 'active',
          serialNumber: `${credit.serialNumber}-P${Date.now()}`,
          marketData: {
            purchasePrice: price,
            purchaseDate: new Date(),
            purchaseTx: purchaseTx.transactionHash
          },
          metadata: {
            ...credit.metadata,
            purchaseSource: listingId,
            purchaseDate: new Date()
          }
        });

        // Update original credit
        if (credit.amount <= amount) {
          credit.status = 'sold';
          credit.marketData.isListed = false;
        } else {
          credit.amount -= amount;
        }

        await credit.save();
      }

      // Update user credit totals
      await this._updateUserCreditTotals(buyer._id);

      logger.info('Carbon credit purchased successfully', {
        buyerId,
        listingId,
        amount,
        totalCost,
        transactionHash: purchaseTx.transactionHash
      });

      return {
        success: true,
        purchase: {
          buyerId,
          listingId,
          amount,
          totalCost,
          transactionHash: purchaseTx.transactionHash
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Credit purchase failed:', error);
      throw new ApiError(
        'Carbon credit purchase failed',
        500,
        'CREDIT_PURCHASE_FAILED',
        { error: error.message }
      );
    }
  }

  /**
   * Retire carbon credits (permanent removal from circulation)
   * @param {string} userId - User ID
   * @param {string} creditId - Credit ID
   * @param {number} amount - Amount to retire
   * @param {string} reason - Retirement reason
   * @returns {Promise<Object>} Retirement result
   */
  async retireCredit(userId, creditId, amount, reason = 'voluntary') {
    try {
      await this.initialize();

      const credit = await CarbonCredit.findById(creditId);
      const user = await User.findById(userId);

      if (!credit || !user) {
        throw new Error('Credit or user not found');
      }

      if (credit.owner.toString() !== userId) {
        throw new Error('Unauthorized: Credit does not belong to user');
      }

      if (credit.amount < amount) {
        throw new Error('Insufficient credit balance');
      }

      // Retire on blockchain
      const retireTx = await this.contracts.carbonCredit.methods
        .retireCredit(credit.tokenId, amount, reason)
        .send({
          from: this.account.address,
          gas: 150000
        });

      // Update database
      const retirementRecord = {
        amount,
        reason,
        retirementDate: new Date(),
        transactionHash: retireTx.transactionHash,
        retiredBy: userId
      };

      if (credit.amount === amount) {
        // Full retirement
        credit.status = 'retired';
        credit.retirementRecords = [retirementRecord];
      } else {
        // Partial retirement
        credit.amount -= amount;
        credit.retirementRecords = credit.retirementRecords || [];
        credit.retirementRecords.push(retirementRecord);
      }

      await credit.save();

      // Update user credit totals
      await this._updateUserCreditTotals(user._id);

      logger.info('Carbon credit retired successfully', {
        userId,
        creditId,
        amount,
        reason,
        transactionHash: retireTx.transactionHash
      });

      return {
        success: true,
        retirement: {
          creditId,
          amount,
          reason,
          transactionHash: retireTx.transactionHash
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Credit retirement failed:', error);
      throw new ApiError(
        'Carbon credit retirement failed',
        500,
        'CREDIT_RETIREMENT_FAILED',
        { error: error.message }
      );
    }
  }

  /**
   * Get carbon credit balance for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Balance information
   */
  async getCreditBalance(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const credits = await CarbonCredit.find({
        owner: userId,
        status: 'active'
      });

      const totalCredits = credits.reduce((sum, credit) => sum + credit.amount, 0);
      const totalValue = credits.reduce((sum, credit) =>
        sum + (credit.amount * (credit.marketData?.currentPrice || 25)), 0
      );

      return {
        userId,
        totalCredits,
        totalValue,
        creditCount: credits.length,
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to get credit balance:', error);
      throw new ApiError(
        'Failed to retrieve credit balance',
        500,
        'BALANCE_RETRIEVAL_FAILED',
        { error: error.message }
      );
    }
  }

  /**
   * Get marketplace listings
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Marketplace listings
   */
  async getMarketplaceListings(filters = {}) {
    try {
      await this.initialize();

      // Get active listings from blockchain (simplified)
      const listings = await this.contracts.marketplace.methods
        .getActiveListings()
        .call();

      // Enrich with database information
      const enrichedListings = await Promise.all(
        listings.map(async (listing) => {
          const credit = await CarbonCredit.findOne({ tokenId: listing.tokenId });
          return {
            ...listing,
            credit: credit ? {
              serialNumber: credit.serialNumber,
              vintage: credit.vintage,
              projectName: credit.projectName,
              verificationStatus: credit.verificationStatus
            } : null,
            price: this.web3.utils.fromWei(listing.price, 'ether')
          };
        })
      );

      return enrichedListings.filter(listing =>
        (!filters.minPrice || listing.price >= filters.minPrice) &&
        (!filters.maxPrice || listing.price <= filters.maxPrice) &&
        (!filters.vintage || listing.credit?.vintage === filters.vintage)
      );

    } catch (error) {
      logger.error('Failed to get marketplace listings:', error);
      throw new ApiError(
        'Failed to retrieve marketplace listings',
        500,
        'LISTINGS_RETRIEVAL_FAILED',
        { error: error.message }
      );
    }
  }

  /**
   * Update user carbon credit totals
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async _updateUserCreditTotals(userId) {
    try {
      const credits = await CarbonCredit.find({
        owner: userId,
        status: 'active'
      });

      const totalCredits = credits.reduce((sum, credit) => sum + credit.amount, 0);
      const availableCredits = totalCredits;
      const retiredCredits = await CarbonCredit.aggregate([
        { $match: { owner: userId, status: 'retired' } },
        { $group: { _id: null, total: { $sum: '$retirementRecords.amount' } } }
      ]);

      const totalRetired = retiredCredits.length > 0 ? retiredCredits[0].total : 0;
      const totalValue = credits.reduce((sum, credit) =>
        sum + (credit.amount * (credit.marketData?.currentPrice || 25)), 0
      );

      await User.findByIdAndUpdate(userId, {
        'carbonCredits.totalCredits': totalCredits,
        'carbonCredits.availableCredits': availableCredits,
        'carbonCredits.retiredCredits': totalRetired,
        'carbonCredits.totalValue': totalValue
      });

    } catch (error) {
      logger.error('Failed to update user credit totals:', error);
    }
  }

  /**
   * Get blockchain network status
   * @returns {Promise<Object>} Network status
   */
  async getNetworkStatus() {
    try {
      await this.initialize();

      const [
        networkId,
        blockNumber,
        gasPrice,
        isSyncing
      ] = await Promise.all([
        this.web3.eth.net.getId(),
        this.web3.eth.getBlockNumber(),
        this.web3.eth.getGasPrice(),
        this.web3.eth.isSyncing()
      ]);

      return {
        networkId,
        blockNumber,
        gasPrice: this.web3.utils.fromWei(gasPrice, 'gwei'),
        isSyncing: !!isSyncing,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to get network status:', error);
      return {
        status: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Verify carbon credit on blockchain
   * @param {string} tokenId - Token ID
   * @returns {Promise<Object>} Verification result
   */
  async verifyCreditOnChain(tokenId) {
    try {
      await this.initialize();

      const credit = await this.contracts.carbonCredit.methods
        .getCredit(tokenId)
        .call();

      return {
        tokenId,
        exists: true,
        amount: this.web3.utils.fromWei(credit.amount, 'ether'),
        vintage: parseInt(credit.vintage),
        owner: credit.owner,
        isRetired: credit.isRetired,
        verificationTimestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Credit verification failed:', error);
      return {
        tokenId,
        exists: false,
        error: error.message,
        verificationTimestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
export default new CarbonCreditService();
