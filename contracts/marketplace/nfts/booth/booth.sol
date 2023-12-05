// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "../tickets/ticket.sol";
import "../affiliates/affiliates.sol";

import "hardhat/console.sol";

/// @custom:security-contact security@boomslag.com
contract Booth is IERC165, IERC1155Receiver, AccessControl {
    /* /////////////////////////////////
      1. Contract and Role Declarations 
      - Define a constant role for the booth role
      - Define a constant role for the buyer role
    */ /////////////////////////////////
    bytes32 public constant BOOTH_ROLE = keccak256("BOOTH_ROLE");
    bytes32 public constant BUYER_ROLE = keccak256("BUYER_ROLE");
    
    /* /////////////////////////////
      2. Structs and State Variables
    */ /////////////////////////////
    struct Purchase {
        uint256 tokenId;
        uint256 nftId;
        uint256 qty;
        uint256 price;
        uint256 timestamp;
    }
    // Define affiliate contract address
    Affiliates public affiliateContract;
    // Mapping to store the registered objects and their ticket contracts
    mapping(uint256 => Ticket) public objectToTicket;
    // Mapping to store course tokenId and affiliate's address
    mapping(uint256 => mapping(address => bool)) public ticketAffiliates;
    // Mapping to store purchase data for each ticket ID
    mapping(uint256 => Purchase[]) public ticketPurchases;
    // Mapping to store purchase data for each ticket ID and buyer
    mapping(uint256 => mapping(address => Purchase)) public ticketBuyers;
    // Count of refunds requested by each user
    mapping(address => uint256) public refundCounts; 
    // Affiliates commission rate
    uint256 public commissionPercent; // 25 for example would be 25%

    // TODO: Add Refunds

    /* /////////////////////////////
      3. Constructor and events
      The constructor initializes the contract's state.
      In this case it depends on the 'affiliates' contract 
      and the 'commission' for the platform. 
      Commission is set in basis points. 
      e.g: 500 is 5% represented in basis points (100 basis points = 1%)
    */ /////////////////////////////

    constructor(
        Affiliates _affiliateContract, // ERC20 Address of Deployed Affiliate Contract
        uint256 _commissionPercent // Percent for Commission
    ) 
    {
        affiliateContract = _affiliateContract;
        commissionPercent = _commissionPercent;
        // The deployer of this contract will be declared as admin and given the booth role.
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BOOTH_ROLE, msg.sender);
    }

    event CommissionSet(uint256 newCommissionPercent);
    event ObjectRegistered(uint256 tokenId, address ticketContract);
    event BuyerAuthorized(address guy);
    event AffiliateJoined(uint256 tokenId, address affiliate, address referrer);
    event PurchaseMade(uint256 tokenId, uint256 nftId, uint256 qty, address guy, uint256 price, string uri, uint256 timestamp);
    event NftGifted(uint256 tokenId, uint256 nftId, uint256 qty, address guy);

    /* /////////////////////////////
      4. Role-Based Functionality
      Group functions by the roles that can call them. 
      For example, all functions that require BOOTH_ROLE should be together.
    */ /////////////////////////////

    // Set affiliate commissions
    function setCommissionPercent(uint256 newCommissionPercent) public onlyRole(BOOTH_ROLE) {
        require(newCommissionPercent >= 0 && newCommissionPercent <= 100, "Invalid commission percentage");
        commissionPercent = newCommissionPercent;
        emit CommissionSet(newCommissionPercent);
    }
    // Register a new object and its corresponding ticket contract
    function registerObject(uint256 _tokenId, Ticket ticketContract) external onlyRole(BOOTH_ROLE) {
        // Only allow registering an object once
        require(address(objectToTicket[_tokenId]) == address(0), "Object already registered");
        objectToTicket[_tokenId] = ticketContract;
        emit ObjectRegistered(_tokenId, address(ticketContract));
    }
    // Grant Buyer Role
    function authorizeBuyer(address _guy) public onlyRole(BOOTH_ROLE) {
        _grantRole(BUYER_ROLE, _guy);
        emit BuyerAuthorized(_guy);
    }

    /* /////////////////////////////
      5. Affiliate Management
      Functions related to affiliate management come next.
    */ /////////////////////////////
    
    // Join affiliate program and also mint the NFT
    function joinAffiliateProgram(uint256 _tokenId, address referrer) external {
        require(!ticketAffiliates[_tokenId][msg.sender], "Already an affiliate for this NFT");
        require(address(objectToTicket[_tokenId]) != address(0), "Invalid object");

        // Store the course tokenId and affiliate's address
        ticketAffiliates[_tokenId][msg.sender] = true;
        affiliateContract.setReferrer(msg.sender, referrer);
        emit AffiliateJoined(_tokenId, msg.sender, referrer);
    }
    // Mint ticket NFT and pay affiliate commissions
    function affiliateBuy(uint256 _tokenId, uint256 nftId, uint256 qty, address guy) public payable onlyRole(BUYER_ROLE)  {
        Ticket ticketContract = objectToTicket[_tokenId];
        require(address(ticketContract) != address(0), "Invalid object");
        uint256 commission = commissionPercent * msg.value / 100; // Calculate the commission
        uint256 remainingRewards = msg.value - commission; // Calculate the remaining rewards
        // Call the Affiliate contract to handle the referral reward
        affiliateContract.handleAffiliateProgram{value: commission}(guy, commission);
        // Buy the NFT from the ticket contract using the remaining rewards
        ticketContract.mint{value: remainingRewards}(_tokenId, nftId, qty, guy);
        setPurchaseTime(_tokenId, nftId, qty, remainingRewards, block.timestamp);
    }
    function joinAffiliateProgramAndBuy(uint256 _tokenId, uint256 nftId, uint256 qty, address referrer) public payable {
        require(!ticketAffiliates[_tokenId][msg.sender], "Already an affiliate for this NFT");
        // Call the affiliateBuy function to handle the purchase and commission payment
        affiliateBuy(_tokenId, nftId, qty, msg.sender);
        // Add the buyer as an affiliate for this course
        ticketAffiliates[_tokenId][msg.sender] = true;
        // Add the buyer as a referrer under the existing affiliate
        affiliateContract.setReferrer(msg.sender, referrer);
    }
    // Verify if a user is an affiliate for a course
    function verifyAffiliate(uint256 _tokenId, address affiliate) external view returns (bool) {
        return ticketAffiliates[_tokenId][affiliate];
    }

    /* /////////////////////////////
      6. Purchase and Minting
      Group together all functions related to purchasing and minting.
    */ /////////////////////////////

    // Mint ticket NFT
    function buy(uint256 _tokenId, uint256 _nftId, uint256 _qty, address _guy) public payable onlyRole(BUYER_ROLE) isRegistered(_tokenId) {
        Ticket ticketContract = objectToTicket[_tokenId];
        // Ensure the Booth contract has BOOTH_ROLE in the Ticket contract
        require(ticketContract.hasRole(ticketContract.BOOTH_ROLE(), address(this)), "Booth not authorized");
        // Buy the NFT from the ticket contract
        ticketContract.mint{value: msg.value}(_tokenId, _nftId, _qty, _guy);
        // Emit pruchase event
        setPurchaseTime(_tokenId, _nftId, _qty, msg.value, block.timestamp);
        // Revoke BUYER_ROLE after purchase
        _revokeRole(BUYER_ROLE, _guy);
    }
    // Save transaction details
    function setPurchaseTime(uint256 _ticketId, uint256 _nftId, uint256 _qty, uint256 _wad, uint256 purchaseTimestamp) public {
        Ticket ticketContract = objectToTicket[_ticketId];
        require(address(ticketContract) != address(0), "Invalid object");

        // Store the purchase data in both mappings
        Purchase memory purchase = Purchase({
            tokenId: _ticketId,
            nftId: _nftId,
            qty: _qty,
            price: _wad,
            timestamp: purchaseTimestamp
        });
        ticketPurchases[_ticketId].push(purchase);
        ticketBuyers[_ticketId][msg.sender] = purchase; // Store for the individual buyer

        string memory nftUri = ticketContract.uri(_nftId);

        emit PurchaseMade(_ticketId, _nftId, _qty, msg.sender, _wad, nftUri, purchaseTimestamp);
    }
    // With great power comes great responsibility!
    function removePurchase(uint256 _ticketId, uint256 _index) internal onlyRole(BOOTH_ROLE) {
        Purchase[] storage purchases = ticketPurchases[_ticketId];
        require(_index < purchases.length, "Invalid index");

        // If it's not the last element, swap it with the last one
        if (_index < purchases.length - 1) {
            purchases[_index] = purchases[purchases.length - 1];
        }

        // Decrease the length of the array
        purchases.pop();
    }
    // Gift ticket NFT
    function gift(uint256 _tokenId, uint256 _nftId, uint256 _qty, address _guy) public payable onlyRole(BOOTH_ROLE) isRegistered(_tokenId) {
        require(_guy != address(0), "Invalid recipient address");

        // Mint the NFT to the recipient
        Ticket ticketContract = objectToTicket[_tokenId];
        ticketContract.gift(_tokenId, _nftId, _qty, _guy);

        // Emit an event for the gift
        emit NftGifted(_tokenId, _nftId, _qty, _guy);
    }

    /* /////////////////////////////
      7. Utility Functions
      Include utility functions like isObjectRegistered.
    */ /////////////////////////////

    // Verify owner of the ticket
    // Check if an object is registered
    function isObjectRegistered(uint256 _tokenId) external view returns (bool) {
        return address(objectToTicket[_tokenId]) != address(0);
    }

    modifier isRegistered(uint256 _tokenId) {
        require(address(objectToTicket[_tokenId]) != address(0), "Object is not registered");
        _;
    }

    /* /////////////////////////////
      8. ERC1155 and Interface Implementations
      Place the ERC1155 token reception and interface support functions at the end.
    */ /////////////////////////////

    // Interface to allow receiving ERC1155 tokens.
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC1155Received.selector;
    }
    // Interface to allow receiving batch ERC1155 tokens.
    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(IERC165, AccessControl) returns (bool) {
        return
            interfaceId == type(IERC1155Receiver).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }

}

