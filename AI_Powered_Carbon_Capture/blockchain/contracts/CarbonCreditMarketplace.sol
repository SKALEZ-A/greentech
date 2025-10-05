// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./CarbonCredit.sol";

/**
 * @title CarbonCreditMarketplace
 * @dev Decentralized marketplace for trading carbon credits
 * Supports both direct sales and auction mechanisms
 */
contract CarbonCreditMarketplace is Ownable, ReentrancyGuard {
    CarbonCredit public carbonCreditToken;

    // Listing structure
    struct Listing {
        uint256 tokenId;
        address seller;
        uint256 price;           // Price per ton in wei
        uint256 amount;          // Amount available for sale (for partial sales)
        string listingType;      // "fixed_price", "auction"
        uint256 createdAt;
        uint256 expiresAt;
        bool active;
        address paymentToken;    // Address of ERC20 token for payment (0x0 for ETH)
    }

    // Auction structure
    struct Auction {
        uint256 tokenId;
        address seller;
        uint256 startingPrice;
        uint256 reservePrice;
        uint256 currentBid;
        address currentBidder;
        uint256 endTime;
        bool active;
        address paymentToken;
        uint256 bidCount;
    }

    // Trade structure
    struct Trade {
        uint256 listingId;
        uint256 tokenId;
        address buyer;
        address seller;
        uint256 price;
        uint256 amount;
        uint256 timestamp;
        address paymentToken;
        string tradeType;        // "direct", "auction"
    }

    // State variables
    mapping(uint256 => Listing) public listings;
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => Trade) public trades;
    mapping(address => uint256[]) public userListings;
    mapping(address => uint256[]) public userTrades;
    mapping(uint256 => mapping(address => uint256)) public auctionBids; // tokenId => bidder => bidAmount

    uint256 public listingCounter;
    uint256 public tradeCounter;
    uint256 public platformFee; // Fee in basis points (e.g., 250 = 2.5%)
    address public feeRecipient;

    // Supported payment tokens
    mapping(address => bool) public supportedPaymentTokens;

    // Events
    event ListingCreated(uint256 indexed listingId, uint256 indexed tokenId, address indexed seller, uint256 price);
    event ListingUpdated(uint256 indexed listingId, uint256 newPrice);
    event ListingCancelled(uint256 indexed listingId);
    event ListingSold(uint256 indexed listingId, uint256 indexed tokenId, address indexed buyer, uint256 price);

    event AuctionCreated(uint256 indexed tokenId, address indexed seller, uint256 startingPrice, uint256 endTime);
    event AuctionBid(uint256 indexed tokenId, address indexed bidder, uint256 bidAmount);
    event AuctionEnded(uint256 indexed tokenId, address indexed winner, uint256 finalPrice);

    event TradeExecuted(uint256 indexed tradeId, uint256 indexed tokenId, address indexed buyer, address seller, uint256 price);

    event PaymentTokenAdded(address indexed token);
    event PaymentTokenRemoved(address indexed token);

    // Modifiers
    modifier listingExists(uint256 listingId) {
        require(listings[listingId].seller != address(0), "Listing does not exist");
        _;
    }

    modifier listingActive(uint256 listingId) {
        require(listings[listingId].active, "Listing not active");
        require(block.timestamp <= listings[listingId].expiresAt, "Listing expired");
        _;
    }

    modifier auctionExists(uint256 tokenId) {
        require(auctions[tokenId].seller != address(0), "Auction does not exist");
        _;
    }

    modifier auctionActive(uint256 tokenId) {
        require(auctions[tokenId].active, "Auction not active");
        require(block.timestamp < auctions[tokenId].endTime, "Auction ended");
        _;
    }

    /**
     * @dev Constructor
     */
    constructor(address _carbonCreditToken, address _feeRecipient, uint256 _platformFee) {
        carbonCreditToken = CarbonCredit(_carbonCreditToken);
        feeRecipient = _feeRecipient;
        platformFee = _platformFee;

        // Support ETH by default
        supportedPaymentTokens[address(0)] = true;
    }

    /**
     * @dev Create a fixed-price listing
     */
    function createListing(
        uint256 tokenId,
        uint256 price,
        uint256 amount,
        uint256 duration,
        address paymentToken
    ) external returns (uint256) {
        require(carbonCreditToken.ownerOf(tokenId) == msg.sender, "Not the token owner");
        require(supportedPaymentTokens[paymentToken], "Payment token not supported");
        require(price > 0, "Price must be greater than 0");
        require(duration > 0 && duration <= 365 days, "Invalid duration");

        // Check if token is active (not retired)
        CarbonCredit.CreditData memory creditData = carbonCreditToken.getCreditDetails(tokenId);
        require(keccak256(bytes(creditData.status)) == keccak256(bytes("active")), "Credit not active");

        listingCounter++;
        uint256 listingId = listingCounter;

        listings[listingId] = Listing({
            tokenId: tokenId,
            seller: msg.sender,
            price: price,
            amount: amount > 0 ? amount : creditData.amount,
            listingType: "fixed_price",
            createdAt: block.timestamp,
            expiresAt: block.timestamp + duration,
            active: true,
            paymentToken: paymentToken
        });

        userListings[msg.sender].push(listingId);

        emit ListingCreated(listingId, tokenId, msg.sender, price);

        return listingId;
    }

    /**
     * @dev Update listing price
     */
    function updateListing(uint256 listingId, uint256 newPrice) external listingExists(listingId) {
        Listing storage listing = listings[listingId];
        require(listing.seller == msg.sender, "Not the seller");
        require(listing.active, "Listing not active");
        require(newPrice > 0, "Price must be greater than 0");

        listing.price = newPrice;

        emit ListingUpdated(listingId, newPrice);
    }

    /**
     * @dev Cancel listing
     */
    function cancelListing(uint256 listingId) external listingExists(listingId) {
        Listing storage listing = listings[listingId];
        require(listing.seller == msg.sender, "Not the seller");

        listing.active = false;

        emit ListingCancelled(listingId);
    }

    /**
     * @dev Purchase from a fixed-price listing
     */
    function purchaseListing(uint256 listingId, uint256 amount) external payable nonReentrant listingExists(listingId) listingActive(listingId) {
        Listing storage listing = listings[listingId];
        require(amount > 0 && amount <= listing.amount, "Invalid amount");

        uint256 totalPrice = (listing.price * amount) / 100; // Assuming price is per 100kg or similar

        // Handle payment
        if (listing.paymentToken == address(0)) {
            // ETH payment
            require(msg.value >= totalPrice, "Insufficient ETH sent");
        } else {
            // ERC20 payment
            IERC20(listing.paymentToken).transferFrom(msg.sender, address(this), totalPrice);
        }

        // Calculate platform fee
        uint256 fee = (totalPrice * platformFee) / 10000; // platformFee in basis points
        uint256 sellerProceeds = totalPrice - fee;

        // Transfer fee to recipient
        if (listing.paymentToken == address(0)) {
            payable(feeRecipient).transfer(fee);
            payable(listing.seller).transfer(sellerProceeds);
        } else {
            IERC20(listing.paymentToken).transfer(feeRecipient, fee);
            IERC20(listing.paymentToken).transfer(listing.seller, sellerProceeds);
        }

        // Update listing
        listing.amount -= amount;

        // If full amount purchased, deactivate listing
        if (listing.amount == 0) {
            listing.active = false;
        }

        // Record trade
        tradeCounter++;
        trades[tradeCounter] = Trade({
            listingId: listingId,
            tokenId: listing.tokenId,
            buyer: msg.sender,
            seller: listing.seller,
            price: listing.price,
            amount: amount,
            timestamp: block.timestamp,
            paymentToken: listing.paymentToken,
            tradeType: "direct"
        });

        userTrades[msg.sender].push(tradeCounter);
        userTrades[listing.seller].push(tradeCounter);

        // Transfer carbon credit (partial transfer if amount < total)
        CarbonCredit.CreditData memory creditData = carbonCreditToken.getCreditDetails(listing.tokenId);
        if (amount < creditData.amount) {
            // For partial purchases, we would need a split function in the token contract
            // For now, assume full transfer
            carbonCreditToken.transferCredit(listing.tokenId, msg.sender);
        } else {
            carbonCreditToken.transferCredit(listing.tokenId, msg.sender);
        }

        emit ListingSold(listingId, listing.tokenId, msg.sender, totalPrice);
        emit TradeExecuted(tradeCounter, listing.tokenId, msg.sender, listing.seller, totalPrice);
    }

    /**
     * @dev Create an auction
     */
    function createAuction(
        uint256 tokenId,
        uint256 startingPrice,
        uint256 reservePrice,
        uint256 duration,
        address paymentToken
    ) external returns (bool) {
        require(carbonCreditToken.ownerOf(tokenId) == msg.sender, "Not the token owner");
        require(supportedPaymentTokens[paymentToken], "Payment token not supported");
        require(startingPrice > 0, "Starting price must be greater than 0");
        require(duration > 0 && duration <= 7 days, "Invalid auction duration");
        require(reservePrice >= startingPrice, "Reserve price must be >= starting price");

        // Check if token is active
        CarbonCredit.CreditData memory creditData = carbonCreditToken.getCreditDetails(tokenId);
        require(keccak256(bytes(creditData.status)) == keccak256(bytes("active")), "Credit not active");

        // Check if auction already exists
        require(auctions[tokenId].seller == address(0) || !auctions[tokenId].active, "Auction already exists");

        auctions[tokenId] = Auction({
            tokenId: tokenId,
            seller: msg.sender,
            startingPrice: startingPrice,
            reservePrice: reservePrice,
            currentBid: 0,
            currentBidder: address(0),
            endTime: block.timestamp + duration,
            active: true,
            paymentToken: paymentToken,
            bidCount: 0
        });

        emit AuctionCreated(tokenId, msg.sender, startingPrice, block.timestamp + duration);

        return true;
    }

    /**
     * @dev Place a bid on an auction
     */
    function placeBid(uint256 tokenId, uint256 bidAmount) external payable nonReentrant auctionExists(tokenId) auctionActive(tokenId) {
        Auction storage auction = auctions[tokenId];
        require(bidAmount > auction.currentBid, "Bid too low");
        require(bidAmount >= auction.startingPrice, "Bid below starting price");

        // Handle payment
        if (auction.paymentToken == address(0)) {
            // ETH payment - require payment
            require(msg.value >= bidAmount, "Insufficient ETH sent");

            // Refund previous bidder
            if (auction.currentBidder != address(0)) {
                payable(auction.currentBidder).transfer(auction.currentBid);
            }
        } else {
            // ERC20 payment
            IERC20(auction.paymentToken).transferFrom(msg.sender, address(this), bidAmount);

            // Refund previous bidder
            if (auction.currentBidder != address(0)) {
                IERC20(auction.paymentToken).transfer(auction.currentBidder, auction.currentBid);
            }
        }

        // Update auction
        auction.currentBid = bidAmount;
        auction.currentBidder = msg.sender;
        auction.bidCount++;

        // Record bid
        auctionBids[tokenId][msg.sender] = bidAmount;

        emit AuctionBid(tokenId, msg.sender, bidAmount);
    }

    /**
     * @dev End an auction
     */
    function endAuction(uint256 tokenId) external nonReentrant auctionExists(tokenId) {
        Auction storage auction = auctions[tokenId];
        require(block.timestamp >= auction.endTime, "Auction not ended");
        require(auction.active, "Auction already ended");

        auction.active = false;

        if (auction.currentBid >= auction.reservePrice && auction.currentBidder != address(0)) {
            // Successful auction
            uint256 finalPrice = auction.currentBid;

            // Calculate platform fee
            uint256 fee = (finalPrice * platformFee) / 10000;
            uint256 sellerProceeds = finalPrice - fee;

            // Transfer fee and proceeds
            if (auction.paymentToken == address(0)) {
                payable(feeRecipient).transfer(fee);
                payable(auction.seller).transfer(sellerProceeds);
            } else {
                IERC20(auction.paymentToken).transfer(feeRecipient, fee);
                IERC20(auction.paymentToken).transfer(auction.seller, sellerProceeds);
            }

            // Transfer token
            carbonCreditToken.transferCredit(tokenId, auction.currentBidder);

            // Record trade
            tradeCounter++;
            trades[tradeCounter] = Trade({
                listingId: 0, // No listing for auctions
                tokenId: tokenId,
                buyer: auction.currentBidder,
                seller: auction.seller,
                price: finalPrice,
                amount: carbonCreditToken.getCreditDetails(tokenId).amount,
                timestamp: block.timestamp,
                paymentToken: auction.paymentToken,
                tradeType: "auction"
            });

            userTrades[auction.currentBidder].push(tradeCounter);
            userTrades[auction.seller].push(tradeCounter);

            emit AuctionEnded(tokenId, auction.currentBidder, finalPrice);
            emit TradeExecuted(tradeCounter, tokenId, auction.currentBidder, auction.seller, finalPrice);

        } else {
            // Failed auction - refund bidder
            if (auction.currentBidder != address(0)) {
                if (auction.paymentToken == address(0)) {
                    payable(auction.currentBidder).transfer(auction.currentBid);
                } else {
                    IERC20(auction.paymentToken).transfer(auction.currentBidder, auction.currentBid);
                }
            }

            emit AuctionEnded(tokenId, address(0), 0);
        }
    }

    /**
     * @dev Get active listings
     */
    function getActiveListings() external view returns (uint256[] memory) {
        uint256[] memory activeListings = new uint256[](listingCounter);
        uint256 count = 0;

        for (uint256 i = 1; i <= listingCounter; i++) {
            if (listings[i].active && block.timestamp <= listings[i].expiresAt) {
                activeListings[count] = i;
                count++;
            }
        }

        // Resize array
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = activeListings[i];
        }

        return result;
    }

    /**
     * @dev Get active auctions
     */
    function getActiveAuctions() external view returns (uint256[] memory) {
        uint256[] memory activeAuctions = new uint256[](listingCounter); // Rough estimate
        uint256 count = 0;

        for (uint256 i = 1; i <= listingCounter; i++) {
            if (auctions[i].active && block.timestamp < auctions[i].endTime) {
                activeAuctions[count] = i;
                count++;
            }
        }

        // Resize array
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = activeAuctions[i];
        }

        return result;
    }

    /**
     * @dev Add supported payment token
     */
    function addPaymentToken(address token) external onlyOwner {
        supportedPaymentTokens[token] = true;
        emit PaymentTokenAdded(token);
    }

    /**
     * @dev Remove supported payment token
     */
    function removePaymentToken(address token) external onlyOwner {
        require(token != address(0), "Cannot remove ETH");
        supportedPaymentTokens[token] = false;
        emit PaymentTokenRemoved(token);
    }

    /**
     * @dev Update platform fee
     */
    function updatePlatformFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee too high"); // Max 10%
        platformFee = newFee;
    }

    /**
     * @dev Update fee recipient
     */
    function updateFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid recipient");
        feeRecipient = newRecipient;
    }

    /**
     * @dev Get user's listings
     */
    function getUserListings(address user) external view returns (uint256[] memory) {
        return userListings[user];
    }

    /**
     * @dev Get user's trades
     */
    function getUserTrades(address user) external view returns (uint256[] memory) {
        return userTrades[user];
    }

    /**
     * @dev Get trade details
     */
    function getTradeDetails(uint256 tradeId) external view returns (Trade memory) {
        require(tradeId > 0 && tradeId <= tradeCounter, "Invalid trade ID");
        return trades[tradeId];
    }

    // Fallback function to receive ETH
    receive() external payable {}
}