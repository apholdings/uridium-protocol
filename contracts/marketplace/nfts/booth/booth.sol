// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "../tickets/ticket.sol";
import "../affiliates/affiliates.sol";

import "./types.sol";

import "hardhat/console.sol";

/// @custom:security-contact security@boomslag.com
contract Booth is IERC165, IERC1155Receiver, AccessControl {
    /* 
    /////////////////////////////////
    1. Contract and Role Declarations 
    /////////////////////////////////

      - Define a constant role for the booth role
      - Define a constant role for the buyer role
    */ 

    bytes32 public constant BOOTH_ROLE = keccak256("BOOTH_ROLE");
    bytes32 public constant BUYER_ROLE = keccak256("BUYER_ROLE");
    
    /**
    /////////////////////////////
    2. Structs and State Variables
    /////////////////////////////

        @dev 
        Structs and state variables for the smart contract.

        - affiliateContract: Define affiliate contract address
        - ticketPurchases: Mapping to store purchase data for each ticket ID
        - ticketBuyers: Mapping to store purchase data for each ticket ID and buyer
        - refundCounts: Count of refunds requested by each user
        - commissionPercent: Affiliates commission rate (e.g., 25 for 25%)
        - ticketRegistry: Instance of the TicketRegistry contract
        - userPurchaseHistory: Mapping to store each user's purchase history
    */

    TicketRegistry private ticketRegistry;
    Affiliates public affiliateContract;
    mapping(address => BoothTypes.Purchase[]) private userPurchaseHistory;
    mapping(uint256 => BoothTypes.Purchase[]) public ticketPurchases;
    mapping(address => mapping(uint256 => uint256)) private userTokenPurchaseCount;
    mapping(uint256 => mapping(address => BoothTypes.Purchase)) public purchase;
    uint256 public commissionPercent;


    /* 
    /////////////////////////////
    3. Constructor and events
    /////////////////////////////

      The constructor initializes the contract's state.
      In this case it depends on the 'affiliates' contract 
      and the 'commission' for the platform. 
      Commission is set in basis points. 
      e.g: 500 is 5% represented in basis points (100 basis points = 1%)
    */ 

    constructor(
        Affiliates _affiliateContract, // ERC20 Address of Deployed Affiliate Contract
        uint256 _commissionPercent, // Percent for Commission
        address _ticketRegistryAddress
    ) 
    {
        affiliateContract = _affiliateContract;
        commissionPercent = _commissionPercent;
        ticketRegistry = TicketRegistry(_ticketRegistryAddress);
        // The deployer of this contract will be declared as admin and given the booth role.
        _grantRole(BOOTH_ROLE, msg.sender);
    }

    event CommissionSet(uint256 newCommissionPercent);
    event ObjectRegistered(uint256 tokenId, address ticketContract);
    event BuyerAuthorized(address guy);
    event BuyerRevoked(address guy);
    event AffiliateJoined(uint256 tokenId, address affiliate, address referrer);
    event PurchaseMade(uint256 tokenId, uint256 nftId, uint256 qty, address guy, uint256 price, string uri, uint256 timestamp);
    event NftGifted(uint256 tokenId, uint256 nftId, uint256 qty, address guy);

    /* 
    /////////////////////////////
    4. Role-Based Functionality       
    /////////////////////////////

      Group functions by the roles that can call them. 
      For example, all functions that require BOOTH_ROLE should be together.
    */ 

    /**
     * @notice Sets the new commission percentage for the platform.
     * @param newCommissionPercent The new commission percentage to be set.
     * @dev Only callable by users with BOOTH_ROLE. Validates that the new percentage is within a valid range.
     */
    function setCommissionPercent(uint256 newCommissionPercent) public onlyRole(BOOTH_ROLE) {
        require(newCommissionPercent >= 0 && newCommissionPercent <= 100, "Invalid commission percentage");
        commissionPercent = newCommissionPercent;
        emit CommissionSet(newCommissionPercent);
    }

    /**
     * @notice Grants the BUYER_ROLE to a specified address.
     * @param _guy The address to be granted the BUYER_ROLE.
     * @dev Only callable by users with BOOTH_ROLE. Emits BuyerAuthorized event on success.
     */
    function authorizeBuyer(address _guy) public onlyRole(BOOTH_ROLE) {
        _grantRole(BUYER_ROLE, _guy);
        emit BuyerAuthorized(_guy);
    }

    /**
     * @notice Revokes the BUYER_ROLE from a specified address.
     * @param _guy The address from which the BUYER_ROLE is to be revoked.
     * @dev Only callable by users with BOOTH_ROLE. Emits BuyerRevoked event on success.
     */
    function revokeBuyer(address _guy) public onlyRole(BOOTH_ROLE) {
        _revokeRole(BUYER_ROLE, _guy);
        emit BuyerRevoked(_guy);
    }

    /* 
    /////////////////////////////
    5. Purchase and Minting
    /////////////////////////////

      Group together all functions related to purchasing and minting.
    */ 

    /**
     * @notice Facilitates a purchase involving an affiliate, allocating a portion of the sale to the affiliate program.
     * @param _tokenId The ID of the token being purchased.
     * @param _nftId The ID of the NFT being purchased.
     * @param _qty The quantity of NFTs being purchased.
     * @param _guy The buyer's address.
     * @param affiliate The affiliate's address involved in the sale.
     * @dev Only callable by users with BUYER_ROLE. Calculates commission and updates purchase data accordingly.
     */
    function affiliateBuy(uint256 _tokenId, uint256 _nftId, uint256 _qty, address _guy, address affiliate) public payable onlyRole(BUYER_ROLE) isRegistered(_tokenId) {
        Ticket ticketContract = ticketRegistry.getRegisteredNFT(_tokenId);
        uint256 remainingAmount = handleRoyaltyPayment(_tokenId, _nftId, msg.value);
        uint256 commission = commissionPercent * remainingAmount / 100; // Calculate the commission
        uint256 amountAfterCommission = remainingAmount - commission; // Calculate the amount after commission
        ticketContract.mint{value: amountAfterCommission}(_tokenId, _nftId, _qty, _guy);
        affiliateContract.handleAffiliateProgram{value: commission}(_tokenId, _guy, affiliate);
        // Emit purchase event
        setPurchaseData(_tokenId, _nftId, _qty, amountAfterCommission, block.timestamp);
    }

    /**
     * @notice Facilitates a direct purchase of an NFT without involving affiliates.
     * @param _tokenId The ID of the token being purchased.
     * @param _nftId The ID of the NFT being purchased.
     * @param _qty The quantity of NFTs being purchased.
     * @param _guy The buyer's address.
     * @dev Only callable by users with BUYER_ROLE. Updates purchase data and ownership information.
     */
    function buy(uint256 _tokenId, uint256 _nftId, uint256 _qty, address _guy) public payable onlyRole(BUYER_ROLE) isRegistered(_tokenId) {
        Ticket ticketContract = ticketRegistry.getRegisteredNFT(_tokenId);
        uint256 remainingAmount = handleRoyaltyPayment(_tokenId, _nftId, msg.value);
        ticketContract.mint{value: remainingAmount}(_tokenId, _nftId, _qty, _guy);
        setPurchaseData(_tokenId, _nftId, _qty, remainingAmount, block.timestamp);
    }

    /**
     * @notice Handles royalty payment for NFT.
     * @param _tokenId The ID of the token being purchased.
     * @param _nftId The ID of the NFT being purchased.
     * @param _salePrice The amount of the sale.
     * @dev Internal function meant to be used inside the buy and affiliateBuy methods.
     */
    function handleRoyaltyPayment(uint256 _tokenId, uint256 _nftId, uint256 _salePrice) internal returns (uint256) {
        Ticket ticketContract = ticketRegistry.getRegisteredNFT(_tokenId);
        (address royaltyReceiver, uint256 royaltyAmount) = ticketContract.royaltyInfo(_nftId, _salePrice);

        if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
            require(_salePrice >= royaltyAmount, "Insufficient funds to pay royalties");
            payable(royaltyReceiver).transfer(royaltyAmount);
        }

        return _salePrice - royaltyAmount; // Return the remaining amount after deducting royalty
    }

    /**
     * @notice Stores purchase data in the contract's state.
     * @param _tokenId The ID of the token being purchased.
     * @param _nftId The ID of the NFT being purchased.
     * @param _qty The quantity of NFTs being purchased.
     * @param _wad The price of the purchase.
     * @param purchaseTimestamp The timestamp of the purchase.
     * @dev Only callable for registered tokens. Updates purchase history and individual purchase records.
     */
    function setPurchaseData(uint256 _tokenId, uint256 _nftId, uint256 _qty, uint256 _wad, uint256 purchaseTimestamp) public isRegistered(_tokenId) {
        Ticket ticketContract = ticketRegistry.getRegisteredNFT(_tokenId);

        // Store the purchase data in both mappings
        BoothTypes.Purchase memory newPurchase = BoothTypes.Purchase({
            tokenId: _tokenId,
            nftId: _nftId,
            qty: _qty,
            price: _wad,
            timestamp: purchaseTimestamp
        });
        ticketPurchases[_tokenId].push(newPurchase);
        userPurchaseHistory[msg.sender].push(newPurchase);
        purchase[_tokenId][msg.sender] = newPurchase;
        // Increment the user's purchase count for this tokenId
        userTokenPurchaseCount[msg.sender][_tokenId] += 1;

        string memory nftUri = ticketContract.uri(_nftId);

        emit PurchaseMade(_tokenId, _nftId, _qty, msg.sender, _wad, nftUri, purchaseTimestamp);
    }

    /* 
    /////////////////////////////
    6. Utility Functions
    /////////////////////////////

      Include utility functions like isObjectRegistered.
    */ 

    /**
     * @notice Retrieves the current commission percentage for the platform.
     * @return The current commission percentage.
     */
    function getCommissionPercent() public view returns (uint256) {
        return commissionPercent;
    }

    /**
     * @notice Returns the total number of purchases made by a specific user.
     * @param user The address of the user.
     * @return The total number of purchases made by the user.
     */
    function getTotalPurchasesForUser(address user) public view returns (uint256) {
        return userPurchaseHistory[user].length;
    }

    /**
     * @notice Returns the count of purchases made by a user for a specific token.
     * @param user The address of the user.
     * @param tokenId The ID of the token.
     * @return The count of purchases made by the user for the specified token.
     */
    function getUserPurchaseCountForToken(address user, uint256 tokenId) public view returns (uint256) {
        return userTokenPurchaseCount[user][tokenId];
    }

    /**
     * @notice Retrieves a specific purchase made by a user, identified by an index.
     * @param user The address of the user.
     * @param index The index of the purchase in the user's purchase history.
     * @return The purchase details at the specified index.
     * @dev Requires that the index is within the bounds of the user's purchase history.
     */
    function getPurchaseForUserAtIndex(address user, uint256 index) public view returns (BoothTypes.Purchase memory) {
        require(index < userPurchaseHistory[user].length, "Index out of bounds");

        return userPurchaseHistory[user][index];
    }

    /**
     * @notice Returns the total number of purchases made for a specific token.
     * @param tokenId The ID of the token.
     * @return The total number of purchases made for the specified token.
     */
    function getTotalPurchasesForToken(uint256 tokenId) public view returns (uint256) {
        return ticketPurchases[tokenId].length;
    }

    /**
     * @notice Retrieves a specific purchase for a token, identified by an index.
     * @param tokenId The ID of the token.
     * @param index The index of the purchase in the token's purchase history.
     * @return The purchase details for the token at the specified index.
     * @dev Requires that the index is within the bounds of the token's purchase history.
     */
    function getPurchaseForTokenAtIndex(uint256 tokenId, uint256 index) public view returns (BoothTypes.Purchase memory) {
        require(index < ticketPurchases[tokenId].length, "Index out of bounds");
        return ticketPurchases[tokenId][index];
    }

    /**
     * @notice Retrieves the latest purchase made by a user for a specific token.
     * @param user The address of the user.
     * @param tokenId The ID of the token.
     * @return The latest purchase details for the specified user and token.
     * @dev Requires that a purchase exists for the given user and token.
     */
    function getLatestPurchaseForUserAndToken(address user, uint256 tokenId) public view returns (BoothTypes.Purchase memory) {
        require(purchase[tokenId][user].timestamp != 0, "No purchase found");
        return purchase[tokenId][user];
    }

    /**
     * @notice Ensures that the specified token is registered in the Ticket Registry.
     * @param _tokenId The ID of the token to check.
     * @dev Requires that the token is registered in the Ticket Registry to proceed with the transaction.
     */
    modifier isRegistered(uint256 _tokenId) {
        require(ticketRegistry.isObjectRegistered(_tokenId), "Object is not registered");
        _;
    }

    /* 
    /////////////////////////////
    7. ERC1155 and Interface Implementations
    /////////////////////////////

      Place the ERC1155 token reception and interface support functions at the end.
    */ 

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

