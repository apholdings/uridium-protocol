// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "./ticket.sol";
import "./affiliates.sol";

/// @custom:security-contact security@boomslag.com
contract Booth is IERC165, IERC1155Receiver, AccessControl {
    // Define a constant role for the booth role
    bytes32 public constant BOOTH_ROLE = keccak256("BOOTH_ROLE");
    // Define a constant role for the buyer role
    bytes32 public constant BUYER_ROLE = keccak256("BUYER_ROLE");

    struct Purchase {
        uint256 objectId;
        uint256 nftId;
        uint256 qty;
        uint256 price;
        uint256 timestamp;
    }

    // Define affiliate contract address
    Affiliates public affiliateContract;
    // Mapping to store the registered objects and their ticket contracts
    mapping(uint256 => Ticket) public objectToTicket;
    // Add this mapping to store course tokenId and affiliate's address
    mapping(uint256 => mapping(address => bool)) public ticketAffiliates;
    // Mapping to store purchase data for each ticket ID
    mapping(uint256 => Purchase[]) public ticketPurchases;
    // Mapping to store purchase data for each ticket ID and buyer
    mapping(uint256 => mapping(address => Purchase)) public ticketBuyers;
    // Count of refunds requested by each user
    mapping(address => uint256) public refundCounts; 
    // Period within which refunds can be requested
    uint256 public REFUND_PERIOD = 1 days; 
    // Affiliates commission rate
    uint256 public commissionPercent; // 25 for example would be 25%
    // Maximum number of refunds allowed per user
    uint256 public REFUND_LIMIT = 3; 

    constructor(
        Affiliates _affiliateContract,
        uint256 _commissionPercent
    ) 
    {
        affiliateContract = _affiliateContract;
        commissionPercent = _commissionPercent;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BOOTH_ROLE, msg.sender);
    }

    // Funciton to set affiliate commissions
    function setCommissionPercent(uint256 newCommissionPercent) public onlyRole(BOOTH_ROLE) {
        require(newCommissionPercent >= 0 && newCommissionPercent <= 100, "Invalid commission percentage");
        commissionPercent = newCommissionPercent;
    }
    // Register a new object and its corresponding ticket contract
    function registerObject(uint256 _objectId, Ticket ticketContract) external onlyRole(BOOTH_ROLE) {
        // Only allow registering an object once
        require(address(objectToTicket[_objectId]) == address(0), "Object already registered");
        objectToTicket[_objectId] = ticketContract;
    }
    // Check if an object is registered
    function isObjectRegistered(uint256 _objectId) external view returns (bool) {
        return address(objectToTicket[_objectId]) != address(0);
    }
    // Verify owner of the ticket
    function hasAccess(uint256 _objectId, address _usr) public view  returns (bool) {
        Ticket ticketContract = objectToTicket[_objectId];
        require(address(ticketContract) != address(0), "Invalid object");
        return ticketContract.hasAccess(_objectId, _usr);
    }
    // Function to join affiliate program and also mint the NFT
    function joinAffiliateProgramAndBuy(uint256 _objectId, uint256 nftId, uint256 qty, address referrer) public payable {
        require(!ticketAffiliates[_objectId][msg.sender], "Already an affiliate for this NFT");
        // Call the affiliateBuy function to handle the purchase and commission payment
        affiliateBuy(_objectId, nftId, qty, msg.sender);
        // Add the buyer as an affiliate for this course
        ticketAffiliates[_objectId][msg.sender] = true;
        // Add the buyer as a referrer under the existing affiliate
        affiliateContract.setReferrer(msg.sender, referrer);
    }
    // Add this function to allow new affiliates to join the program for a specific course
    function joinAffiliateProgram(uint256 _objectId, address referrer) external {
        require(!ticketAffiliates[_objectId][msg.sender], "Already an affiliate for this NFT");
        require(address(objectToTicket[_objectId]) != address(0), "Invalid object");

        // Store the course tokenId and affiliate's address
        ticketAffiliates[_objectId][msg.sender] = true;
        affiliateContract.setReferrer(msg.sender, referrer);
    }
    // Verify if a user is an affiliate for a course
    function verifyAffiliate(uint256 _objectId, address affiliate) external view returns (bool) {
        return ticketAffiliates[_objectId][affiliate];
    }
    // Function to mint ticket NFT
    function buy(uint256 _objectId, uint256 nftId, uint256 qty, address guy) public payable onlyRole(BUYER_ROLE) {
        Ticket ticketContract = objectToTicket[_objectId];
        require(address(ticketContract) != address(0), "Invalid object");
        // Buy the NFT from the ticket contract
        ticketContract.mint{value: msg.value}(_objectId, nftId, qty, guy);
        setPurchaseTime(_objectId, nftId, qty, msg.value, block.timestamp);
    }
    // Function to mint ticket NFT and pay affiliate commissions
    function affiliateBuy(uint256 _objectId, uint256 nftId, uint256 qty, address guy) public payable onlyRole(BUYER_ROLE)  {
        Ticket ticketContract = objectToTicket[_objectId];
        require(address(ticketContract) != address(0), "Invalid object");
        uint256 commission = commissionPercent * msg.value / 100; // Calculate the commission
        uint256 remainingRewards = msg.value - commission; // Calculate the remaining rewards
        // Call the Affiliate contract to handle the referral reward
        affiliateContract.handleAffiliateProgram{value: commission}(guy, commission);
        // Buy the NFT from the ticket contract using the remaining rewards
        ticketContract.mint{value: remainingRewards}(_objectId, nftId, qty, guy);
        setPurchaseTime(_objectId, nftId, qty, remainingRewards, block.timestamp);
    }
    // Save transaction details
    function setPurchaseTime(uint256 ticketId, uint256 nftId, uint256 qty, uint256 wad, uint256 purchaseTimestamp) public {
        Ticket ticketContract = objectToTicket[ticketId];
        require(address(ticketContract) != address(0), "Invalid object");

        // Store the purchase data in the mapping
        Purchase memory purchase = Purchase({
            objectId: ticketId,
            nftId: nftId,
            qty: qty,
            price: wad,
            timestamp: purchaseTimestamp
        });
        ticketPurchases[ticketId].push(purchase);
    }
    // With great power comes great responsibility!
    function removePurchase(uint256 ticketId, uint256 index) internal onlyRole(BOOTH_ROLE) {
        Purchase[] storage purchases = ticketPurchases[ticketId];
        require(index < purchases.length, "Invalid index");

        // If it's not the last element, swap it with the last one
        if (index < purchases.length - 1) {
            purchases[index] = purchases[purchases.length - 1];
        }

        // Decrease the length of the array
        purchases.pop();
    }
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

