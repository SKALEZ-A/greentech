const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CarbonCreditMarketplace", function () {
  let carbonCredit, marketplace;
  let owner, seller, buyer, feeRecipient;
  let carbonCreditToken, marketplaceContract;

  const PLATFORM_FEE = 250; // 2.5%
  const CREDIT_AMOUNT = 1000; // 1000 tons
  const CREDIT_PRICE = ethers.utils.parseEther("100"); // 100 ETH per credit

  beforeEach(async function () {
    [owner, seller, buyer, feeRecipient] = await ethers.getSigners();

    // Deploy CarbonCredit contract
    const CarbonCredit = await ethers.getContractFactory("CarbonCredit");
    carbonCredit = await CarbonCredit.deploy();
    await carbonCredit.deployed();

    // Authorize seller as issuer
    await carbonCredit.connect(owner).authorizeIssuer(seller.address);

    // Deploy marketplace
    const CarbonCreditMarketplace = await ethers.getContractFactory("CarbonCreditMarketplace");
    marketplace = await CarbonCreditMarketplace.deploy(
      carbonCredit.address,
      feeRecipient.address,
      PLATFORM_FEE
    );
    await marketplace.deployed();

    // Mint a credit for seller
    await carbonCredit.connect(seller).mintCredit(
      seller.address,
      12345,
      2024,
      CREDIT_AMOUNT,
      "tCO2",
      "CARBON-PROJ-001",
      "Test Carbon Project",
      "direct_air_capture",
      "QmTestMetadata"
    );
  });

  describe("Deployment", function () {
    it("Should set the right contracts and parameters", async function () {
      expect(await marketplace.carbonCreditToken()).to.equal(carbonCredit.address);
      expect(await marketplace.feeRecipient()).to.equal(feeRecipient.address);
      expect(await marketplace.platformFee()).to.equal(PLATFORM_FEE);
    });

    it("Should support ETH by default", async function () {
      expect(await marketplace.supportedPaymentTokens(ethers.constants.AddressZero)).to.equal(true);
    });
  });

  describe("Fixed Price Listings", function () {
    it("Should create a fixed price listing", async function () {
      const duration = 86400; // 1 day
      const amount = 500; // Partial listing

      const tx = await marketplace.connect(seller).createListing(
        1, // tokenId
        CREDIT_PRICE,
        amount,
        duration,
        ethers.constants.AddressZero // ETH
      );

      await expect(tx).to.emit(marketplace, "ListingCreated");

      const listing = await marketplace.listings(1);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.price).to.equal(CREDIT_PRICE);
      expect(listing.amount).to.equal(amount);
      expect(listing.active).to.equal(true);
    });

    it("Should update listing price", async function () {
      // Create listing first
      await marketplace.connect(seller).createListing(
        1, CREDIT_PRICE, CREDIT_AMOUNT, 86400, ethers.constants.AddressZero
      );

      const newPrice = ethers.utils.parseEther("150");

      const tx = await marketplace.connect(seller).updateListing(1, newPrice);
      await expect(tx).to.emit(marketplace, "ListingUpdated");

      const listing = await marketplace.listings(1);
      expect(listing.price).to.equal(newPrice);
    });

    it("Should cancel listing", async function () {
      // Create listing first
      await marketplace.connect(seller).createListing(
        1, CREDIT_PRICE, CREDIT_AMOUNT, 86400, ethers.constants.AddressZero
      );

      const tx = await marketplace.connect(seller).cancelListing(1);
      await expect(tx).to.emit(marketplace, "ListingCancelled");

      const listing = await marketplace.listings(1);
      expect(listing.active).to.equal(false);
    });

    it("Should purchase from listing", async function () {
      // Create listing
      await marketplace.connect(seller).createListing(
        1, CREDIT_PRICE, CREDIT_AMOUNT, 86400, ethers.constants.AddressZero
      );

      // Purchase
      const purchaseAmount = 500;
      const totalPrice = CREDIT_PRICE.mul(purchaseAmount).div(100); // Price per 100kg

      const tx = await marketplace.connect(buyer).purchaseListing(1, purchaseAmount, {
        value: totalPrice
      });

      await expect(tx).to.emit(marketplace, "ListingSold");

      // Check that buyer now owns the credit
      expect(await carbonCredit.ownerOf(1)).to.equal(buyer.address);

      // Check fee recipient received fees
      const expectedFee = totalPrice.mul(PLATFORM_FEE).div(10000);
      const feeRecipientBalance = await ethers.provider.getBalance(feeRecipient.address);
      expect(feeRecipientBalance).to.equal(expectedFee);
    });

    it("Should reject purchase with insufficient funds", async function () {
      // Create listing
      await marketplace.connect(seller).createListing(
        1, CREDIT_PRICE, CREDIT_AMOUNT, 86400, ethers.constants.AddressZero
      );

      // Try to purchase with insufficient funds
      const totalPrice = CREDIT_PRICE.mul(500).div(100);

      await expect(
        marketplace.connect(buyer).purchaseListing(1, 500, {
          value: totalPrice.div(2) // Only half the price
        })
      ).to.be.revertedWith("Insufficient ETH sent");
    });
  });

  describe("Auctions", function () {
    it("Should create an auction", async function () {
      const startingPrice = ethers.utils.parseEther("50");
      const reservePrice = ethers.utils.parseEther("200");
      const duration = 86400; // 1 day

      const tx = await marketplace.connect(seller).createAuction(
        1, // tokenId
        startingPrice,
        reservePrice,
        duration,
        ethers.constants.AddressZero // ETH
      );

      await expect(tx).to.emit(marketplace, "AuctionCreated");

      const auction = await marketplace.auctions(1);
      expect(auction.seller).to.equal(seller.address);
      expect(auction.startingPrice).to.equal(startingPrice);
      expect(auction.reservePrice).to.equal(reservePrice);
      expect(auction.active).to.equal(true);
    });

    it("Should place a bid on auction", async function () {
      // Create auction
      const startingPrice = ethers.utils.parseEther("50");
      await marketplace.connect(seller).createAuction(
        1, startingPrice, ethers.utils.parseEther("200"), 86400, ethers.constants.AddressZero
      );

      // Place bid
      const bidAmount = ethers.utils.parseEther("75");
      const tx = await marketplace.connect(buyer).placeBid(1, bidAmount, {
        value: bidAmount
      });

      await expect(tx).to.emit(marketplace, "AuctionBid");

      const auction = await marketplace.auctions(1);
      expect(auction.currentBid).to.equal(bidAmount);
      expect(auction.currentBidder).to.equal(buyer.address);
      expect(auction.bidCount).to.equal(1);
    });

    it("Should reject bid below current bid", async function () {
      // Create auction and place first bid
      const startingPrice = ethers.utils.parseEther("50");
      await marketplace.connect(seller).createAuction(
        1, startingPrice, ethers.utils.parseEther("200"), 86400, ethers.constants.AddressZero
      );

      await marketplace.connect(buyer).placeBid(1, ethers.utils.parseEther("75"), {
        value: ethers.utils.parseEther("75")
      });

      // Try to place lower bid
      await expect(
        marketplace.connect(owner).placeBid(1, ethers.utils.parseEther("60"), {
          value: ethers.utils.parseEther("60")
        })
      ).to.be.revertedWith("Bid too low");
    });

    it("Should end auction successfully", async function () {
      // Create auction and place bid above reserve
      const startingPrice = ethers.utils.parseEther("50");
      const reservePrice = ethers.utils.parseEther("100");
      await marketplace.connect(seller).createAuction(
        1, startingPrice, reservePrice, 1, ethers.constants.AddressZero // 1 second duration
      );

      await marketplace.connect(buyer).placeBid(1, reservePrice, {
        value: reservePrice
      });

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine");

      // End auction
      const tx = await marketplace.connect(owner).endAuction(1);

      await expect(tx).to.emit(marketplace, "AuctionEnded");

      // Check final state
      const auction = await marketplace.auctions(1);
      expect(auction.active).to.equal(false);

      // Check that buyer owns the credit
      expect(await carbonCredit.ownerOf(1)).to.equal(buyer.address);
    });

    it("Should handle failed auction (no bids above reserve)", async function () {
      // Create auction with high reserve price
      const startingPrice = ethers.utils.parseEther("50");
      const reservePrice = ethers.utils.parseEther("1000"); // Very high
      await marketplace.connect(seller).createAuction(
        1, startingPrice, reservePrice, 1, ethers.constants.AddressZero
      );

      // Place bid below reserve
      await marketplace.connect(buyer).placeBid(1, ethers.utils.parseEther("75"), {
        value: ethers.utils.parseEther("75")
      });

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine");

      // End auction
      const tx = await marketplace.connect(owner).endAuction(1);

      await expect(tx).to.emit(marketplace, "AuctionEnded");

      // Check that seller still owns the credit
      expect(await carbonCredit.ownerOf(1)).to.equal(seller.address);

      // Check that bid was refunded
      const buyerBalance = await ethers.provider.getBalance(buyer.address);
      // Balance should be approximately restored (minus gas costs)
      expect(buyerBalance).to.be.closeTo(
        ethers.utils.parseEther("10000"), // Initial balance minus small gas costs
        ethers.utils.parseEther("0.1")
      );
    });
  });

  describe("Payment Tokens", function () {
    let mockERC20;

    beforeEach(async function () {
      // Deploy mock ERC20 token
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      mockERC20 = await MockERC20.deploy("Mock Token", "MOCK", ethers.utils.parseEther("1000000"));
      await mockERC20.deployed();

      // Transfer some tokens to buyer
      await mockERC20.transfer(buyer.address, ethers.utils.parseEther("10000"));
    });

    it("Should add supported payment token", async function () {
      await marketplace.connect(owner).addPaymentToken(mockERC20.address);
      expect(await marketplace.supportedPaymentTokens(mockERC20.address)).to.equal(true);
    });

    it("Should reject listing with unsupported payment token", async function () {
      await expect(
        marketplace.connect(seller).createListing(
          1, CREDIT_PRICE, CREDIT_AMOUNT, 86400, mockERC20.address
        )
      ).to.be.revertedWith("Payment token not supported");
    });

    it("Should handle ERC20 payments", async function () {
      // Add token as supported
      await marketplace.connect(owner).addPaymentToken(mockERC20.address);

      // Create listing
      await marketplace.connect(seller).createListing(
        1, ethers.utils.parseEther("100"), CREDIT_AMOUNT, 86400, mockERC20.address
      );

      // Approve marketplace to spend tokens
      await mockERC20.connect(buyer).approve(marketplace.address, ethers.utils.parseEther("100"));

      // Purchase
      const purchaseAmount = 500;
      const totalPrice = ethers.utils.parseEther("100").mul(purchaseAmount).div(100);

      const tx = await marketplace.connect(buyer).purchaseListing(1, purchaseAmount);

      await expect(tx).to.emit(marketplace, "ListingSold");

      // Check token balances
      const expectedFee = totalPrice.mul(PLATFORM_FEE).div(10000);
      expect(await mockERC20.balanceOf(feeRecipient.address)).to.equal(expectedFee);
      expect(await mockERC20.balanceOf(seller.address)).to.equal(totalPrice.sub(expectedFee));
    });
  });

  describe("Query Functions", function () {
    beforeEach(async function () {
      // Create multiple listings
      for (let i = 0; i < 3; i++) {
        await marketplace.connect(seller).createListing(
          1, CREDIT_PRICE.mul(i + 1), CREDIT_AMOUNT, 86400, ethers.constants.AddressZero
        );
      }
    });

    it("Should return active listings", async function () {
      const activeListings = await marketplace.getActiveListings();
      expect(activeListings.length).to.equal(3);
      expect(activeListings).to.deep.equal([1, 2, 3]);
    });

    it("Should return user's listings", async function () {
      const userListings = await marketplace.getUserListings(seller.address);
      expect(userListings.length).to.equal(3);
    });

    it("Should return user's trades", async function () {
      // Make a purchase first
      await marketplace.connect(buyer).purchaseListing(1, 500, {
        value: CREDIT_PRICE.mul(500).div(100)
      });

      const sellerTrades = await marketplace.getUserTrades(seller.address);
      const buyerTrades = await marketplace.getUserTrades(buyer.address);

      expect(sellerTrades.length).to.equal(1);
      expect(buyerTrades.length).to.equal(1);
    });
  });

  describe("Admin Functions", function () {
    it("Should update platform fee", async function () {
      const newFee = 500; // 5%
      await marketplace.connect(owner).updatePlatformFee(newFee);
      expect(await marketplace.platformFee()).to.equal(newFee);
    });

    it("Should update fee recipient", async function () {
      await marketplace.connect(owner).updateFeeRecipient(buyer.address);
      expect(await marketplace.feeRecipient()).to.equal(buyer.address);
    });

    it("Should reject fee update from non-owner", async function () {
      await expect(
        marketplace.connect(buyer).updatePlatformFee(500)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
