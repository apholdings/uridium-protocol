// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract SharedTypes {

    struct Auction {
        address seller;
        uint256 tokenId;
        uint256 nftId;
        uint256 startingPrice;
        uint256 endTime;
        uint256 highestBid;
        address highestBidder;
        bool ended;
        bool isOpen;
        uint256 reservePrice;
        mapping(address => uint256) deposits;
        mapping(address => uint256) bidTimestamps;
        address ticketContractAddress;
    }

    struct AuctionInfo {
        address seller;
        uint256 tokenId;
        uint256 nftId;
        uint256 startingPrice;
        uint256 endTime;
        uint256 highestBid;
        address highestBidder;
        bool ended;
        bool isOpen;
        uint256 reservePrice;
    }

    struct Bid {
        address bidder;
        uint256 amount;
        uint256 timestamp;
    }
}