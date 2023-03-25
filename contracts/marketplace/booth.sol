// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "./ticket.sol";
import "./affiliates.sol";

contract Booth is IERC165, IERC1155Receiver, AccessControl {
    bytes32 public constant BOOTH_ROLE = keccak256("BOOTH_ROLE");
    bytes32 public constant BUYER_ROLE = keccak256("BUYER_ROLE");

    Affiliates public affiliateContract;
    // Mapping to store the registered objects and their ticket contracts
    mapping(uint256 => Ticket) public objectToTicket;
    // Add this mapping to store course tokenId and affiliate's address
    mapping(uint256 => mapping(address => bool)) public ticketAffiliates;
    
    struct Purchase {
        uint256 objectId;
        uint256 nftId;
        uint256 qty;
        uint256 price;
        uint256 timestamp;
    }
    // Mapping to store purchase data for each ticket ID
    mapping(uint256 => Purchase[]) public ticketPurchases;
    // Mapping to store purchase data for each ticket ID and buyer
    mapping(uint256 => mapping(address => Purchase)) public ticketBuyers;
    // Count of refunds requested by each user
    mapping(address => uint256) public refundCounts; 
    // Period within which refunds can be requested
    uint256 public constant REFUND_PERIOD = 1 days; 
    // Maximum number of refunds allowed per user
    uint256 public constant REFUND_LIMIT = 3; 

    constructor(
        Affiliates _affiliateContract
    ) 
    {
        affiliateContract = _affiliateContract;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BOOTH_ROLE, msg.sender);
    }

    // Register a new object and its corresponding ticket contract
    function registerObject(uint256 _objectId, Ticket ticketContract) external onlyRole(BOOTH_ROLE) {
        // Only allow registering an object once
        require(address(objectToTicket[_objectId]) == address(0), "Object already registered");
        objectToTicket[_objectId] = ticketContract;
    }

    function setBuyer(address buyer) public onlyRole(BOOTH_ROLE) {
        _grantRole(BUYER_ROLE, buyer);
    }

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
        require(address(objectToTicket[_objectId]) != address(0), "Invalid object");

        // Store the course tokenId and affiliate's address
        ticketAffiliates[_objectId][msg.sender] = true;
        affiliateContract.setReferrer(msg.sender, referrer);
    }

    function verifyAffiliate(uint256 _objectId, address affiliate) external view returns (bool) {
        return ticketAffiliates[_objectId][affiliate];
    }

    // Verify owner of the ticket
    function hasAccess(uint256 _objectId, address _usr) public view  returns (bool) {
        Ticket ticketContract = objectToTicket[_objectId];
        require(address(ticketContract) != address(0), "Invalid object");
        return ticketContract.hasAccess(_objectId, _usr);
    }

    // Function to mint ticket NFT
    function buy(uint256 _objectId, uint256 nftId, uint256 qty, address guy) public payable onlyRole(BUYER_ROLE) {
        Ticket ticketContract = objectToTicket[_objectId];
        require(address(ticketContract) != address(0), "Invalid object");
        // Buy the NFT from the ticket contract
        ticketContract.mint{value: msg.value}(_objectId, nftId, qty, guy);
        setPurchaseTime(_objectId, nftId, qty, msg.value, block.timestamp);

        _revokeRole(BUYER_ROLE, msg.sender);
    }

    // Function to mint ticket NFT and pay affiliate commissions
    function affiliateBuy(uint256 _objectId, uint256 nftId, uint256 qty, address guy) public payable onlyRole(BUYER_ROLE)  {
        Ticket ticketContract = objectToTicket[_objectId];
        require(address(ticketContract) != address(0), "Invalid object");
        uint256 commission = msg.value * 25 / 100; // Calculate the commission (25% of msg.value)
        uint256 remainingRewards = msg.value - commission; // Calculate the remaining rewards (75% of msg.value)
        // Call the Affiliate contract to handle the referral reward
        affiliateContract.handleAffiliateProgram{value: commission}(guy, commission);
        // Buy the NFT from the ticket contract using the remaining rewards
        ticketContract.mint{value: remainingRewards}(_objectId, nftId, qty, guy);
        setPurchaseTime(_objectId, nftId, qty, remainingRewards, block.timestamp);
    }

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

    function findPurchaseIndex(uint256 ticketId, address buyer) internal view onlyRole(BOOTH_ROLE) returns (int256)  {
        Purchase memory purchase = ticketBuyers[ticketId][buyer];
        if (purchase.qty > 0 && hasAccess(ticketId, buyer)) {
            return int256(1);
        }
        return -1;
    }

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC1155Received.selector;
    }

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