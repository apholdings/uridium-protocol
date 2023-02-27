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

    uint256 public price;

    uint256 public platformShare = 10;
    uint256 public sellerShare = 90;

    constructor(
        // uint256 _ticketSupply,
        uint256 _price,
        address[] memory _payees,
        uint256[] memory _shares
    ) 
    ERC1155("https://boomslag.com/courses/{id}")
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

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
        emit Stop();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
        emit Start();
    }
    
    function buy(uint256 id, uint256 qty)
        public
        payable
    {
        require(msg.value >= price * qty, "Not Enough ETH to Buy NFT");
        // require(totalSupply(id) + qty <= ticketSupply, "NFT Out of Stock");
        emit Mint(id, qty);
        _mint(msg.sender, id, qty, "");
    }

    function uri(uint256 _id) public view virtual override returns (string memory) {
        require(exists(_id),"URI: Token does not exist.");
        return string(abi.encodePacked(super.uri(_id),Strings.toString(_id), ".json" ));
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
}