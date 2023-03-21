// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./ticket.sol";

contract Auctions {
    struct Auction {
        address seller;
        uint256 ticketId;
        uint256 courseId;
        uint256 startingPrice;
        uint256 endTime;
        uint256 highestBid;
        address highestBidder;
        bool ended;
    }

    mapping(uint256 => Auction) public auctions;
    uint256 public nextAuctionId;

    Ticket public ticketContract;

    constructor(Ticket _ticketContract) {
        ticketContract = _ticketContract;
    }

    function createAuction(
        uint256 _courseId,
        uint256 _ticketId,
        uint256 _startingPrice,
        uint256 _duration
    ) public {
        require(ticketContract.balanceOf(msg.sender, _ticketId) > 0, "Seller must own the ticket");

        uint256 auctionId = nextAuctionId;
        nextAuctionId++;

        auctions[auctionId] = Auction({
            seller: msg.sender,
            ticketId: _ticketId,
            courseId: _courseId,
            startingPrice: _startingPrice,
            endTime: block.timestamp + _duration,
            highestBid: 0,
            highestBidder: address(0),
            ended: false
        });
    }

    function placeBid(uint256 _auctionId) public payable {
        Auction storage auction = auctions[_auctionId];
        require(block.timestamp < auction.endTime, "Auction has ended");
        require(msg.value > auction.highestBid, "Bid must be higher than current highest bid");

        // Refund previous highest bidder
        if (auction.highestBidder != address(0)) {
            payable(auction.highestBidder).transfer(auction.highestBid);
        }

        auction.highestBid = msg.value;
        auction.highestBidder = msg.sender;
    }

    function endAuction(uint256 _auctionId) public {
        Auction storage auction = auctions[_auctionId];
        require(block.timestamp >= auction.endTime, "Auction is still ongoing");
        require(!auction.ended, "Auction has already been ended");

        auction.ended = true;

        // Transfer funds to the seller
        payable(auction.seller).transfer(auction.highestBid);

        // Transfer the ticket to the highest bidder
        ticketContract.safeTransferFrom(auction.seller, auction.highestBidder, auction.ticketId, 1, "");

        // Clear the auction data
        delete auctions[_auctionId];
    }
}