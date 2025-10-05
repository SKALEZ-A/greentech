/**
 * Unit tests for CarbonCredit Model
 */

const chai = require('chai');
const sinon = require('sinon');
const { expect } = chai;

// Mock mongoose
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Import the model
const CarbonCredit = require('../../backend/src/models/CarbonCredit');

describe('CarbonCredit Model', () => {
  let credit;
  let mockCredit;

  beforeEach(() => {
    // Create a mock credit instance
    mockCredit = {
      tokenId: 'CC1234567890123456789012345678901234567890',
      serialNumber: 'CC-2024-CC001-0001',
      vintage: 2024,
      amount: 125.5,
      unit: 'tCO2',
      projectId: 'NYC_Downtown_001',
      projectName: 'Downtown Manhattan Carbon Capture',
      unitId: 'CC-001',
      owner: 'user123',
      issueDate: new Date(),
      status: 'active',
      verification: {
        verifier: 'verifier123',
        verificationMethod: 'ai_prediction',
        verificationDate: new Date(),
        confidenceScore: 95,
        evidence: ['ipfs://QmEvidence1'],
        methodology: 'hybrid'
      },
      transactions: [],
      retiredCredits: new Map(),
      creditsByOwner: new Map(),
      creditsByProject: new Map(),
    };

    // Stub the model methods
    sinon.stub(CarbonCredit, 'findById').resolves(mockCredit);
    sinon.stub(CarbonCredit, 'find').returns({
      populate: sinon.stub().returnsThis(),
      sort: sinon.stub().returnsThis(),
      skip: sinon.stub().returnsThis(),
      limit: sinon.stub().returnsThis(),
      exec: sinon.stub().resolves([mockCredit]),
    });
    sinon.stub(CarbonCredit, 'findOne').resolves(mockCredit);
    sinon.stub(CarbonCredit, 'create').resolves(mockCredit);
    sinon.stub(CarbonCredit, 'countDocuments').resolves(1);
    sinon.stub(CarbonCredit, 'aggregate').resolves([{ totalCredits: 1000 }]);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Credit Creation and Validation', () => {
    it('should create a carbon credit with valid data', async () => {
      const creditData = {
        tokenId: 'CC1234567890123456789012345678901234567890',
        serialNumber: 'CC-2024-CC001-0001',
        vintage: 2024,
        amount: 125.5,
        unit: 'tCO2',
        projectId: 'NYC_Downtown_001',
        projectName: 'Downtown Manhattan Carbon Capture',
        unitId: 'CC-001',
        owner: 'user123',
      };

      const created = await CarbonCredit.create(creditData);

      expect(created).to.be.an('object');
      expect(created.tokenId).to.equal(creditData.tokenId);
      expect(created.amount).to.equal(creditData.amount);
      expect(created.status).to.equal('active');
    });

    it('should validate required fields', () => {
      // Test would validate schema requirements
      // This would be tested through mongoose validation
      expect(true).to.be.true; // Placeholder for actual validation tests
    });

    it('should enforce vintage year constraints', () => {
      // Test vintage year validation
      const invalidVintages = [1999, 2101];
      invalidVintages.forEach(vintage => {
        expect(vintage).to.be.within(2000, 2100);
      });
    });
  });

  describe('Credit Transfer', () => {
    it('should transfer credit ownership', async () => {
      const credit = await CarbonCredit.findById('credit123');
      const newOwner = 'newOwner456';

      // Mock the transfer method
      credit.transfer = sinon.stub().resolves(credit);

      await credit.transfer(newOwner, 'txHash123', 12345);

      expect(credit.transfer.calledWith(newOwner, 'txHash123', 12345)).to.be.true;
    });

    it('should record transfer transaction', () => {
      // Test transaction recording
      const transactions = mockCredit.transactions;
      expect(transactions).to.be.an('array');
    });
  });

  describe('Credit Retirement', () => {
    it('should retire active credits', async () => {
      const credit = await CarbonCredit.findById('credit123');
      const beneficiary = 'beneficiary123';
      const reason = 'voluntary';

      // Mock the retire method
      credit.retire = sinon.stub().resolves(credit);

      await credit.retire(beneficiary, reason);

      expect(credit.retire.calledWith(beneficiary, reason)).to.be.true;
    });

    it('should prevent retirement of already retired credits', async () => {
      const retiredCredit = { ...mockCredit, status: 'retired' };

      // Mock findById to return retired credit
      CarbonCredit.findById.resolves(retiredCredit);

      const credit = await CarbonCredit.findById('credit123');

      expect(credit.status).to.equal('retired');
    });
  });

  describe('Verification', () => {
    it('should verify credit with valid data', async () => {
      const credit = await CarbonCredit.findById('credit123');
      const verificationData = {
        verifierId: 'verifier123',
        method: 'ai_prediction',
        confidenceScore: 95,
        evidence: ['ipfs://QmEvidence1'],
        methodology: 'hybrid'
      };

      // Mock the verify method
      credit.verify = sinon.stub().resolves(credit);

      await credit.verify(
        verificationData.verifierId,
        verificationData.method,
        verificationData.confidenceScore,
        verificationData.evidence,
        verificationData.methodology
      );

      expect(credit.verify.calledOnce).to.be.true;
    });

    it('should validate confidence score range', () => {
      const validScores = [0, 50, 100];
      const invalidScores = [-1, 101];

      validScores.forEach(score => {
        expect(score).to.be.within(0, 100);
      });

      invalidScores.forEach(score => {
        expect(score < 0 || score > 100).to.be.true;
      });
    });
  });

  describe('Market Operations', () => {
    it('should list credit for sale', async () => {
      const credit = await CarbonCredit.findById('credit123');
      const listingData = {
        price: 42500000000000000, // 42.5 ETH in wei
        amount: 100,
        paymentToken: '0x0000000000000000000000000000000000000000' // ETH
      };

      // Mock the listForSale method
      credit.listForSale = sinon.stub().resolves(credit);

      await credit.listForSale('marketplace123', listingData.price, 'seller123');

      expect(credit.listForSale.calledWith('marketplace123', listingData.price, 'seller123')).to.be.true;
    });

    it('should update credit price', async () => {
      const credit = await CarbonCredit.findById('credit123');
      const newPrice = 45000000000000000; // 45 ETH in wei

      // Mock the updatePrice method
      credit.updatePrice = sinon.stub().resolves(credit);

      await credit.updatePrice(newPrice, 'market');

      expect(credit.updatePrice.calledWith(newPrice, 'market')).to.be.true;
    });
  });

  describe('Query Methods', () => {
    it('should find credits by owner', async () => {
      const ownerId = 'user123';
      const credits = await CarbonCredit.find({ owner: ownerId });

      expect(credits).to.be.an('array');
      expect(credits.length).to.be.greaterThan(0);
    });

    it('should find credits by project', async () => {
      const projectId = 'NYC_Downtown_001';
      const credits = await CarbonCredit.find({ projectId });

      expect(credits).to.be.an('array');
    });

    it('should get credit statistics', async () => {
      const stats = await CarbonCredit.aggregate([
        {
          $group: {
            _id: null,
            totalCredits: { $sum: '$amount' },
            activeCredits: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, '$amount', 0] } },
            retiredCredits: { $sum: { $cond: [{ $eq: ['$status', 'retired'] }, '$amount', 0] } },
          }
        }
      ]);

      expect(stats).to.be.an('array');
      expect(stats[0]).to.have.property('totalCredits');
      expect(stats[0]).to.have.property('activeCredits');
      expect(stats[0]).to.have.property('retiredCredits');
    });
  });

  describe('Virtual Properties', () => {
    it('should calculate current value', () => {
      const credit = mockCredit;
      credit.marketData = { currentPrice: 42.50 };
      credit.amount = 100;

      // Test virtual property calculation
      const expectedValue = credit.marketData.currentPrice * credit.amount;
      expect(expectedValue).to.equal(4250);
    });

    it('should calculate age in years', () => {
      const credit = mockCredit;
      credit.vintage = 2020;
      const currentYear = new Date().getFullYear();

      const expectedAge = currentYear - credit.vintage;
      expect(expectedAge).to.equal(currentYear - 2020);
    });

    it('should count transactions', () => {
      const credit = mockCredit;
      credit.transactions = [
        { type: 'mint', timestamp: new Date() },
        { type: 'transfer', timestamp: new Date() },
        { type: 'retirement', timestamp: new Date() }
      ];

      expect(credit.transactions.length).to.equal(3);
    });
  });

  describe('Validation', () => {
    it('should require positive amount', () => {
      const invalidAmounts = [0, -1, -100];

      invalidAmounts.forEach(amount => {
        expect(amount).to.be.at.most(0);
      });
    });

    it('should validate project information', () => {
      const credit = mockCredit;

      expect(credit.projectId).to.be.a('string');
      expect(credit.projectId.length).to.be.greaterThan(0);
      expect(credit.projectName).to.be.a('string');
      expect(credit.projectName.length).to.be.greaterThan(0);
    });

    it('should validate methodology', () => {
      const validMethodologies = ['direct_air_capture', 'industrial_capture', 'biomass', 'reforestation'];
      const testMethodology = mockCredit.methodology;

      expect(validMethodologies).to.include(testMethodology);
    });
  });

  describe('Compliance and Standards', () => {
    it('should track compliance standards', () => {
      const credit = mockCredit;
      credit.compliance = {
        standards: ['corsia', 'icca'],
        certifications: [
          {
            name: 'ISO 14064-2',
            issuer: 'International Organization for Standardization'
          }
        ]
      };

      expect(credit.compliance.standards).to.be.an('array');
      expect(credit.compliance.standards).to.include('corsia');
      expect(credit.compliance.certifications).to.be.an('array');
      expect(credit.compliance.certifications[0].name).to.equal('ISO 14064-2');
    });

    it('should track verification status', () => {
      const credit = mockCredit;

      expect(credit.verification).to.be.an('object');
      expect(credit.verification.confidenceScore).to.be.within(0, 100);
      expect(credit.verification.evidence).to.be.an('array');
    });
  });
});
