// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "./ticket.sol";

import "hardhat/console.sol";

/// @custom:security-contact security@boomslag.com
contract TicketRegistry is IERC165, IERC1155Receiver, AccessControl {

    /* /////////////////////////////////
      1. Contract and Role Declarations 
      - Define a constant role for the booking role
    */ /////////////////////////////////

    bytes32 public constant BOOKING_ROLE = keccak256("BOOKING_ROLE");

    /* /////////////////////////////
      2. Structs and State Variables
    */ /////////////////////////////

    struct NFTTransactionDetails {
        uint256 nftId;
        uint256 tokenId; // If different from nftId
        address owner;
        uint256 qty;
        uint256 price;
        string uri;
        // Include other details you deem necessary
    }

    // Mapping to store the registered objects and their ticket contracts
    mapping(address => NFTTransactionDetails[]) private userOwnedNFTs;

    // mapping(address => uint256[]) private userOwnedNFTs;
    mapping(address => mapping(uint256 => uint256)) private userOwnedNFTsIndex;

    mapping(uint256 => Ticket) public objectToTicket;
    uint256 public maxPageSize = 100; // Default value

    /* /////////////////////////////
      3. Constructor and events
      The constructor initializes the contract's state.
      The deployer will be granted the Booking Role.
    */ /////////////////////////////

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BOOKING_ROLE, msg.sender);
    }

    event ObjectRegistered(uint256 tokenId, address ticketContract);

    /* /////////////////////////////
      4. Role-Based Functionality
      Group functions by the roles that can call them. 
      For example, all functions that require BOOKING_ROLE should be together.
    */ /////////////////////////////

    // Register a new object and its corresponding ticket contract
    function registerObject(uint256 _tokenId, Ticket ticketContract) external onlyRole(BOOKING_ROLE) {
        // Only allow registering an object once
        require(address(objectToTicket[_tokenId]) == address(0), "Object already registered");
        objectToTicket[_tokenId] = ticketContract;
        emit ObjectRegistered(_tokenId, address(ticketContract));
    }

    // Check if an object is registered
    function isObjectRegistered(uint256 _tokenId) external view returns (bool) {
        return address(objectToTicket[_tokenId]) != address(0);
    }

    modifier isRegistered(uint256 _tokenId) {
        require(address(objectToTicket[_tokenId]) != address(0), "Object is not registered");
        _;
    }

    function updateOwnershipOnMint(
        address user, 
        uint256 tokenId, 
        uint256 nftId, 
        uint256 qty, 
        uint256 price, 
        string memory uri
    ) external onlyRole(BOOKING_ROLE) {
        for (uint256 i = 0; i < qty; ++i) {
            NFTTransactionDetails memory newNFT = NFTTransactionDetails({
                nftId: nftId, // Assuming nftId and tokenId are the same
                tokenId: tokenId,
                owner: user,
                qty: 1, // Each NFT has a quantity of 1
                price: price, // Price needs to be passed to this function
                uri:uri
            });

            userOwnedNFTs[user].push(newNFT);
            userOwnedNFTsIndex[user][tokenId] = userOwnedNFTs[user].length - 1;
        }
    }

    function updateOwnershipOnTransfer(
        address from, 
        address to, 
        uint256 tokenId, 
        uint256 nftId, 
        uint256 qty, 
        uint256 price, 
        string memory uri
    ) external onlyRole(BOOKING_ROLE) 
    {

        _removeTokenFromUser(from, tokenId, qty);

        for (uint256 i = 0; i < qty; ++i) {
            NFTTransactionDetails memory newNFT = NFTTransactionDetails({
                nftId: nftId,
                tokenId: tokenId,
                owner: to,
                qty: 1,
                price: price,
                uri: uri
            });

            userOwnedNFTs[to].push(newNFT);
            userOwnedNFTsIndex[to][tokenId] = userOwnedNFTs[to].length - 1;
        }

    }

    function _removeTokenFromUser(address user, uint256 tokenId, uint256 qty) private {
        uint256 index = userOwnedNFTsIndex[user][tokenId];
        uint256 lastTokenIndex = userOwnedNFTs[user].length - 1;

        // Move the last token to the slot of the token to delete
        userOwnedNFTs[user][index] = userOwnedNFTs[user][lastTokenIndex];

        // Update the moved token's index
        userOwnedNFTsIndex[user][userOwnedNFTs[user][index].tokenId] = index;

        // Remove the last token
        userOwnedNFTs[user].pop();

        // If the user still owns some tokens of this type, decrease the quantity
        if (index < userOwnedNFTs[user].length) {
            userOwnedNFTs[user][index].qty -= qty;
        }
    }

    /* /////////////////////////////
      5. Utility Functions
      Include utility functions like getStock and getNftId.
    */ /////////////////////////////

    function doesUserOwnNFT(address user, uint256 nftId) public view returns (bool) {
        NFTTransactionDetails[] memory ownedNFTs = userOwnedNFTs[user];
        for (uint256 i = 0; i < ownedNFTs.length; i++) {
            if (ownedNFTs[i].nftId == nftId) {
                return true;
            }
        }
        return false;
    }

    function getStock(uint256 _tokenId) public view isRegistered(_tokenId) returns (int256) {
        Ticket ticketContract = objectToTicket[_tokenId];
        int256 remainingStock = -1;
        if (ticketContract.useStock()) {
            remainingStock = int256(ticketContract.stock(_tokenId)) - int256(ticketContract.totalSupply(_tokenId));
        }
        return remainingStock;
    }

    function getUseStock(uint256 _tokenId) public view isRegistered(_tokenId) returns (bool) {
        Ticket ticketContract = objectToTicket[_tokenId];
        bool usesStock = ticketContract.useStock();
        return usesStock;
    }

    function getOwnedNFTs(address user, uint256 page, uint256 pageSize) 
        public 
        view 
        returns (NFTTransactionDetails[] memory ownedNFTDetails, uint256 totalNFTs) 
    {
        totalNFTs = userOwnedNFTs[user].length;
        uint256 startIndex = (page - 1) * pageSize;
        if (startIndex >= totalNFTs) {
            return (new NFTTransactionDetails[](0), totalNFTs);
        }
        if (pageSize > maxPageSize) {
            pageSize = maxPageSize;
        }
        uint256 endIndex = startIndex + pageSize > totalNFTs ? totalNFTs : startIndex + pageSize;
        ownedNFTDetails = new NFTTransactionDetails[](endIndex - startIndex);

        for (uint256 i = startIndex; i < endIndex; i++) {
            ownedNFTDetails[i - startIndex] = userOwnedNFTs[user][i];
        }

        return (ownedNFTDetails, totalNFTs);
    }

    /* /////////////////////////////
      6. ERC1155 and Interface Implementations
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