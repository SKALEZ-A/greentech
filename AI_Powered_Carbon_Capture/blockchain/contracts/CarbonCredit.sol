// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title CarbonCredit
 * @dev ERC721 token representing verified carbon credits
 * Each token represents a specific amount of CO2 captured and stored
 */
contract CarbonCredit is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;

    // Token data structure
    struct CreditData {
        uint256 serialNumber;
        uint256 vintage;           // Year of capture
        uint256 amount;            // Amount in tons CO2
        string unit;               // "tCO2" or "tCO2e"
        string projectId;
        string projectName;
        string methodology;
        address issuer;
        address currentOwner;
        uint256 issueDate;
        string status;             // "active", "retired", "transferred"
        string retirementReason;   // Reason for retirement if retired
        address beneficiary;       // Beneficiary if retired
        uint256 retirementDate;
        VerificationData verification;
        string ipfsMetadataHash;   // IPFS hash of detailed metadata
    }

    // Verification data structure
    struct VerificationData {
        address verifier;
        string verificationMethod; // "satellite", "ground_sensor", "third_party", "ai_prediction"
        uint256 verificationDate;
        uint256 confidenceScore;   // 0-100
        string[] evidence;         // IPFS hashes of evidence
        string methodology;        // "direct_measurement", "model_prediction", "hybrid"
    }

    // Transaction record
    struct TransactionRecord {
        uint256 tokenId;
        address from;
        address to;
        uint256 amount;
        string transactionType;    // "mint", "transfer", "burn", "retirement"
        uint256 timestamp;
        string blockchainTxHash;
        uint256 blockNumber;
    }

    // State variables
    mapping(uint256 => CreditData) public creditData;
    mapping(uint256 => TransactionRecord[]) public transactionHistory;
    mapping(address => bool) public authorizedIssuers;
    mapping(address => bool) public authorizedVerifiers;
    mapping(string => bool) public usedSerialNumbers;

    // Registry of retired credits for compliance
    mapping(uint256 => bool) public retiredCredits;
    mapping(address => uint256[]) public creditsByOwner;
    mapping(string => uint256[]) public creditsByProject;

    // Events
    event CreditMinted(uint256 indexed tokenId, address indexed issuer, uint256 amount, string projectId);
    event CreditTransferred(uint256 indexed tokenId, address indexed from, address indexed to, uint256 amount);
    event CreditRetired(uint256 indexed tokenId, address indexed owner, uint256 amount, string reason);
    event CreditVerified(uint256 indexed tokenId, address indexed verifier, uint256 confidenceScore);
    event IssuerAuthorized(address indexed issuer);
    event VerifierAuthorized(address indexed verifier);

    // Modifiers
    modifier onlyAuthorizedIssuer() {
        require(authorizedIssuers[msg.sender] || msg.sender == owner(), "Not authorized to issue credits");
        _;
    }

    modifier onlyAuthorizedVerifier() {
        require(authorizedVerifiers[msg.sender] || msg.sender == owner(), "Not authorized to verify credits");
        _;
    }

    modifier creditExists(uint256 tokenId) {
        require(_exists(tokenId), "Credit does not exist");
        _;
    }

    modifier creditActive(uint256 tokenId) {
        require(keccak256(bytes(creditData[tokenId].status)) == keccak256(bytes("active")), "Credit not active");
        _;
    }

    /**
     * @dev Constructor
     */
    constructor() ERC721("CarbonCredit", "CCREDIT") {
        // Authorize contract owner as issuer and verifier
        authorizedIssuers[owner()] = true;
        authorizedVerifiers[owner()] = true;
    }

    /**
     * @dev Mint a new carbon credit token
     */
    function mintCredit(
        address to,
        uint256 serialNumber,
        uint256 vintage,
        uint256 amount,
        string memory unit,
        string memory projectId,
        string memory projectName,
        string memory methodology,
        string memory ipfsMetadataHash
    ) public onlyAuthorizedIssuer returns (uint256) {
        require(!usedSerialNumbers[_uint256ToString(serialNumber)], "Serial number already used");
        require(amount > 0, "Amount must be greater than 0");
        require(vintage >= 2000 && vintage <= 2100, "Invalid vintage year");
        require(bytes(projectId).length > 0, "Project ID required");
        require(bytes(projectName).length > 0, "Project name required");

        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();

        // Mark serial number as used
        usedSerialNumbers[_uint256ToString(serialNumber)] = true;

        // Create credit data
        creditData[tokenId] = CreditData({
            serialNumber: serialNumber,
            vintage: vintage,
            amount: amount,
            unit: unit,
            projectId: projectId,
            projectName: projectName,
            methodology: methodology,
            issuer: msg.sender,
            currentOwner: to,
            issueDate: block.timestamp,
            status: "active",
            retirementReason: "",
            beneficiary: address(0),
            retirementDate: 0,
            verification: VerificationData({
                verifier: address(0),
                verificationMethod: "",
                verificationDate: 0,
                confidenceScore: 0,
                evidence: new string[](0),
                methodology: ""
            }),
            ipfsMetadataHash: ipfsMetadataHash
        });

        // Mint token
        _safeMint(to, tokenId);

        // Add to owner's credits
        creditsByOwner[to].push(tokenId);
        creditsByProject[projectId].push(tokenId);

        // Record transaction
        _recordTransaction(tokenId, address(0), to, amount, "mint", "");

        emit CreditMinted(tokenId, msg.sender, amount, projectId);

        return tokenId;
    }

    /**
     * @dev Transfer carbon credit ownership
     */
    function transferCredit(uint256 tokenId, address to) public creditExists(tokenId) creditActive(tokenId) {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(to != address(0), "Cannot transfer to zero address");

        address from = msg.sender;
        uint256 amount = creditData[tokenId].amount;

        // Update ownership
        creditData[tokenId].currentOwner = to;

        // Update mappings
        _removeFromOwnerCredits(from, tokenId);
        creditsByOwner[to].push(tokenId);

        // Transfer token
        _transfer(from, to, tokenId);

        // Record transaction
        _recordTransaction(tokenId, from, to, amount, "transfer", "");

        emit CreditTransferred(tokenId, from, to, amount);
    }

    /**
     * @dev Retire carbon credit (burn it for compliance)
     */
    function retireCredit(uint256 tokenId, string memory reason, address beneficiary) public creditExists(tokenId) creditActive(tokenId) {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(bytes(reason).length > 0, "Retirement reason required");

        uint256 amount = creditData[tokenId].amount;

        // Update credit status
        creditData[tokenId].status = "retired";
        creditData[tokenId].retirementReason = reason;
        creditData[tokenId].beneficiary = beneficiary;
        creditData[tokenId].retirementDate = block.timestamp;

        // Mark as retired
        retiredCredits[tokenId] = true;

        // Remove from owner's active credits
        _removeFromOwnerCredits(msg.sender, tokenId);

        // Burn token
        _burn(tokenId);

        // Record transaction
        _recordTransaction(tokenId, msg.sender, address(0), amount, "retirement", reason);

        emit CreditRetired(tokenId, msg.sender, amount, reason);
    }

    /**
     * @dev Verify carbon credit
     */
    function verifyCredit(
        uint256 tokenId,
        string memory verificationMethod,
        uint256 confidenceScore,
        string[] memory evidence,
        string memory methodology
    ) public onlyAuthorizedVerifier creditExists(tokenId) {
        require(confidenceScore >= 0 && confidenceScore <= 100, "Invalid confidence score");
        require(bytes(verificationMethod).length > 0, "Verification method required");

        creditData[tokenId].verification = VerificationData({
            verifier: msg.sender,
            verificationMethod: verificationMethod,
            verificationDate: block.timestamp,
            confidenceScore: confidenceScore,
            evidence: evidence,
            methodology: methodology
        });

        emit CreditVerified(tokenId, msg.sender, confidenceScore);
    }

    /**
     * @dev Get credit details
     */
    function getCreditDetails(uint256 tokenId) public view creditExists(tokenId) returns (CreditData memory) {
        return creditData[tokenId];
    }

    /**
     * @dev Get transaction history for a credit
     */
    function getTransactionHistory(uint256 tokenId) public view creditExists(tokenId) returns (TransactionRecord[] memory) {
        return transactionHistory[tokenId];
    }

    /**
     * @dev Get credits owned by an address
     */
    function getCreditsByOwner(address owner) public view returns (uint256[] memory) {
        return creditsByOwner[owner];
    }

    /**
     * @dev Get credits for a project
     */
    function getCreditsByProject(string memory projectId) public view returns (uint256[] memory) {
        return creditsByProject[projectId];
    }

    /**
     * @dev Get total retired credits
     */
    function getTotalRetiredCredits() public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 1; i <= _tokenIdCounter.current(); i++) {
            if (retiredCredits[i]) {
                total += creditData[i].amount;
            }
        }
        return total;
    }

    /**
     * @dev Get total active credits
     */
    function getTotalActiveCredits() public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 1; i <= _tokenIdCounter.current(); i++) {
            if (_exists(i) && keccak256(bytes(creditData[i].status)) == keccak256(bytes("active"))) {
                total += creditData[i].amount;
            }
        }
        return total;
    }

    /**
     * @dev Authorize an issuer
     */
    function authorizeIssuer(address issuer) public onlyOwner {
        authorizedIssuers[issuer] = true;
        emit IssuerAuthorized(issuer);
    }

    /**
     * @dev Remove issuer authorization
     */
    function revokeIssuer(address issuer) public onlyOwner {
        authorizedIssuers[issuer] = false;
    }

    /**
     * @dev Authorize a verifier
     */
    function authorizeVerifier(address verifier) public onlyOwner {
        authorizedVerifiers[verifier] = true;
        emit VerifierAuthorized(verifier);
    }

    /**
     * @dev Remove verifier authorization
     */
    function revokeVerifier(address verifier) public onlyOwner {
        authorizedVerifiers[verifier] = false;
    }

    // Internal functions
    function _recordTransaction(
        uint256 tokenId,
        address from,
        address to,
        uint256 amount,
        string memory transactionType,
        string memory metadata
    ) internal {
        TransactionRecord memory record = TransactionRecord({
            tokenId: tokenId,
            from: from,
            to: to,
            amount: amount,
            transactionType: transactionType,
            timestamp: block.timestamp,
            blockchainTxHash: _bytes32ToString(blockhash(block.number - 1)),
            blockNumber: block.number
        });

        transactionHistory[tokenId].push(record);
    }

    function _removeFromOwnerCredits(address owner, uint256 tokenId) internal {
        uint256[] storage ownerCredits = creditsByOwner[owner];
        for (uint256 i = 0; i < ownerCredits.length; i++) {
            if (ownerCredits[i] == tokenId) {
                ownerCredits[i] = ownerCredits[ownerCredits.length - 1];
                ownerCredits.pop();
                break;
            }
        }
    }

    function _uint256ToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function _bytes32ToString(bytes32 value) internal pure returns (string memory) {
        bytes memory bytesArray = new bytes(64);
        for (uint256 i = 0; i < 32; i++) {
            bytes1 b = bytes1(uint8(uint256(value) / (2**(8*(31 - i)))));
            bytes1 hi = bytes1(uint8(b) / 16);
            bytes1 lo = bytes1(uint8(b) - 16 * uint8(hi));
            bytesArray[2*i] = _char(hi);
            bytesArray[2*i+1] = _char(lo);
        }
        return string(bytesArray);
    }

    function _char(bytes1 b) internal pure returns (bytes1) {
        if (uint8(b) < 10) return bytes1(uint8(b) + 0x30);
        else return bytes1(uint8(b) + 0x57);
    }

    // Override functions
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}