// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import "./ticket.sol";
import "./affiliates.sol";

contract Booth is IERC165, IERC1155Receiver {
    Affiliates public affiliateContract;

    // Mapping to store the registered objects and their ticket contracts
    mapping(uint256 => Ticket) public objectToTicket;

    constructor(Affiliates _affiliateContract) {
        affiliateContract = _affiliateContract;
    }

    // Register a new object and its corresponding ticket contract
    function registerObject(uint256 _objectId, Ticket ticketContract) external {
        // Only allow registering an object once
        require(address(objectToTicket[_objectId]) == address(0), "Object already registered");
        objectToTicket[_objectId] = ticketContract;
    }

    // Verify owner of the ticket
    function hasAccess(uint256 _objectId, address _usr) public view returns (bool) {
        Ticket ticketContract = objectToTicket[_objectId];
        require(address(ticketContract) != address(0), "Invalid object");
        return ticketContract.hasAccess(_objectId, _usr);
    }

    // Function to mint ticket NFT
    function buy(uint256 _objectId, uint256 nftId, uint256 qty, address guy) public payable {
        Ticket ticketContract = objectToTicket[_objectId];
        require(address(ticketContract) != address(0), "Invalid object");
        // Buy the NFT from the ticket contract
        ticketContract.buy{value: msg.value}(_objectId, nftId, qty, guy);
    }

    // Function to mint ticket NFT and pay affiliate commissions
    function affiliateBuy(uint256 _objectId, uint256 nftId, uint256 qty, address guy,address affiliate) public payable {
        Ticket ticketContract = objectToTicket[_objectId];
        require(address(ticketContract) != address(0), "Invalid object");
        
        uint256 purchasePrice = ticketContract.price() * qty;
        uint256 commission = purchasePrice * affiliateContract.referralRewardBasisPoints() / 10000; // Calculate the commission
        uint256 payment = purchasePrice - commission; // Calculate the actual payment after deducting commission

        // Call the Affiliate contract to handle the referral reward
        affiliateContract.handleAffiliateProgram{value: commission}(guy, affiliate, purchasePrice);

        // Buy the NFT from the ticket contract at the discounted price
        ticketContract.discountBuy{value: payment}(_objectId, nftId, qty, guy);
    }

    // Function to mint ticket NFT at discount price
    function discountBuy(uint256 _objectId, uint256 nftId, uint256 qty, address guy) public payable {
        Ticket ticketContract = objectToTicket[_objectId];
        require(address(ticketContract) != address(0), "Invalid object");
        // Buy the NFT from the ticket contract
        ticketContract.discountBuy{value: msg.value}(_objectId, nftId, qty, guy);
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

    function supportsInterface(bytes4 interfaceId) public view virtual override(IERC165) returns (bool) {
        return
            interfaceId == type(IERC1155Receiver).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }
}