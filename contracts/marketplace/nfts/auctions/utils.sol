// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;


import "./auctions.sol";
import "./types.sol";

import "hardhat/console.sol";

import "@openzeppelin/contracts/access/AccessControl.sol";


contract AuctionUtils is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    Auctions public auctionsContract;
    uint256 public maxPageSize = 100; // Default value

    constructor(Auctions _auctionsContract) {
        auctionsContract = _auctionsContract;
        _setupRole(ADMIN_ROLE, msg.sender);
    }

    function setMaxPageSize(uint256 _maxPageSize) public onlyRole(ADMIN_ROLE) {
        maxPageSize = _maxPageSize;
    }

    /* 
    /////////////////////////////
    Utility Functions
    /////////////////////////////

        Include utility functions like getRemainingTime and getActiveAuctions.
    */ 
    
    // Function to get remaining time for an auction
    function getRemainingTime(uint256 _auctionId) public view returns (uint256) {
        SharedTypes.AuctionInfo memory auction = auctionsContract.getAuctionInfo(_auctionId);
        
        // Check if the auction has already ended
        if(block.timestamp >= auction.endTime) {
            return 0;
        } else {
            // Calculate and return the remaining time
            return auction.endTime - block.timestamp;
        }
    }

    // Function to get active auctions for a specific user
    function getUserActiveAuctions(address user, uint256 page, uint256 pageSize) 
    public view 
    returns (uint256[] memory, uint256) 
    {
        uint256[] memory allActiveAuctions = auctionsContract.getUserActiveAuctions(user);
        uint256 totalActive = allActiveAuctions.length;

        if (pageSize > maxPageSize) {
            pageSize = maxPageSize;
        }

        uint256 startIndex = (page - 1) * pageSize;
        require(startIndex < totalActive, "Start index out of range");

        uint256 endIndex = startIndex + pageSize > totalActive ? totalActive : startIndex + pageSize;
        uint256[] memory paginatedActiveAuctions = new uint256[](endIndex - startIndex);

        for (uint256 i = startIndex; i < endIndex; i++) {
            paginatedActiveAuctions[i - startIndex] = allActiveAuctions[i];
        }

        return (paginatedActiveAuctions, totalActive);
    }

    // Function to get user bidding history for an auction
    function getUserBiddingHistory(address user, uint256 auctionId) public view returns (uint256) {
        return auctionsContract.biddingHistory(user, auctionId);
    }

    // Function to get the auction bid history
    function getAuctionBidHistory(uint256 _auctionId) public view returns (SharedTypes.Bid[] memory) {
        return auctionsContract.getAuctionBids(_auctionId);
    }

    // Function to get the active auctions
    function getActiveAuctions(uint256 page, uint256 pageSize) 
        public view 
        returns (SharedTypes.AuctionInfo[] memory, uint256)  
    {
        uint256 totalAuctions = auctionsContract.getTotalActiveAuctions();
        uint256 startIndex = (page - 1) * pageSize;
        require(startIndex < totalAuctions, "Start index out of range");

        if (pageSize > maxPageSize) {
            pageSize = maxPageSize;
        }

        uint256 endIndex = startIndex + pageSize > totalAuctions ? totalAuctions : startIndex + pageSize;
        SharedTypes.AuctionInfo[] memory paginatedAuctions = new SharedTypes.AuctionInfo[](endIndex - startIndex);

        for (uint256 i = startIndex; i < endIndex; i++) {
            paginatedAuctions[i - startIndex] = auctionsContract.getAuctionInfo(i);
        }

        return (paginatedAuctions, totalAuctions);
    }

    // Function to get the ended auctions
    function getEndedAuctions(uint256 page, uint256 pageSize) 
        public 
        view 
        returns (SharedTypes.AuctionInfo[] memory, uint256)  
    {
        uint256 totalAuctions = auctionsContract.getTotalEndedAuctions();
        uint256 startIndex = (page - 1) * pageSize;
        require(startIndex < totalAuctions, "Start index out of range");

        if (pageSize > maxPageSize) {
            pageSize = maxPageSize;
        }

        uint256 endIndex = startIndex + pageSize > totalAuctions ? totalAuctions : startIndex + pageSize;
        SharedTypes.AuctionInfo[] memory paginatedAuctions = new SharedTypes.AuctionInfo[](endIndex - startIndex);

        for (uint256 i = startIndex; i < endIndex; i++) {
            paginatedAuctions[i - startIndex] = auctionsContract.getAuctionInfo(i);
        }

        return (paginatedAuctions, totalAuctions);
    }

    // Function to get a limited list of auctions by NFT ID with pagination
    function getAuctionsByNftId(uint256 _nftId, uint256 page, uint256 pageSize) 
        public view 
        returns (SharedTypes.AuctionInfo[] memory, uint256) 
    {
        uint256 totalAuctions = auctionsContract.getTotalAuctions();
        uint256 count = 0;

        // First pass: count auctions with the matching NFT ID
        for (uint256 i = 0; i < totalAuctions; i++) {
            SharedTypes.AuctionInfo memory auction = auctionsContract.getAuctionInfo(i);
            if (auction.nftId == _nftId) {
                count++;
            }
        }

        // Apply pagination
        uint256 startIndex = (page - 1) * pageSize;
        if (startIndex > count) {
            startIndex = count;
        }
        uint256 endIndex = startIndex + pageSize;
        if (endIndex > count) {
            endIndex = count;
        }

        // Second pass: populate the paginated array with matching auctions
        SharedTypes.AuctionInfo[] memory paginatedAuctions = new SharedTypes.AuctionInfo[](endIndex - startIndex);
        uint256 arrayIndex = 0;
        for (uint256 i = 0; i < totalAuctions && arrayIndex < (endIndex - startIndex); i++) {
            SharedTypes.AuctionInfo memory auction = auctionsContract.getAuctionInfo(i);
            if (auction.nftId == _nftId) {
                if (i >= startIndex && i < endIndex) {
                    paginatedAuctions[arrayIndex] = auction;
                    arrayIndex++;
                }
            }
        }

        return (paginatedAuctions, count);
    }

    // Function to get a limited list of auctions without bids with pagination
    function getAuctionsWithoutBids(uint256 page, uint256 pageSize) 
        public view 
        returns (SharedTypes.AuctionInfo[] memory, uint256) 
    {
        uint256 totalAuctions = auctionsContract.getTotalAuctions();
        uint256 count = 0;

        // First pass: count auctions with no bids and not ended
        for (uint256 i = 0; i < totalAuctions; i++) {
            SharedTypes.AuctionInfo memory auction = auctionsContract.getAuctionInfo(i);
            if (auction.highestBid == 0 && !auction.ended) {
                count++;
            }
        }

        // Apply pagination
        uint256 startIndex = (page - 1) * pageSize;
        if (startIndex > count) {
            startIndex = count;
        }
        uint256 endIndex = startIndex + pageSize;
        if (endIndex > count) {
            endIndex = count;
        }

        // Second pass: populate the paginated array with matching auctions
        SharedTypes.AuctionInfo[] memory paginatedAuctions = new SharedTypes.AuctionInfo[](endIndex - startIndex);
        uint256 arrayIndex = 0;
        for (uint256 i = 0; i < totalAuctions && arrayIndex < (endIndex - startIndex); i++) {
            SharedTypes.AuctionInfo memory auction = auctionsContract.getAuctionInfo(i);
            if (auction.highestBid == 0 && !auction.ended) {
                if (i >= startIndex && i < endIndex) {
                    paginatedAuctions[arrayIndex] = auction;
                    arrayIndex++;
                }
            }
        }

        return (paginatedAuctions, count);
    }

    // Function to get a limited list of auctions close to ending with pagination
    function getAuctionsCloseToEnding(uint256 page, uint256 pageSize) 
    public view 
    returns (SharedTypes.AuctionInfo[] memory, uint256) 
    {
        uint256 totalAuctions = auctionsContract.getTotalAuctions();
        uint256 threshold = block.timestamp + auctionsContract.getTimeExtensionThreshold();
        uint256 count = 0;

        // First pass: count auctions close to ending and not ended
        for (uint256 i = 0; i < totalAuctions; i++) {
            SharedTypes.AuctionInfo memory auction = auctionsContract.getAuctionInfo(i);
            if (auction.endTime <= threshold && !auction.ended) {
                count++;
            }
        }

        // Apply pagination
        uint256 startIndex = (page - 1) * pageSize;
        if (startIndex > count) {
            startIndex = count;
        }
        uint256 endIndex = startIndex + pageSize;
        if (endIndex > count) {
            endIndex = count;
        }

        // Second pass: populate the paginated array with matching auctions
        SharedTypes.AuctionInfo[] memory paginatedAuctions = new SharedTypes.AuctionInfo[](endIndex - startIndex);
        uint256 arrayIndex = 0;
        for (uint256 i = 0; i < totalAuctions && arrayIndex < (endIndex - startIndex); i++) {
            SharedTypes.AuctionInfo memory auction = auctionsContract.getAuctionInfo(i);
            if (auction.endTime <= threshold && !auction.ended) {
                if (i >= startIndex && i < endIndex) {
                    paginatedAuctions[arrayIndex] = auction;
                    arrayIndex++;
                }
            }
        }

        return (paginatedAuctions, count);
    }

    // new methods
    function getAuctions(uint256 page, uint256 pageSize) public view returns (SharedTypes.AuctionInfo[] memory, uint256) {
        uint256 totalAuctions = auctionsContract.getTotalAuctions();
        uint256 startIndex = (page - 1) * pageSize;
        require(startIndex < totalAuctions, "Start index out of range");

        if (pageSize > maxPageSize) {
            pageSize = maxPageSize;
        }

        uint256 endIndex = startIndex + pageSize > totalAuctions ? totalAuctions : startIndex + pageSize;
        SharedTypes.AuctionInfo[] memory paginatedAuctions = new SharedTypes.AuctionInfo[](endIndex - startIndex);

        for (uint256 i = startIndex; i < endIndex; i++) {
            paginatedAuctions[i - startIndex] = auctionsContract.getAuctionInfo(i);
        }

        return (paginatedAuctions, totalAuctions);
    }
}