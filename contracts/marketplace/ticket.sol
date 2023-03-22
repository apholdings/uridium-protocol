// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/finance/PaymentSplitter.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";


/// @custom:security-contact security@boomslag.com
contract Ticket is ERC1155, AccessControl, ERC1155Supply, PaymentSplitter,IERC2981 {
    bytes32 public constant BOOTH_ROLE = keccak256("BOOTH_ROLE");

    uint256 public price;
    uint256 public tokenId;

    // Stock limit for each token (0 means no limit)
    mapping(uint256 => uint256) public stock;

    // NFTS a user has minted for this ticket
    mapping(uint256 => mapping(address => uint256)) userNFTs;

    address public royaltyReceiver;
    uint256 public royaltyPercentage;

    constructor(
        uint256 _tokenId,
        uint256 _price,
        uint256 _initialStock,
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
        // Set the initial stock limit for tokenId 1
        stock[tokenId] = _initialStock;
        
        royaltyReceiver = _royaltyReceiver;
        royaltyPercentage = _royaltyPercentage;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BOOTH_ROLE, msg.sender);
    }

    event Mint(uint256 indexed id, uint256 qty);
    event SetUri(string newuri);
    event Stop();
    event Start();

    function royaltyInfo(uint256 _tokenId, uint256 _salePrice) external view override returns (address receiver, uint256 royaltyAmount) {
        receiver = royaltyReceiver;
        royaltyAmount = (_salePrice * royaltyPercentage) / 10000;
    }

    function setStock(uint256 _tokenId, uint256 _stock) public onlyRole(DEFAULT_ADMIN_ROLE) {
        stock[_tokenId] = _stock;
    }

    function setURI(string memory newuri) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(newuri);
        emit SetUri(newuri);
    }

    function setDiscountBuyer(address buyer) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(BOOTH_ROLE, buyer);
    }

    function updatePrice(uint256 newPrice) public onlyRole(DEFAULT_ADMIN_ROLE) {
            price = newPrice;
    }

    function mint(uint256 ticketId, uint256 nftId, uint256 qty, address guy)
        public
        payable
    {
        // Check if the user has enough ether to cover the purchase
        require(msg.value >= price * qty, "Not Enough ETH to Buy NFT");
        
        // require(totalSupply(id) + qty <= stock, "NFT Out of Stock");
        if (stock[nftId] > 0) {
            require(totalSupply(nftId) + qty <= stock[nftId], "NFT Out of Stock");
        }

        _mint(guy, nftId, qty, "");
        emit Mint(nftId, qty);

        userNFTs[ticketId][guy] = nftId;
    }

    function boothMint(uint256 ticketId, uint256 nftId, uint256 qty, address guy)
        public
        payable
        onlyRole(BOOTH_ROLE)
    {   
        // require(totalSupply(id) + qty <= stock, "NFT Out of Stock");
        if (stock[nftId] > 0) {
            require(totalSupply(nftId) + qty <= stock[nftId], "NFT Out of Stock");
        }

        _mint(guy, nftId, qty, "");
        emit Mint(nftId, qty);

        userNFTs[ticketId][guy] = nftId;
    }
    
    function hasAccess(uint256 ticketId, address usr) public view returns (bool) {
        // Get the user's NFT ID for the given course
        uint256 nftId = userNFTs[ticketId][usr];

        // Check if the user has an NFT associated with the course
        return balanceOf(usr, nftId) > 0;
    }

    function uri(uint256 _id) public view virtual override returns (string memory) {
        require(exists(_id),"URI: Token does not exist.");
        return string(abi.encodePacked(super.uri(_id),Strings.toString(_id), ".json" ));
        // return string(abi.encodePacked(super.uri(_id),Strings.toString(_id) ));
    }

    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
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