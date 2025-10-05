const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CarbonCredit", function () {
  let carbonCredit;
  let owner, issuer, verifier, user1, user2;
  let carbonCreditToken;

  const SAMPLE_CREDIT_DATA = {
    serialNumber: 12345,
    vintage: 2024,
    amount: 1000, // 1000 tons
    unit: "tCO2",
    projectId: "CARBON-PROJ-001",
    projectName: "Industrial Carbon Capture Pilot",
    methodology: "direct_air_capture",
  };

  beforeEach(async function () {
    [owner, issuer, verifier, user1, user2] = await ethers.getSigners();

    const CarbonCredit = await ethers.getContractFactory("CarbonCredit");
    carbonCredit = await CarbonCredit.deploy();
    await carbonCredit.deployed();

    // Authorize issuer and verifier
    await carbonCredit.connect(owner).authorizeIssuer(issuer.address);
    await carbonCredit.connect(owner).authorizeVerifier(verifier.address);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await carbonCredit.owner()).to.equal(owner.address);
    });

    it("Should authorize owner as issuer and verifier", async function () {
      expect(await carbonCredit.authorizedIssuers(owner.address)).to.equal(true);
      expect(await carbonCredit.authorizedVerifiers(owner.address)).to.equal(true);
    });
  });

  describe("Credit Minting", function () {
    it("Should mint a new carbon credit", async function () {
      const tx = await carbonCredit.connect(issuer).mintCredit(
        user1.address,
        SAMPLE_CREDIT_DATA.serialNumber,
        SAMPLE_CREDIT_DATA.vintage,
        SAMPLE_CREDIT_DATA.amount,
        SAMPLE_CREDIT_DATA.unit,
        SAMPLE_CREDIT_DATA.projectId,
        SAMPLE_CREDIT_DATA.projectName,
        SAMPLE_CREDIT_DATA.methodology,
        "QmTestMetadataHash"
      );

      await expect(tx).to.emit(carbonCredit, "CreditMinted");

      // Check token ownership
      expect(await carbonCredit.ownerOf(1)).to.equal(user1.address);

      // Check credit data
      const creditData = await carbonCredit.getCreditDetails(1);
      expect(creditData.serialNumber).to.equal(SAMPLE_CREDIT_DATA.serialNumber);
      expect(creditData.amount).to.equal(SAMPLE_CREDIT_DATA.amount);
      expect(creditData.projectId).to.equal(SAMPLE_CREDIT_DATA.projectId);
      expect(creditData.status).to.equal("active");
    });

    it("Should prevent minting with duplicate serial number", async function () {
      // First mint
      await carbonCredit.connect(issuer).mintCredit(
        user1.address,
        SAMPLE_CREDIT_DATA.serialNumber,
        SAMPLE_CREDIT_DATA.vintage,
        SAMPLE_CREDIT_DATA.amount,
        SAMPLE_CREDIT_DATA.unit,
        SAMPLE_CREDIT_DATA.projectId,
        SAMPLE_CREDIT_DATA.projectName,
        SAMPLE_CREDIT_DATA.methodology,
        "QmTestMetadataHash"
      );

      // Second mint with same serial number should fail
      await expect(
        carbonCredit.connect(issuer).mintCredit(
          user2.address,
          SAMPLE_CREDIT_DATA.serialNumber, // Same serial number
          2025,
          500,
          "tCO2",
          "CARBON-PROJ-002",
          "Another Project",
          "direct_air_capture",
          "QmTestMetadataHash2"
        )
      ).to.be.revertedWith("Serial number already used");
    });

    it("Should reject minting from unauthorized issuer", async function () {
      await expect(
        carbonCredit.connect(user1).mintCredit(
          user2.address,
          SAMPLE_CREDIT_DATA.serialNumber,
          SAMPLE_CREDIT_DATA.vintage,
          SAMPLE_CREDIT_DATA.amount,
          SAMPLE_CREDIT_DATA.unit,
          SAMPLE_CREDIT_DATA.projectId,
          SAMPLE_CREDIT_DATA.projectName,
          SAMPLE_CREDIT_DATA.methodology,
          "QmTestMetadataHash"
        )
      ).to.be.revertedWith("Not authorized to issue credits");
    });
  });

  describe("Credit Transfer", function () {
    beforeEach(async function () {
      // Mint a credit for user1
      await carbonCredit.connect(issuer).mintCredit(
        user1.address,
        SAMPLE_CREDIT_DATA.serialNumber,
        SAMPLE_CREDIT_DATA.vintage,
        SAMPLE_CREDIT_DATA.amount,
        SAMPLE_CREDIT_DATA.unit,
        SAMPLE_CREDIT_DATA.projectId,
        SAMPLE_CREDIT_DATA.projectName,
        SAMPLE_CREDIT_DATA.methodology,
        "QmTestMetadataHash"
      );
    });

    it("Should transfer credit ownership", async function () {
      const tx = await carbonCredit.connect(user1).transferCredit(1, user2.address);

      await expect(tx).to.emit(carbonCredit, "CreditTransferred");

      // Check ownership
      expect(await carbonCredit.ownerOf(1)).to.equal(user2.address);

      // Check credit data
      const creditData = await carbonCredit.getCreditDetails(1);
      expect(creditData.currentOwner).to.equal(user2.address);
    });

    it("Should record transfer transaction", async function () {
      await carbonCredit.connect(user1).transferCredit(1, user2.address);

      const history = await carbonCredit.getTransactionHistory(1);
      expect(history.length).to.equal(2); // Mint + Transfer

      const transferTx = history[1];
      expect(transferTx.from).to.equal(user1.address);
      expect(transferTx.to).to.equal(user2.address);
      expect(transferTx.transactionType).to.equal("transfer");
    });

    it("Should reject transfer of non-owned credit", async function () {
      await expect(
        carbonCredit.connect(user2).transferCredit(1, user1.address)
      ).to.be.revertedWith("Not the owner");
    });
  });

  describe("Credit Retirement", function () {
    beforeEach(async function () {
      // Mint a credit for user1
      await carbonCredit.connect(issuer).mintCredit(
        user1.address,
        SAMPLE_CREDIT_DATA.serialNumber,
        SAMPLE_CREDIT_DATA.vintage,
        SAMPLE_CREDIT_DATA.amount,
        SAMPLE_CREDIT_DATA.unit,
        SAMPLE_CREDIT_DATA.projectId,
        SAMPLE_CREDIT_DATA.projectName,
        SAMPLE_CREDIT_DATA.methodology,
        "QmTestMetadataHash"
      );
    });

    it("Should retire credit successfully", async function () {
      const retirementReason = "Corporate ESG commitment";
      const beneficiary = user2.address;

      const tx = await carbonCredit.connect(user1).retireCredit(1, retirementReason, beneficiary);

      await expect(tx).to.emit(carbonCredit, "CreditRetired");

      // Check credit data
      const creditData = await carbonCredit.getCreditDetails(1);
      expect(creditData.status).to.equal("retired");
      expect(creditData.retirementReason).to.equal(retirementReason);
      expect(creditData.beneficiary).to.equal(beneficiary);

      // Check if token is burned (should not exist)
      await expect(carbonCredit.ownerOf(1)).to.be.revertedWith("ERC721: invalid token ID");
    });

    it("Should update retired credits count", async function () {
      await carbonCredit.connect(user1).retireCredit(1, "Test retirement", user2.address);

      const totalRetired = await carbonCredit.getTotalRetiredCredits();
      expect(totalRetired).to.equal(SAMPLE_CREDIT_DATA.amount);
    });
  });

  describe("Credit Verification", function () {
    beforeEach(async function () {
      // Mint a credit
      await carbonCredit.connect(issuer).mintCredit(
        user1.address,
        SAMPLE_CREDIT_DATA.serialNumber,
        SAMPLE_CREDIT_DATA.vintage,
        SAMPLE_CREDIT_DATA.amount,
        SAMPLE_CREDIT_DATA.unit,
        SAMPLE_CREDIT_DATA.projectId,
        SAMPLE_CREDIT_DATA.projectName,
        SAMPLE_CREDIT_DATA.methodology,
        "QmTestMetadataHash"
      );
    });

    it("Should verify credit successfully", async function () {
      const verificationMethod = "satellite_imagery";
      const confidenceScore = 95;
      const evidence = ["QmEvidence1", "QmEvidence2"];

      const tx = await carbonCredit.connect(verifier).verifyCredit(
        1,
        verificationMethod,
        confidenceScore,
        evidence,
        "direct_measurement"
      );

      await expect(tx).to.emit(carbonCredit, "CreditVerified");

      // Check verification data
      const creditData = await carbonCredit.getCreditDetails(1);
      expect(creditData.verification.verifier).to.equal(verifier.address);
      expect(creditData.verification.verificationMethod).to.equal(verificationMethod);
      expect(creditData.verification.confidenceScore).to.equal(confidenceScore);
      expect(creditData.verification.evidence).to.deep.equal(evidence);
    });

    it("Should reject verification from unauthorized verifier", async function () {
      await expect(
        carbonCredit.connect(user1).verifyCredit(
          1,
          "satellite_imagery",
          95,
          ["QmEvidence"],
          "direct_measurement"
        )
      ).to.be.revertedWith("Not authorized to verify credits");
    });

    it("Should reject invalid confidence score", async function () {
      await expect(
        carbonCredit.connect(verifier).verifyCredit(
          1,
          "satellite_imagery",
          150, // Invalid: > 100
          ["QmEvidence"],
          "direct_measurement"
        )
      ).to.be.revertedWith("Invalid confidence score");
    });
  });

  describe("Authorization Management", function () {
    it("Should authorize new issuer", async function () {
      await carbonCredit.connect(owner).authorizeIssuer(user1.address);
      expect(await carbonCredit.authorizedIssuers(user1.address)).to.equal(true);
    });

    it("Should authorize new verifier", async function () {
      await carbonCredit.connect(owner).authorizeVerifier(user1.address);
      expect(await carbonCredit.authorizedVerifiers(user1.address)).to.equal(true);
    });

    it("Should reject authorization from non-owner", async function () {
      await expect(
        carbonCredit.connect(user1).authorizeIssuer(user2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Query Functions", function () {
    beforeEach(async function () {
      // Mint several credits
      for (let i = 1; i <= 3; i++) {
        await carbonCredit.connect(issuer).mintCredit(
          user1.address,
          SAMPLE_CREDIT_DATA.serialNumber + i,
          SAMPLE_CREDIT_DATA.vintage,
          SAMPLE_CREDIT_DATA.amount,
          SAMPLE_CREDIT_DATA.unit,
          `${SAMPLE_CREDIT_DATA.projectId}-${i}`,
          `${SAMPLE_CREDIT_DATA.projectName} ${i}`,
          SAMPLE_CREDIT_DATA.methodology,
          `QmMetadata${i}`
        );
      }
    });

    it("Should return credits by owner", async function () {
      const credits = await carbonCredit.getCreditsByOwner(user1.address);
      expect(credits.length).to.equal(3);
      expect(credits).to.deep.equal([1, 2, 3]);
    });

    it("Should return credits by project", async function () {
      const credits = await carbonCredit.getCreditsByProject(`${SAMPLE_CREDIT_DATA.projectId}-1`);
      expect(credits.length).to.equal(1);
      expect(credits[0]).to.equal(1);
    });

    it("Should return total active credits", async function () {
      const totalActive = await carbonCredit.getTotalActiveCredits();
      expect(totalActive).to.equal(3000); // 3 credits × 1000 tons each
    });
  });
});
