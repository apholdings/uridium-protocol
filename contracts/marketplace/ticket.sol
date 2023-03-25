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
    // Define a constant role for the booth role
    bytes32 public constant BOOTH_ROLE = keccak256("BOOTH_ROLE");
    // Price of the NFT
    uint256 public price;
    // ID of the NFT
    uint256 public tokenId;
    // Stock limit for each token (0 means no limit)
    mapping(uint256 => uint256) public stock;
    // Add the unlimitedStock variable
    bool public unlimitedStock;
    // NFTs a user has minted for this ticket
    mapping(uint256 => mapping(address => uint256)) userNFTs;
    // Address to receive royalties
    address public royaltyReceiver;
    // Percentage of royalties to be paid (out of 10000)
    uint256 public royaltyPercentage;
    // Constructor function
    constructor(
        uint256 _tokenId, // ID of the NFT
        uint256 _price, // Price of the NFT
        uint256 _initialStock, // Initial stock of the NFT
        address _royaltyReceiver, // Address to receive royalties
        uint256 _royaltyPercentage, // Percentage of royalties to be paid (out of 10000)
        address[] memory _payees, // List of addresses to receive payments
        uint256[] memory _shares, // List of corresponding shares for each payee
        string memory _uri // Base URI for the NFT
    ) 
    ERC1155(_uri) 
    PaymentSplitter(_payees, _shares)
    {
        tokenId = _tokenId;
        price = _price;
        // Set the unlimitedStock value based on the initial stock
        unlimitedStock = _initialStock == 0;
        if (!unlimitedStock) {
            stock[tokenId] = _initialStock;
        }
        royaltyReceiver = _royaltyReceiver;
        royaltyPercentage = _royaltyPercentage;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BOOTH_ROLE, msg.sender);
    }

    // Event emitted when NFTs are minted
    event Mint(uint256 indexed id, uint256 qty);
    // Event emitted when the URI is set
    event SetUri(string newuri);
    // Event emitted when the contract is stopped
    event Stop();
    // Event emitted when the contract is started
    event Start();

    // Function to retrieve royalty information for a given token and sale price
    function royaltyInfo(uint256 _tokenId, uint256 _salePrice) external view override returns (address receiver, uint256 royaltyAmount) {
        receiver = royaltyReceiver;
        royaltyAmount = (_salePrice * royaltyPercentage) / 10000;
    }

    // Function to set the stock limit for a given token
    function setStock(uint256 _tokenId, uint256 _stock) public onlyRole(DEFAULT_ADMIN_ROLE) {
        stock[_tokenId] = _stock;
    }
    
    // Function to set the NFT URI metadata
    function setURI(string memory newuri) public onlyRole(DEFAULT_ADMIN_ROLE) {
        // Sets the new URI for the token
        _setURI(newuri);
        // Emits an event with the new URI
        emit SetUri(newuri);
    }

    // Function to set DiscountBuyer role
    function setDiscountBuyer(address buyer) public onlyRole(DEFAULT_ADMIN_ROLE) {
        // Grants the BOOTH_ROLE to a specified buyer address
        _grantRole(BOOTH_ROLE, buyer);
    }

    // Function to Update NFT price
    function updatePrice(uint256 newPrice) public onlyRole(DEFAULT_ADMIN_ROLE) {
        // Updates the price of the NFT ticket
        price = newPrice;
    }

    // Function to mint NFTs
    function mint(uint256 _tokenId, uint256 _nftId, uint256 _qty, address _guy) public payable {
        // If the caller is not the BOOTH_ROLE, apply the requirement
        if (!hasRole(BOOTH_ROLE, msg.sender)) {
            require(msg.value >= price * _qty, "Not Enough ETH to Buy NFT");
        }
        // Check if the NFT stock limit has been reached
        if (!unlimitedStock) {
            uint256 remainingStock = getStock(_tokenId);
            require(remainingStock >= _qty, "NFT Out of Stock");
            // Update the stock mapping
            stock[_tokenId] = remainingStock - _qty;
        }
        // Mint new NFTs to the user and emit an event
        _mint(_guy, _nftId, _qty, "");
        emit Mint(_nftId, _qty);
        // Record the NFTs that the user has minted for this ticket
        userNFTs[_tokenId][_guy] = _nftId;
    }

    // Function to get the remaining stock of a token
    function getStock(uint256 _tokenId) public view returns (uint256) {
        // Calculate the remaining stock by subtracting the total supply from the stock limit
        return unlimitedStock ? type(uint256).max : stock[_tokenId] - totalSupply(_tokenId);
    }

    // Function to Verify User has access to NFT, see if it is in his balance
    function hasAccess(uint256 ticketId, address usr) public view returns (bool) {
        // Retrieves the NFT ID that the user has minted for the specified ticket
        uint256 nftId = userNFTs[ticketId][usr];
        // Checks if the user has an NFT for the specified ticket
        return balanceOf(usr, nftId) > 0;
    }

    // Function to Get NFT Metadata
    function uri(uint256 _id) public view virtual override returns (string memory) {
        // Checks if the specified token exists
        require(exists(_id),"URI: Token does not exist.");
        // Retrieves the URI for the token and appends the token ID to the end of the URI
        return string(abi.encodePacked(super.uri(_id),Strings.toString(_id), ".json" ));
    }

    // Function to Mint Multiple NFTs at Once
    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        // Mints a batch of NFTs to the specified address
        _mintBatch(to, ids, amounts, data);
    }

    function _beforeTokenTransfer(address operator, address from, address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data)
        internal
        override(ERC1155, ERC1155Supply)
    {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
        // Assuming only one token is transferred at a time
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