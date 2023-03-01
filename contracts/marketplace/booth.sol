// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

contract Booth is ReentrancyGuard, AccessControl {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // Variables
    address payable public immutable feeAccount; // the account that receives fees
    uint public immutable feePercent; // the fee percentage on sales 
    uint public itemCount; 

    struct Item {
        uint itemId;
        IERC1155 ticket;
        uint tokenId;
        uint price;
        uint amount;
        address payable seller;
        bool sold;
    }

    // itemId -> Item
    mapping(uint => Item) public items;

    event Offered(
        uint itemId,
        address indexed ticket,
        uint tokenId,
        uint price,
        uint amount,
        address indexed seller
    );

    event Bought(
        uint itemId,
        address indexed ticket,
        uint tokenId,
        uint price,
        uint amount,
        address indexed seller,
        address indexed buyer
    );

    constructor(uint _feePercent) {
        feeAccount = payable(msg.sender);
        feePercent = _feePercent;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);

    }

    // Make item to offer on the marketplace
    function sell(IERC1155 _ticket, uint _tokenId, uint _price, uint _amount) external nonReentrant {
        require(_price > 0, "Price must be greater than zero");
        // increment itemCount
        itemCount ++;
        // transfer Ticket (NFT)
        _ticket.safeTransferFrom(msg.sender, address(this), _tokenId, _amount, "0x");
        // add new item to items mapping
        items[itemCount] = Item (
            itemCount,
            _ticket,
            _tokenId,
            _price,
            _amount,
            payable(msg.sender),
            false
        );
        // emit Offered event
        emit Offered(
            itemCount,
            address(_ticket),
            _tokenId,
            _price,
            _amount,
            msg.sender
        );
    }

    function buy(uint _itemId) external payable nonReentrant {
        uint _totalPrice = getTotalPrice(_itemId);
        Item storage item = items[_itemId];
        require(_itemId > 0 && _itemId <= itemCount, "item doesn't exist");
        require(msg.value >= _totalPrice, "not enough ether to cover item price and market fee");
        require(!item.sold, "item already sold");
        // pay seller and feeAccount
        item.seller.transfer(item.price);
        feeAccount.transfer(_totalPrice - item.price);
        // update item to sold
        item.sold = true;
        // transfer nft to buyer
        item.ticket.safeTransferFrom(address(this), msg.sender, item.tokenId, 1, "");
        // emit Bought event
        emit Bought(
            _itemId,
            address(item.ticket),
            item.tokenId,
            item.price,
            1,
            item.seller,
            msg.sender
        );
    }

    // function withdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
    //     uint balance = address(this).balance;
    //     require(balance > 0, "No balance to withdraw");
    //     payable(msg.sender).transfer(balance);
    // }

    function getTotalPrice(uint _itemId) view public returns(uint){
        return((items[_itemId].price*(100 + feePercent))/100);
    }

    function onERC1155Received(address operator, address from, uint256 id, uint256 value, bytes memory data) public pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address operator, address from, uint256[] memory ids, uint256[] memory values, bytes memory data) public pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
}