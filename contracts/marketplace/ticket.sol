// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/finance/PaymentSplitter.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";

/// @custom:security-contact security@boomslag.com
contract Ticket is ERC1155, AccessControl, Pausable, ERC1155Supply, PaymentSplitter {
    bytes32 public constant URI_SETTER_ROLE = keccak256("URI_SETTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant STK_ROLE = keccak256("STK_ROLE");
    bytes32 public constant DISCOUNT_BUYER_ROLE = keccak256("DISCOUNT_BUYER_ROLE");

    uint256 public price;
    // NFTS a user has minted for this ticket
    mapping(uint256 => mapping(address => uint256)) userNFTs;

    constructor(
        // uint256 _ticketSupply,
        uint256 _price,
        address[] memory _payees,
        uint256[] memory _shares,
        string memory _uri
    ) 
    ERC1155(_uri)
    PaymentSplitter(_payees, _shares)
    {
        price = _price;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(URI_SETTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    event Mint(uint256 indexed id, uint256 qty);
    event SetUri(string newuri);
    event Stop();
    event Start();

    function setURI(string memory newuri) public onlyRole(URI_SETTER_ROLE) {
        _setURI(newuri);
        emit SetUri(newuri);
    }

    function setDiscountBuyer(address buyer) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(DISCOUNT_BUYER_ROLE, buyer);
    }

    function updatePrice(uint256 newPrice) public onlyRole(MINTER_ROLE) {
            price = newPrice;
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
        emit Stop();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
        emit Start();
    }
    
    function buy(uint256 ticketId, uint256 nftId, uint256 qty, address guy)
        public
        payable
    {
        require(msg.value >= price * qty, "Not Enough ETH to Buy NFT");
        // require(totalSupply(id) + qty <= ticketSupply, "NFT Out of Stock");
        emit Mint(nftId, qty);
        _mint(guy, nftId, qty, "");
        // Store the mapping between the course ID and the user's NFT ID
        userNFTs[ticketId][guy] = nftId;
    }

    function discountBuy(uint256 ticketId, uint256 nftId, uint256 qty, address guy) public payable onlyRole(DISCOUNT_BUYER_ROLE) {
        // Mint the requested amount of NFTs and send them to the buyer
        emit Mint(nftId, qty);
        _mint(guy, nftId, qty, "");

        // Revoke the discount buyer role to prevent further discounted purchases
        // _revokeRole(DISCOUNT_BUYER_ROLE, guy);
        // Store the mapping between the course ID and the user's NFT ID
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
        // return string(abi.encodePacked(super.uri(_id),Strings.toString(_id), ".json" ));
        return string(abi.encodePacked(super.uri(_id),Strings.toString(_id) ));
    }

    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data)
        public
        onlyRole(MINTER_ROLE)
    {
        _mintBatch(to, ids, amounts, data);
    }

    function _beforeTokenTransfer(address operator, address from, address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data)
        internal
        whenNotPaused
        override(ERC1155, ERC1155Supply)
    {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
        // Assuming only one token is transferred at a time
    }

    // The following functions are overrides required by Solidity.

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    fallback() external payable {}
}