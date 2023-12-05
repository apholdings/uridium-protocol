// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import "../tickets/ticket.sol";
import "./types.sol";

import "hardhat/console.sol";

/// @custom:security-contact security@boomslag.com
contract Auctions is IERC165, IERC1155Receiver, AccessControl, ReentrancyGuard, Pausable {
    // Safemath to avoid overflows
    using SafeMath for uint256;

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

        - struct Auction: This structure represents an auction. It includes the seller's address, the ticket ID and NFT ID being auctioned, the starting price, the end time of the auction, the highest bid and bidder, and a boolean to indicate if the auction has ended.

        - ticketContract: This is the address of the Ticket contract used in the auctions.

        - auctions: This is a mapping from auction ID to the corresponding Auction struct.

        - userAuctions: This is a mapping from a user's address to an array of auction IDs they have participated in.

        - biddingHistory: This is a mapping from a user's address and an auction ID to the amount they have bid in that auction.

        - nextAuctionId: This is a counter for generating unique IDs for new auctions.

        - depositPercentage: Percentage of bid amount to be deposited

        - bidLockPeriod: Lock period in seconds

        - platformCommission: Represented in basis points (500 is 5%)
    */

    Ticket public ticketContract;
    mapping(uint256 => SharedTypes.Auction) public auctions;
    mapping(address => uint256[]) public userAuctions;
    mapping(address => mapping(uint256 => uint256)) public biddingHistory;
    mapping(uint256 => SharedTypes.Bid[]) public auctionBids;

    // New index mappings for efficient lookup
    mapping(uint256 => uint256) private auctionIndex; // Maps auction ID to its index in the activeAuctions array
    mapping(address => mapping(uint256 => uint256)) private userAuctionIndex; // Maps user address and auction ID to index in userActiveAuctions

    // User's active auctions
    mapping(address => uint256[]) public userActiveAuctions;

    mapping(uint256 => uint256) private activeAuctionIndex; // Maps auction ID to its index in activeAuctionIds array
    uint256[] private activeAuctionIds; // Dynamic array of active auction IDs

    // Counters for total, active, and ended auctions
    uint256 public totalAuctions;
    uint256 public totalActiveAuctions;
    uint256 public totalEndedAuctions;

    // Auction Parameters
    uint256 public nextAuctionId;
    uint256 public timeExtensionThreshold;
    uint256 public minBidIncrement;
    uint256 public depositPercentage;
    uint256 public bidLockPeriod;
    uint256 public platformCommission;
    address public platformOwnerAddress;

    /* 
    /////////////////////////////
    3. Constructor and Events
    /////////////////////////////

        The constructor initializes the state of the contract with the following parameters:

        - Ticket _ticketContract: This is the ERC20 contract address of the Ticket.sol contract

        - timeExtensionThreshold: This variable will hold the number of seconds for the time extension. 
            e.g: 300; // 5 minutes in seconds
        
        - uint256 _initialMinBidIncrement: The minimum bid increment in an auction contract can be specified in wei, which is the smallest denomination of ether. One ether is equivalent to 
            e.g: 10**16; // 0.01 ether in wei

        - uint256 _depositPercentage: Percentage of bid amount to be deposited. The platform will keep this in case of an early withdrawal.
        
        - uint256 _bidLockPeriod: Lock period in seconds
            e.g; 300 is 5 minutes in seconds
        
        - uint256 _platformCommission: Percentage comission for platform, represented in basis points.
            e.g; 500 is 5%

    */

    constructor(
        Ticket _ticketContract,
        uint256 _timeExtensionThreshold,
        uint256 _initialMinBidIncrement,
        uint256 _depositPercentage,
        uint256 _bidLockPeriod,
        uint256 _platformCommission
    ) 
    {
        ticketContract = _ticketContract;
        timeExtensionThreshold = _timeExtensionThreshold;
        minBidIncrement = _initialMinBidIncrement;
        depositPercentage = _depositPercentage;
        bidLockPeriod = _bidLockPeriod;
        platformCommission = _platformCommission;
        platformOwnerAddress = msg.sender;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BOOTH_ROLE, msg.sender);
    }

    event AuctionCreated(uint256 indexed auctionId, address indexed seller, uint256 ticketId, uint256 nftId, uint256 startingPrice, uint256 endTime);
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event BidRefunded(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event AuctionEnded(uint256 indexed auctionId, address indexed seller, address indexed winner, uint256 amount);
    event AuctionEndedWithoutSale(uint256 indexed auctionId, address indexed seller);
    event AuctionCancelled(uint256 indexed auctionId);
    event BidWithdrawn(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event BidOutbid(uint256 indexed auctionId, address indexed outbidBidder, uint256 amount);
    event TimeExtended(uint256 indexed auctionId, uint256 newEndTime);
    event MinBidIncrementChanged(uint256 newMinBidIncrement);

    /* 
    /////////////////////////////
    4. Role-Based Functionality
    /////////////////////////////

        Group functions by the roles that can call them. 
        For example, all functions that require BOOTH_ROLE should be together.
    */ 

    // Function to end an auction
    function endAuction(uint256 _auctionId) public nonReentrant onlyRole(BOOTH_ROLE) {
        SharedTypes.Auction storage auction = auctions[_auctionId];
        require(!auction.ended, "Auction has already ended");
        require(block.timestamp >= auction.endTime, "Auction is still ongoing");

        auction.ended = true;

        if (auction.highestBid >= auction.reservePrice) {
            // Ensure commission is within valid range
            require(platformCommission <= 10000, "Invalid platform commission");
            uint256 commissionAmount = auction.highestBid.mul(platformCommission).div(10000);
            require(auction.highestBid >= commissionAmount, "Commission exceeds highest bid");

            uint256 sellerAmount = auction.highestBid.sub(commissionAmount);

            // Transfer the commission and remaining funds
            payable(platformOwnerAddress).transfer(commissionAmount);
            (bool success, ) = auction.seller.call{value: sellerAmount}("");
            require(success, "Failed to transfer funds to the seller");

            ticketContract.safeTransferFrom(address(this), auction.highestBidder, auction.nftId, 1, "");

            emit AuctionEnded(_auctionId, auction.seller, auction.highestBidder, auction.highestBid);
        } else {
            ticketContract.safeTransferFrom(address(this), auction.seller, auction.nftId, 1, "");
            emit AuctionEndedWithoutSale(_auctionId, auction.seller);
        }

        totalEndedAuctions++;
        updateAuctionStatus(auction.seller, _auctionId);
    }
    // Function to withdraw funds from the Auctions contract if necessary
    function withdraw() public onlyRole(BOOTH_ROLE) {
        uint256 amount = address(this).balance;
        require(amount > 0, "No funds to withdraw");
        payable(msg.sender).transfer(amount);
    }
    // Function to extend time threshold for a bid placed in the last second
    function setTimeExtensionThreshold(uint256 _newThreshold) public onlyRole(BOOTH_ROLE) {
        require(_newThreshold > 0, "Invalid threshold");
        timeExtensionThreshold = _newThreshold;
    }
    // Function to set the minimum bid increment
    function setMinBidIncrement(uint256 _minBidIncrement) public onlyRole(BOOTH_ROLE) {
        require(_minBidIncrement > 0, "Minimum bid increment must be greater than 0");
        minBidIncrement = _minBidIncrement;
        emit MinBidIncrementChanged(_minBidIncrement);
    }
    // Add a function to update deposit percentage (only by BOOTH_ROLE)
    function setDepositPercentage(uint256 _newPercentage) public onlyRole(BOOTH_ROLE) {
        depositPercentage = _newPercentage;
    }
    // Add a function to update bid lock period (only by BOOTH_ROLE)
    function setBidLockPeriod(uint256 _newPeriod) public onlyRole(BOOTH_ROLE) {
        bidLockPeriod = _newPeriod;
    }
    // Function to update the platform commission rate
    function setPlatformCommission(uint256 _newCommission) public onlyRole(BOOTH_ROLE) {
        require(_newCommission >= 0 && _newCommission <= 10000, "Invalid commission rate");
        platformCommission = _newCommission;
    }
    // Emergency method to halt auctions if a bug is found
    function pause() public onlyRole(BOOTH_ROLE) {
        _pause();
    }
    // Emergency method to un-halt auctions if the bug is resolved
    function unpause() public onlyRole(BOOTH_ROLE) {
        _unpause();
    }

    /* 
    /////////////////////////////
    5. Auction methods
    /////////////////////////////
        
        Group together all functions related to creating auctions. 
    */ 

    // Function to create an auction
    function createAuction(
        uint256 _ticketId,
        uint256 _nftId,
        uint256 _startingPrice,
        uint256 _duration,
        uint256 _reservePrice
    ) public whenNotPaused nonReentrant isValidAuctionDuration(_duration) isNftOwner(_ticketId, _nftId) {
        uint256 auctionId = nextAuctionId;
        nextAuctionId++;

        // Transfer NFT to auction contract
        ticketContract.safeTransferFrom(msg.sender, address(this), _nftId, 1, "");

        // Initialize the Auction struct
        SharedTypes.Auction storage newAuction = auctions[auctionId];
        newAuction.seller = msg.sender;
        newAuction.ticketId = _ticketId;
        newAuction.nftId = _nftId;
        newAuction.startingPrice = _startingPrice;
        newAuction.endTime = block.timestamp.add(_duration);
        newAuction.highestBid = 0;
        newAuction.highestBidder = address(0);
        newAuction.ended = false;
        newAuction.isOpen = true;
        newAuction.reservePrice = _reservePrice;

        // No need to initialize mappings as they are already empty by default

        // Add the new auction to the user's list of auctions
        userAuctions[msg.sender].push(auctionId);

        // Add the new auction ID to the user's active auctions
        userActiveAuctions[msg.sender].push(auctionId);

        // Add to active auctions
        activeAuctionIds.push(auctionId);
        activeAuctionIndex[auctionId] = activeAuctionIds.length - 1;

        totalAuctions++;
        totalActiveAuctions++;
        // Emit the AuctionCreated event
        emit AuctionCreated(auctionId, msg.sender, _ticketId, _nftId, _startingPrice, newAuction.endTime);
    }
    // Function to cancel an auction. Only the auction creator should be able to do this
    function cancelAuction(uint256 _auctionId) 
      public 
      whenNotPaused
      nonReentrant
      isAuctionSeller(_auctionId)
      ifNoBidsArePlaced(_auctionId)
      isAuctionNotClosed(_auctionId)
    {
        SharedTypes.Auction storage auction = auctions[_auctionId];
        auction.isOpen = false;
        // Return NFT to seller
        ticketContract.safeTransferFrom(address(this), msg.sender, auction.nftId, 1, "");
        totalActiveAuctions--;
        emit AuctionCancelled(_auctionId);
    }
    // Function to place bid, it refunds the highest bidder
    function placeBid(uint256 _auctionId) 
        public
        payable
        whenNotPaused
        nonReentrant
        isOngoingAuction(_auctionId)
        isBidHigherThanCurrent(_auctionId)
        isBidHigherThanMinimum(_auctionId)
        isBidAboveMinRequired(_auctionId)
    {
        SharedTypes.Auction storage auction = auctions[_auctionId];

        // Update state before refunding to prevent reentrancy
        address previousHighestBidder = auction.highestBidder;
        uint256 previousHighestBid = auction.highestBid;

        auction.highestBid = msg.value;
        auction.highestBidder = msg.sender;

        // Refund previous highest bidder
        if (previousHighestBidder != address(0)) {
            payable(previousHighestBidder).transfer(previousHighestBid);
            emit BidRefunded(_auctionId, previousHighestBidder, previousHighestBid);
            emit BidOutbid(_auctionId, previousHighestBidder, previousHighestBid);
        }

        // Record the bid in the auction's bid history
        auctionBids[_auctionId].push(SharedTypes.Bid({
            bidder: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp
        }));

        // Extend auction time if bid is placed in the last X minutes
        if(auction.endTime.sub(block.timestamp) < timeExtensionThreshold) {
            auction.endTime = block.timestamp.add(timeExtensionThreshold);
            emit TimeExtended(_auctionId, auction.endTime);
        }

        // Update bidding history (simplified to avoid 'Stack too deep' error)
        biddingHistory[msg.sender][_auctionId] += msg.value;

        // Remove from active auctions
        removeActiveAuction(_auctionId);

        emit BidPlaced(_auctionId, msg.sender, msg.value);
    }
    // Function to withdraw bid, if user has an existing bid and it is not the leading bid
    function withdrawBid(uint256 _auctionId) 
      public
      whenNotPaused
      nonReentrant
      isNotLeadingBid(_auctionId)
      ifUserHasBid(_auctionId)
    {
        // Ensure the lock period has elapsed
        require(
            block.timestamp >= auctions[_auctionId].bidTimestamps[msg.sender] + bidLockPeriod,
            "Bid lock period has not elapsed"
        );

        uint256 bidAmount = biddingHistory[msg.sender][_auctionId];
        uint256 refundAmount = bidAmount - auctions[_auctionId].deposits[msg.sender];
        payable(msg.sender).transfer(refundAmount);

        // Emit BidWithdrawn event
        emit BidWithdrawn(_auctionId, msg.sender, refundAmount);

        // Reset the deposit for the bidder
        auctions[_auctionId].deposits[msg.sender] = 0;
    }

    /* 
    /////////////////////////////
    6. Utility Functions
    /////////////////////////////

        Include utility functions like getRemainingTime and getActiveAuctions.
    */ 


    function getAuctionInfo(uint256 _auctionId) public view returns (SharedTypes.AuctionInfo memory) {
        SharedTypes.Auction storage auction = auctions[_auctionId];
        return SharedTypes.AuctionInfo({
            seller: auction.seller,
            ticketId: auction.ticketId,
            nftId: auction.nftId,
            startingPrice: auction.startingPrice,
            endTime: auction.endTime,
            highestBid: auction.highestBid,
            highestBidder: auction.highestBidder,
            ended: auction.ended,
            isOpen: auction.isOpen,
            reservePrice: auction.reservePrice
        });
    }

    function getUserAuctions(address user) public view returns (uint256[] memory) {
        return userAuctions[user];
    }

    function getUserActiveAuctions(address user) public view returns (uint256[] memory) {
        return userActiveAuctions[user];
    }

    // function getActiveAuctions() public view returns (uint256[] memory) {
    //     return activeAuctions;
    // }

    // function getEndedAuctions() public view returns (uint256[] memory) {
    //     return endedAuctions;
    // }

    function getAuctionBids(uint256 _auctionId) public view returns (SharedTypes.Bid[] memory) {
        return auctionBids[_auctionId];
    }

    function getUserBiddingHistory(address user, uint256 auctionId) public view returns (uint256) {
        return biddingHistory[user][auctionId];
    }

    function getTotalAuctions() public view returns (uint256) {
        return nextAuctionId;
    }

    function getActiveAuctionIds() public view returns (uint256[] memory) {
        return activeAuctionIds;
    }

    function getTotalActiveAuctions() public view returns (uint256) {
        return totalActiveAuctions;
    }

    function getTotalEndedAuctions() public view returns (uint256) {
        return totalEndedAuctions;
    }

    function getTimeExtensionThreshold() public view returns (uint256) {
        return timeExtensionThreshold;
    }

    function removeActiveAuction(uint256 _auctionId) private {
        address seller = auctions[_auctionId].seller;

        // Ensure the seller has active auctions
        if (userActiveAuctions[seller].length == 0) {
            return;
        }

        // Ensure the auction ID exists in the userActiveAuctions list
        if (userAuctionIndex[seller][_auctionId] >= userActiveAuctions[seller].length || 
            (userAuctionIndex[seller][_auctionId] == 0 && userActiveAuctions[seller][0] != _auctionId)) {
            // Auction ID not found in userActiveAuctions
            return;
        }

        uint256 indexToRemove = userAuctionIndex[seller][_auctionId];
        uint256 lastIndex = userActiveAuctions[seller].length - 1;

        if (indexToRemove != lastIndex) {
            uint256 lastAuctionId = userActiveAuctions[seller][lastIndex];

            userActiveAuctions[seller][indexToRemove] = lastAuctionId;
            userAuctionIndex[seller][lastAuctionId] = indexToRemove;
        }

        userActiveAuctions[seller].pop();
        delete userAuctionIndex[seller][_auctionId];
    }

    function updateAuctionStatus(address seller, uint256 _auctionId) private {
        // Ensure the seller has active auctions
        if (userActiveAuctions[seller].length == 0) {
            return;
        }

        // Ensure the auction ID exists in the userActiveAuctions list
        if (userAuctionIndex[seller][_auctionId] >= userActiveAuctions[seller].length || 
            (userAuctionIndex[seller][_auctionId] == 0 && userActiveAuctions[seller][0] != _auctionId)) {
            // Auction ID not found in userActiveAuctions
            return;
        }

        // Remove the auction from the active auctions of the seller
        uint256 userAuctionIdx = userAuctionIndex[seller][_auctionId];
        uint256 lastUserAuctionId = userActiveAuctions[seller][userActiveAuctions[seller].length - 1];
        userActiveAuctions[seller][userAuctionIdx] = lastUserAuctionId;
        userActiveAuctions[seller].pop();
        userAuctionIndex[seller][lastUserAuctionId] = userAuctionIdx;

        // Remove the auction from the global active auctions
        uint256 auctionIdx = activeAuctionIndex[_auctionId];
        uint256 lastAuctionId = activeAuctionIds[activeAuctionIds.length - 1];
        activeAuctionIds[auctionIdx] = lastAuctionId;
        activeAuctionIds.pop();
        activeAuctionIndex[lastAuctionId] = auctionIdx;

        // Decrement the count of total active auctions
        totalActiveAuctions--;
    }


    /* 
    /////////////////////////////
    7. Modifiers
    ////////////////////////////

        Include any require statements you might want to reuse later.
    */ 

 
    modifier isValidAuctionDuration(uint256 _duration) {
        require(_duration >= 1 hours && _duration <= 4 weeks, "Invalid auction duration");
        _;
    }
    modifier isOngoingAuction(uint256 _auctionId) {
        SharedTypes.Auction storage auction = auctions[_auctionId];
        require(block.timestamp < auction.endTime, "Auction has ended");
        _;
    }
    modifier isBidHigherThanCurrent(uint256 _auctionId) {
        SharedTypes.Auction storage auction = auctions[_auctionId];
        require(msg.value > auction.highestBid, "Bid must be higher than current highest bid");
        _;
    }
    modifier isAuctionSeller(uint256 _auctionId) {
        SharedTypes.Auction storage auction = auctions[_auctionId];
        require(msg.sender == auction.seller, "Only seller can cancel");
        _;
    }
    modifier ifNoBidsArePlaced(uint256 _auctionId) {
        SharedTypes.Auction storage auction = auctions[_auctionId];
        require(auction.highestBid == 0, "Cannot cancel after bids are placed");
        _;
    }
    modifier isAuctionNotClosed(uint256 _auctionId) {
        SharedTypes.Auction storage auction = auctions[_auctionId];
        require(auction.isOpen, "Auction is already closed");
        _;
    }
    modifier isNotLeadingBid(uint256 _auctionId) {
        SharedTypes.Auction storage auction = auctions[_auctionId];
        require(auction.highestBidder != msg.sender, "Cannot withdraw leading bid");
        _;
    }
    modifier ifUserHasBid(uint256 _auctionId) {
        SharedTypes.Auction storage auction = auctions[_auctionId];
        require(biddingHistory[msg.sender][_auctionId] > 0, "No bid to withdraw");
        _;
    }
    modifier isNftOwner(uint256 _ticketId, uint256 _nftId) {
        require(ticketContract.balanceOf(msg.sender, _nftId) > 0, "Sender does not own the NFT");
        require(ticketContract.isApprovedForAll(msg.sender, address(this)), "Contract must be approved to transfer NFT");
        _;
    }
    modifier isBidHigherThanMinimum(uint256 _auctionId) {
        SharedTypes.Auction storage auction = auctions[_auctionId];
        require(msg.value >= auction.highestBid + minBidIncrement, "Bid must be higher than current highest bid by the minimum increment");
        _;
    }
    modifier isBidAboveMinRequired(uint256 _auctionId) {
        SharedTypes.Auction storage auction = auctions[_auctionId];
        uint256 minRequiredBid = auction.highestBid.add(minBidIncrement);
        require(msg.value >= minRequiredBid, "Bid not high enough");
        _;
    }

    /* 
    /////////////////////////////
    8. ERC1155 and Interface Implementations
    /////////////////////////////

        Place the ERC1155 token reception and interface support functions at the end.
    */ 

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