// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/finance/PaymentSplitter.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/utils/Strings.sol";


/// @custom:security-contact security@boomslag.com
contract Ticket is ERC1155, AccessControl, ERC1155Supply, PaymentSplitter,IERC2981 {
    
    /* 
    /////////////////////////////////
    1. Contract and Role Declarations 
    /////////////////////////////////

        - Define a constant role for the booth role
    */ 
   
    bytes32 public constant BOOTH_ROLE = keccak256("BOOTH_ROLE");

    /* 
    /////////////////////////////
    2. Structs and State Variables
    /////////////////////////////
        
        This section declares the state variables and data structures used in the contract.

        - price: The price of the NFT in wei.
        - tokenId: The unique identifier for each NFT.
        - stock: A mapping that associates each token ID with its stock limit. A value of 0 means there is no limit.
        - useStock: A boolean variable that indicates whether the contract should use the stock limit.
        - limitedEdition: A boolean variable that indicates whether the NFT is a limited edition.
        - userNFTs: A nested mapping that associates each user address with the number of NFTs they have minted for each token ID.
        - royaltyReceiver: The address that will receive the royalties from sales.
        - royaltyPercentage: The percentage of the sale price that will be paid as royalties. This is represented as a number out of 10000 (for example, 500 represents 5%).
    */

    uint256 public price;
    uint256 public tokenId;
    mapping(uint256 => uint256) public stock;
    bool public useStock;
    bool public limitedEdition;
    address public royaltyReceiver;
    uint256 public royaltyPercentage;

    /* 
    /////////////////////////////
    3. Constructor and Events
    /////////////////////////////

        The constructor initializes the state of the contract with the following parameters:

        - uint256 _tokenId: This is the unique identifier for each NFT. For example, 8263712349.

        - uint256 _price: This is the price of the NFT in wei. The price is converted from ether to wei as follows:
            price = float(product.price)
            ticket_price = web3.to_wei(price, "ether")

        - uint256 _initialStock: This is the initial stock of the NFT. 
            For example, if _initialStock is 100, only 100 NFTs can be minted before a resupply is required.

        - bool _useStock: This boolean value indicates whether the contract should consider the stock limit. 
            If _useStock is true, the stock limit is considered; otherwise, the product is assumed to have an unlimited supply.

        - bool _limitedEdition: This boolean value restricts minting once the stock limit is reached. 
            If _limitedEdition is true, new NFTs cannot be minted once the stock limit is reached. This works in conjunction with the _useStock parameter.

        - address _royaltyReceiver: This is the address of the creator who will receive royalties. 
            Note that not all platforms enforce royalties.

        - uint256 _royaltyPercentage: This is the percentage of the sale price that will be paid as royalties, 
            represented as a number out of 10000 basis points. For example, 500 represents a 5% royalty.

        - address[] memory _payees: This is a list of addresses that will receive payments from each NFT sale. 
            Each payee must claim their profit by executing the required method. For example, [owner.address, seller.address].

        - uint256[] memory _shares: This is a list of shares corresponding to each payee. 
            The number of shares must add up to 100, and the number of items in the list must be the same as the number of payees. 
            For example, [10, 90]. In this scenario, owner.address would receive 10% of every NFT sale, and seller.address could claim the remaining 90%. Note that addresses cannot be repeated.

        - string memory _uri: This is the base URI for the NFT, which is the HTTPS address hosting the NFT metadata. 
            For example, "https://api.boomslag.com/api/courses/nft/{tokenId}".
    */
    
    constructor(
        uint256 _tokenId,
        uint256 _price,
        uint256 _initialStock,
        bool _useStock,
        bool _limitedEdition,
        address _royaltyReceiver,
        uint256 _royaltyPercentage,
        address[] memory _payees,
        uint256[] memory _shares,
        string memory _uri
    )
    ERC1155(_uri) 
    PaymentSplitter(_payees, _shares)
    {
        tokenId = _tokenId;
        price = _price;
        useStock = _useStock;
        limitedEdition = _limitedEdition;
        if (limitedEdition)
            useStock = true;
        stock[tokenId] = _initialStock;
        royaltyReceiver = _royaltyReceiver;
        royaltyPercentage = _royaltyPercentage;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    event Mint(uint256 indexed tokenId, uint256 indexed nftId, uint256 qty, uint256 price, address indexed guy, string uri);
    event Transfer(address indexed from, address indexed to, uint256 indexed nftId, uint256 tokenId, uint256 qty, string uri);
    event StockUpdated(uint256 indexed tokenId, uint256 stock);
    event UseStockUpdated(bool useStock);
    event SetUri(string newuri);
    event Stop();
    event Start();

    /* 
    /////////////////////////////
    4. Role-Based Functionality
    /////////////////////////////

        Group functions by the roles that can call them. 
        For example, all functions that require BOOTH_ROLE should be together.
    */ 

    // Function to set the stock limit for a given token
    function setStock(uint256 _tokenId, uint256 _stock) public onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!limitedEdition){
            stock[_tokenId] = _stock;
            emit StockUpdated(_tokenId, _stock);
        }
    }
    // Function to set the stock limit for a given token
    function setUseStock(bool _useStock) public onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!limitedEdition){
            useStock = _useStock;
            emit UseStockUpdated(_useStock);
        }
    }
    // Function to set the NFT URI metadata
    function setURI(string memory newuri) public onlyRole(DEFAULT_ADMIN_ROLE) {
        // Sets the new URI for the token
        _setURI(newuri);
        // Emits an event with the new URI
        emit SetUri(newuri);
    }
    // Function to Update NFT price
    function updatePrice(uint256 newPrice) public onlyRole(DEFAULT_ADMIN_ROLE) {
        // Updates the price of the NFT ticket
        price = newPrice;
    }
    // Function to retrieve royalty information for a given token and sale price
    function royaltyInfo(uint256 /*_tokenId*/, uint256 _salePrice) external view override returns (address receiver, uint256 royaltyAmount) {
        receiver = royaltyReceiver;
        royaltyAmount = (_salePrice * royaltyPercentage) / 10000; // assuming the royaltyPercentage is out of 10000 for a percentage calculation
    }
    
    /* 
    /////////////////////////////
    5. Purchase and Minting
    /////////////////////////////
        
        Group together all functions related to purchasing and minting.
            
    */ 
    
    // Function to mint NFTs
    function mint(uint256 _tokenId, uint256 _nftId, uint256 _qty, address _guy) public payable {
        // If the caller is not the BOOTH_ROLE, apply the requirement
        if (!hasRole(BOOTH_ROLE, msg.sender)) {
             // Price check for regular buyers
            require(msg.value >= price * _qty, "Not Enough ETH to Buy NFT");
        }
        // Check if the NFT stock limit has been reached
        if (useStock) {
            uint256 remainingStock = stock[_tokenId];
            require(remainingStock >= _qty, "NFT Out of Stock");
            // If it's a limited edition, prevent minting if out of stock
            if (limitedEdition && remainingStock == 0) {
                revert("Cannot mint limited edition NFT when out of stock");
            }
            // Update the stock mapping
            stock[_tokenId] = remainingStock - _qty;
        }
        // Mint new NFTs to the user and emit an event
        _mint(_guy, _nftId, _qty, "");

        string memory nftUri = string(abi.encodePacked(super.uri(_nftId),Strings.toString(_nftId), ".json" ));
        emit Mint(_tokenId, _nftId, _qty, msg.value, _guy, nftUri);
    }
    // Function to Mint Multiple NFTs at Once
    function mintBatch(address _to, uint256[] memory _ids, uint256[] memory _amounts, bytes memory _data)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        // Mints a batch of NFTs to the specified address
        // _mintBatch(_to, _ids, _amounts, _data);
        // Mint Batch is Disabled in this contract
    }
    // Function to gift NFTs
    function gift(uint256 _tokenId, uint256 _nftId, uint256 _qty, address _guy) public payable onlyRole(BOOTH_ROLE) {
        // Check if the NFT stock limit has been reached
        if (useStock) {
            uint256 remainingStock = stock[_tokenId];
            require(remainingStock >= _qty, "NFT Out of Stock");
            // If it's a limited edition, prevent minting if out of stock
            if (limitedEdition && remainingStock == 0) {
                revert("Cannot mint limited edition NFT when out of stock");
            }
            // Update the stock mapping
            stock[_tokenId] = remainingStock - _qty;
        }
        // Mint new NFTs to the user and emit an event
        _mint(_guy, _nftId, _qty, "");

        string memory nftUri = string(abi.encodePacked(super.uri(_nftId),Strings.toString(_nftId), ".json" ));
        emit Mint(_tokenId, _nftId, _qty, 0, _guy, nftUri);
    }

    /* 
    /////////////////////////////
    6. Utility Functions
    /////////////////////////////

        Include utility functions like isObjectRegistered and hasAccess.
    */ 

    // Function to Get NFT Metadata
    function uri(uint256 _id) public view virtual override returns (string memory) {
        // Checks if the specified token exists
        require(exists(_id),"URI: Token does not exist.");
        // Retrieves the URI for the token and appends the token ID to the end of the URI
        return string(abi.encodePacked(super.uri(_id),Strings.toString(_id), ".json" ));
    }

    // function getUserNFTIds(address usr) public view returns (uint256[] memory) {
    //     return userOwnedNFTs[usr];
    // }

    /* 
    /////////////////////////////
    7. ERC1155 and Interface Implementations
    /////////////////////////////

        Place the ERC1155 token reception and interface support functions at the end.
    */ 
    
    function _beforeTokenTransfer(address operator, address from, address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data)
        internal
        override(ERC1155, ERC1155Supply)
    {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);

        for (uint256 i = 0; i < ids.length; i++) {
            string memory nftUri = string(abi.encodePacked(super.uri(ids[i]),Strings.toString(ids[i]), ".json" ));
            emit Transfer(from, to, ids[i], tokenId, amounts[i], nftUri);
        }
    }
    // The following functions are overrides required by Solidity.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl, IERC165)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}