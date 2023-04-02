// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./ticket.sol";

/// @custom:security-contact security@boomslag.com
contract Auctions is IERC165, IERC1155Receiver, AccessControl {
    // Safemath to avoid overflows
    using SafeMath for uint256;
    // Define a constant role for the booth role
    bytes32 public constant AUCTION_ROLE = keccak256("AUCTION_ROLE");

    struct Auction {
        address seller;
        uint256 ticketId;
        uint256 nftId;
        uint256 startingPrice;
        uint256 endTime;
        uint256 highestBid;
        address highestBidder;
        bool ended;
    }

    // Contract address for the Ticket contract used in the auctions
    Ticket public ticketContract;
    // Mapping of auction ID to the corresponding Auction struct
    mapping(uint256 => Auction) public auctions;
    // Mapping of user address to an array of auction IDs they have participated in
    mapping(address => uint256[]) public userAuctions;
    // Mapping of user address and auction ID to the amount they have bid
    mapping(address => mapping(uint256 => uint256)) public biddingHistory;
    // Counter for generating unique IDs for new auctions
    uint256 public nextAuctionId;

    constructor(
        Ticket _ticketContract
    ) 
    {
        ticketContract = _ticketContract;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(AUCTION_ROLE, msg.sender);
    }

    event AuctionCreated(uint256 indexed auctionId, address indexed seller, uint256 ticketId,uint256 nftId, uint256 startingPrice, uint256 endTime);
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event BidRefunded(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event AuctionEnded(uint256 indexed auctionId, address indexed seller, address indexed winner, uint256 amount);

    // Function to create an auction
    function createAuction(
        uint256 _ticketId,
        uint256 _nftId,
        uint256 _startingPrice,
        uint256 _duration
    ) public {
        require(ticketContract.hasAccess(_ticketId, msg.sender), "Seller must own the ticket");
        
        require(_duration >= 1 hours && _duration <= 4 weeks, "Invalid auction duration");

        uint256 auctionId = nextAuctionId;
        nextAuctionId++;

        // Transfer NFT to auction contract
        ticketContract.safeTransferFrom(msg.sender, address(this), _nftId, 1, "");


        auctions[auctionId] = Auction({
            seller: msg.sender,
            ticketId: _ticketId,
            nftId: _nftId,
            startingPrice: _startingPrice,
            endTime: block.timestamp.add(_duration),
            highestBid: 0,
            highestBidder: address(0),
            ended: false
        });

        userAuctions[msg.sender].push(auctionId);
        emit AuctionCreated(auctionId, msg.sender, _ticketId,_nftId, _startingPrice, auctions[auctionId].endTime);
    }
    // Function to place bid, it refunds the highest bidder
    function placeBid(uint256 _auctionId) public payable {
        Auction storage auction = auctions[_auctionId];
        require(block.timestamp < auction.endTime, "Auction has ended");
        require(msg.value > auction.highestBid, "Bid must be higher than current highest bid");

        // Refund previous highest bidder
        if (auction.highestBidder != address(0)) {
            payable(auction.highestBidder).transfer(auction.highestBid);
            emit BidRefunded(_auctionId, auction.highestBidder, auction.highestBid);
        }

        auction.highestBid = msg.value;
        auction.highestBidder = msg.sender;

        // Update bidding history
        biddingHistory[msg.sender][_auctionId] = biddingHistory[msg.sender][_auctionId].add(msg.value);

        emit BidPlaced(_auctionId, msg.sender, msg.value);
    }
    // Function to end an earlier
    function endAuction(uint256 _auctionId) public onlyRole(AUCTION_ROLE) {
        Auction storage auction = auctions[_auctionId];
        require(!auction.ended, "Auction has already ended");
        require(block.timestamp >= auction.endTime, "Auction is still ongoing");

        auction.ended = true;
        emit AuctionEnded(_auctionId, auction.seller, auction.highestBidder, auction.highestBid);

        // Transfer NFT to the highest bidder
        ticketContract.safeTransferFrom(address(this), auction.highestBidder, auction.nftId, 1, "");

        // Transfer the funds to the seller
        (bool success, ) = auction.seller.call{value: auction.highestBid}("");
        require(success, "Failed to transfer funds to the seller");
    }
    // Function to withdraw funds from the Auctions contract if necessary
    function withdraw() public onlyRole(AUCTION_ROLE) {
        uint256 amount = address(this).balance;
        require(amount > 0, "No funds to withdraw");
        payable(msg.sender).transfer(amount);
    }
    // Function to get remaining time for an auction
    function getRemainingTime(uint256 _auctionId) public view returns (uint256) {
        Auction storage auction = auctions[_auctionId];
        if (block.timestamp >= auction.endTime) {
            return 0;
        } else {
            return auction.endTime.sub(block.timestamp);
        }
    }
    // Function to get active auctions for a specific user
    function getActiveAuctions(address user) public view returns (uint256[] memory) {
        return userAuctions[user];
    }
    // Function to get user bidding history for an auction
    function getUserBiddingHistory(address user, uint256 auctionId) public view returns (uint256) {
        return biddingHistory[user][auctionId];
    }
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