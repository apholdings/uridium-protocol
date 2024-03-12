// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "./ticket.sol";

/// @custom:security-contact security@boomslag.com
contract TicketRegistry is IERC165, IERC1155Receiver, AccessControl {

    /* 
    /////////////////////////////////
    1. Contract and Role Declarations 
    /////////////////////////////////
    
      - Define a constant role for the booking role
    */ 

    bytes32 public constant BOOTH_ROLE = keccak256("BOOTH_ROLE");

    /* 
    /////////////////////////////
    2. Structs and State Variables
    /////////////////////////////
    */ 

    struct NFTTransactionDetails {
        uint256 tokenId;
        uint256 nftId;
        address owner;
        uint256 qty;
        uint256 price;
        string uri;
    }

    // Mapping to store the registered objects and their ticket contracts
    mapping(address => mapping(uint256 => NFTTransactionDetails[])) private userOwnedNFTs;
    mapping(address => mapping(uint256 => uint256)) private userTokenIdCount;
    mapping(uint256 => Ticket) public objectToTicket;
    uint256 public maxPageSize = 100;

    /* 
    /////////////////////////////
    3. Constructor and events
    /////////////////////////////
    
      The constructor initializes the contract's state.
      The deployer will be granted the Booking Role.
    */ 

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BOOTH_ROLE, msg.sender);
    }

    event ObjectRegistered(uint256 tokenId, address ticketContract);

    /* 
    /////////////////////////////
    4. Role-Based Functionality
    /////////////////////////////

      Group functions by the roles that can call them. 
      For example, all functions that require BOOTH_ROLE should be together.
    */ 

    /**
     * @notice Registers a new NFT object and its corresponding ticket contract.
     * @param _tokenId The ID of the NFT to register.
     * @param _address The associated Ticket contract for the NFT.
     * @dev Only callable by users with the BOOTH_ROLE.
     *      Prevents re-registering an already registered object.
     */
    function registerObject(uint256 _tokenId, Ticket _address) external onlyRole(BOOTH_ROLE) {
        // Only allow registering an object once
        require(address(objectToTicket[_tokenId]) == address(0), "Object already registered");
        objectToTicket[_tokenId] = _address;
        emit ObjectRegistered(_tokenId, address(_address));
    }

    /**
     * @notice Checks if an NFT object is registered in the system.
     * @param _tokenId The ID of the NFT to check.
     * @return True if the NFT object is registered, false otherwise.
     */
    function isObjectRegistered(uint256 _tokenId) external view returns (bool) {
        return address(objectToTicket[_tokenId]) != address(0);
    }

    /**
     * @notice Modifier to ensure an NFT object is registered.
     * @param _tokenId The ID of the NFT to check.
     * @dev Reverts if the NFT object is not registered.
     */
    modifier isRegistered(uint256 _tokenId) {
        require(address(objectToTicket[_tokenId]) != address(0), "Object is not registered");
        _;
    }

    /**
     * @notice Modifier to ensure an NFT object is registered.
     * @param _tokenId The ID of the NFT to check.
     * @dev Reverts if the NFT object is not registered.
     */
    modifier onlyAllowDuringMint(uint256 _tokenId) {
        Ticket ticketContract = objectToTicket[_tokenId];
        require(ticketContract.isCurrentlyMinting(), "Can only be called during minting");
        _;
    }
    

    /**
     * @notice Updates ownership details in the registry when a new NFT is minted.
     * @param _guy The address of the user who mints the NFT.
     * @param _tokenId The ID of the token.
     * @param _nftId The ID of the NFT.
     * @param _qty The quantity of NFTs minted.
     * @param _price The price of the NFT.
     * @param _uri The URI of the NFT.
     * @dev Only callable by users with the BOOTH_ROLE.
     */
    function updateOwnershipOnMint(
        address _guy, 
        uint256 _tokenId, 
        uint256 _nftId, 
        uint256 _qty, 
        uint256 _price, 
        string memory _uri
    ) external onlyRole(BOOTH_ROLE) {
        _updateOwnershipOnMint(_guy,_tokenId,_nftId, _qty, _price, _uri);
    }

    function specialUpdateOnMint(
        address _guy, 
        uint256 _tokenId, 
        uint256 _nftId, 
        uint256 _qty, 
        uint256 _price, 
        string memory _uri
    ) external isRegistered(_tokenId) onlyAllowDuringMint(_tokenId) {
        Ticket ticketContract = objectToTicket[_tokenId];
        require(msg.sender == address(ticketContract), "Unauthorized caller");

        _updateOwnershipOnMint(_guy,_tokenId,_nftId, _qty, _price, _uri);
    }

    function _updateOwnershipOnMint(
        address _guy, 
        uint256 _tokenId, 
        uint256 _nftId, 
        uint256 _qty, 
        uint256 _price, 
        string memory _uri
    ) private {
        for (uint256 i = 0; i < _qty; ++i) {
            NFTTransactionDetails memory newNFT = NFTTransactionDetails({
                nftId: _nftId,
                tokenId: _tokenId,
                owner: _guy,
                qty: 1,
                price: _price,
                uri: _uri
            });

            userOwnedNFTs[_guy][_tokenId].push(newNFT);
            userTokenIdCount[_guy][_tokenId] += _qty;
        }
    }

    /**
     * @notice Updates ownership details in the registry when an NFT is transferred.
     * @param _from The address of the sender.
     * @param _to The address of the receiver.
     * @param _tokenId The ID of the token.
     * @param _nftId The ID of the NFT.
     * @param _qty The quantity of NFTs transferred.
     * @param _price The price of the NFT.
     * @param _uri The URI of the NFT.
     * @dev Only callable by users with the BOOTH_ROLE.
     */
    function updateOwnershipOnTransfer(
        address _from, 
        address _to, 
        uint256 _tokenId, 
        uint256 _nftId, 
        uint256 _qty, 
        uint256 _price, 
        string memory _uri
    ) external onlyRole(BOOTH_ROLE) {
        require(userTokenIdCount[_from][_tokenId] >= _qty, "Insufficient NFTs to transfer");

        // TODO: Verify from address owns the nft being transfered
        _updateOwnershipOnTransfer(_from, _to, _tokenId, _nftId, _qty, _price, _uri);
    }

    function specialUpdateOnTransfer(
        address _from, 
        address _to, 
        uint256 _tokenId, 
        uint256 _nftId, 
        uint256 _qty, 
        uint256 _price, 
        string memory _uri
    ) external isRegistered(_tokenId){
        Ticket ticketContract = objectToTicket[_tokenId];
        require(msg.sender == address(ticketContract), "Unauthorized caller");

        // TODO: Verify from address owns the nft being transfered
        _updateOwnershipOnTransfer(_from, _to, _tokenId, _nftId, _qty, _price, _uri);
    }

    function _updateOwnershipOnTransfer(
        address _from, 
        address _to, 
        uint256 _tokenId, 
        uint256 _nftId, 
        uint256 _qty, 
        uint256 _price, 
        string memory _uri
    ) private {
        // First, reduce the quantity from the sender's account
        bool isFound = false;
        uint256 i;
        for (i = 0; i < userOwnedNFTs[_from][_tokenId].length; i++) {
            if (userOwnedNFTs[_from][_tokenId][i].nftId == _nftId) {
                require(userOwnedNFTs[_from][_tokenId][i].qty >= _qty, "Insufficient NFT quantity");
                userOwnedNFTs[_from][_tokenId][i].qty -= _qty;
                isFound = true;
                break;
            }
        }
        require(isFound, "NFT not found for transfer");

        // If the NFT quantity becomes zero, we could choose to remove it from the array
        if (userOwnedNFTs[_from][_tokenId][i].qty == 0) {
            removeNFTFromOwner(_from, _tokenId, i);
        }

        // Now, add the NFT to the receiver's account
        isFound = false;
        for (i = 0; i < userOwnedNFTs[_to][_tokenId].length; i++) {
            if (userOwnedNFTs[_to][_tokenId][i].nftId == _nftId) {
                userOwnedNFTs[_to][_tokenId][i].qty += _qty;
                isFound = true;
                break;
            }
        }

        // If the NFT does not exist in the receiver's account, create a new entry
        if (!isFound) {
            NFTTransactionDetails memory newNFT = NFTTransactionDetails({
                nftId: _nftId,
                tokenId: _tokenId,
                owner: _to,
                qty: _qty,
                price: _price,
                uri: _uri
            });
            userOwnedNFTs[_to][_tokenId].push(newNFT);
        }

        // Update the token count for both sender and receiver
        userTokenIdCount[_from][_tokenId] -= _qty;
        userTokenIdCount[_to][_tokenId] += _qty;
    }

    // Helper function to remove an NFT from an owner's list if the quantity is zero
    function removeNFTFromOwner(address _owner, uint256 _tokenId, uint256 index) private {
        require(index < userOwnedNFTs[_owner][_tokenId].length, "Index out of bounds");

        // Move the last element to the index being removed and then pop the last element
        userOwnedNFTs[_owner][_tokenId][index] = userOwnedNFTs[_owner][_tokenId][userOwnedNFTs[_owner][_tokenId].length - 1];
        userOwnedNFTs[_owner][_tokenId].pop();
    }

    /* 
    /////////////////////////////
    5. Utility Functions
    /////////////////////////////
    
      Include utility functions like getStock and getNftId.
    */ 

    /**
     * @notice Retrieves the Ticket contract associated with a registered NFT.
     * @param _tokenId The ID of the NFT.
     * @return The associated Ticket contract.
     * @dev Ensures that the NFT is registered before returning the Ticket contract.
     */
    function getRegisteredNFT(uint256 _tokenId) public view isRegistered(_tokenId) returns (Ticket) {
        Ticket nft = objectToTicket[_tokenId];
        return nft;
    }

    /**
     * @notice Checks if a user owns a specific NFT.
     * @param _guy The address of the user.
     * @param _tokenId The ID of the NFT to check.
     * @return True if the user owns the NFT, false otherwise.
     */
    function doesUserOwnNFT(address _guy, uint256 _tokenId) public view returns (bool) {
        return userTokenIdCount[_guy][_tokenId] > 0;
    }

    /**
     * @notice Gets the remaining stock of a specific NFT.
     * @param _tokenId The ID of the NFT.
     * @return The remaining stock of the NFT.
     * @dev Returns -1 if the NFT does not use stock management.
     */
    function getStock(uint256 _tokenId) public view isRegistered(_tokenId) returns (int256) {
        Ticket ticketContract = objectToTicket[_tokenId];
        int256 remainingStock = -1;
        if (ticketContract.useStock()) {
            remainingStock = int256(ticketContract.stock(_tokenId)) - int256(ticketContract.totalSupply(_tokenId));
        }
        return remainingStock;
    }

    /**
     * @notice Checks if stock management is used for a specific NFT.
     * @param _tokenId The ID of the NFT.
     * @return True if the NFT uses stock management, false otherwise.
     */
    function getUseStock(uint256 _tokenId) public view isRegistered(_tokenId) returns (bool) {
        Ticket ticketContract = objectToTicket[_tokenId];
        bool usesStock = ticketContract.useStock();
        return usesStock;
    }

    /**
     * @notice Retrieves a paginated list of NFTs owned by a user for a specific tokenId.
     * @param user The address of the user.
     * @param tokenId The ID of the token.
     * @param page The page number of the paginated results.
     * @param pageSize The number of items per page.
     * @return ownedNFTDetails The list of NFTs owned by the user for the specified tokenId and page.
     * @return totalNFTs The total number of NFTs of the specified tokenId owned by the user.
     * @dev Pagination is implemented to manage large datasets.
     */
    function getOwnedNFTs(
        address user, 
        uint256 tokenId,
        uint256 page, 
        uint256 pageSize
    ) public view returns (NFTTransactionDetails[] memory ownedNFTDetails, uint256 totalNFTs) {
        totalNFTs = userOwnedNFTs[user][tokenId].length;
        uint256 startIndex = (page - 1) * pageSize;
        if (startIndex >= totalNFTs) {
            return (new NFTTransactionDetails[](0), totalNFTs);
        }

        uint256 endIndex = startIndex + pageSize > totalNFTs ? totalNFTs : startIndex + pageSize;
        ownedNFTDetails = new NFTTransactionDetails[](endIndex - startIndex);

        for (uint256 i = startIndex; i < endIndex; i++) {
            ownedNFTDetails[i - startIndex] = userOwnedNFTs[user][tokenId][i];
        }

        return (ownedNFTDetails, totalNFTs);
    }

    /**
     * @notice Retrieves the first owned NFT ID for a given tokenId.
     * @param user The address of the user.
     * @param tokenId The ID of the token.
     * @return The first NFT ID for the given tokenId owned by the user.
     */
    function getFirstOwnedNftIdForTokenId(address user, uint256 tokenId) public view returns (uint256) {
        require(userOwnedNFTs[user][tokenId].length > 0, "User does not own any NFTs for this tokenId");
        return userOwnedNFTs[user][tokenId][0].nftId;
    }

    /**
     * @notice Retrieves a paginated list of owned NFT IDs for a given tokenId.
     * @param user The address of the user.
     * @param tokenId The ID of the token.
     * @param page The page number for pagination.
     * @param pageSize The number of items per page.
     * @return ownedNftIds The paginated list of NFT IDs for the given tokenId.
     * @return totalNftCount The total count of NFTs for the given tokenId owned by the user.
     */
    function getOwnedNftIdsForTokenId(address user, uint256 tokenId, uint256 page, uint256 pageSize) public view returns (uint256[] memory ownedNftIds, uint256 totalNftCount) {
        totalNftCount = userOwnedNFTs[user][tokenId].length;
        uint256 startIndex = (page - 1) * pageSize;
        if (startIndex >= totalNftCount) {
            return (new uint256[](0), totalNftCount);
        }

        uint256 endIndex = startIndex + pageSize > totalNftCount ? totalNftCount : startIndex + pageSize;
        ownedNftIds = new uint256[](endIndex - startIndex);

        for (uint256 i = startIndex; i < endIndex; i++) {
            ownedNftIds[i - startIndex] = userOwnedNFTs[user][tokenId][i].nftId;
        }

        return (ownedNftIds, totalNftCount);
    }

    /* 
    /////////////////////////////
    6. ERC1155 and Interface Implementations
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