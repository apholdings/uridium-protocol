// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

// A smart contract that allows the creation and management of subscription tiers.

/// @custom:security-contact security@boomslag.com
contract Tiers is AccessControl {
    // Safemath to avoid overflows
    using SafeMath for uint256;

    // Struct representing a subscription tier.
    struct Tier {
        uint256 id;
        string name;
        uint256 period; // Subscription period in seconds (e.g., 1 week = 604800 seconds)
        uint256 price;
        uint256[] allowedNFTs;
        address seller;
    }

    // Mapping of tier ID to tier.
    mapping(uint256 => Tier) public tiers;
    // Mapping of user address to their subscribed tier ID.
    mapping(address => uint256) public userTiers;

    // The next tier ID to be used.
    uint256 private _nextTierId;

    // The address of the Ticket smart contract.
    address public ticketContract;

    // Event emitted when a new tier is created.
    event TierCreated(uint256 indexed id, string name, uint256 period, uint256 price, address indexed seller);
    // Event emitted when a tier is removed.
    event TierRemoved(uint256 indexed id);
    // Event emitted when a tier is updated.
    event TierUpdated(uint256 indexed id, string name, uint256 period, uint256 price);
    // Event emitted when an NFT is added to a tier.
    event NFTAddedToTier(uint256 indexed tierId, uint256 indexed nftId);
    // Event emitted when an NFT is removed from a tier.
    event NFTRemovedFromTier(uint256 indexed tierId, uint256 indexed nftId);
    // Event emitted when a user revokes their subscription.
    event SubscriptionRevoked(uint256 indexed tierId, address indexed buyer);

    // Constructor that sets the Ticket smart contract address and the default admin role.
    constructor(
        address _ticketContract
    ) 
    {
        ticketContract = _ticketContract;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // Function to generate the next tier ID.
    function nextTierId() internal returns (uint256) {
        return _nextTierId++;
    }

    // Function to create a new subscription tier.
    function createTier(string memory _name, uint256 _period, uint256 _price, address _seller) public onlyRole(DEFAULT_ADMIN_ROLE) {
        // Generate the tier ID.
        uint256 id = nextTierId();
        // Create the tier.
        tiers[id] = Tier(id, _name, _period, _price, new uint256[](0), _seller);
        // Emit the TierCreated event.
        emit TierCreated(id, _name, _period, _price, _seller);
    }

    // Function to remove a subscription tier.
    function removeTier(uint256 _tierId) public onlyRole(DEFAULT_ADMIN_ROLE) {
        // Delete the tier.
        delete tiers[_tierId];
        // Emit the TierRemoved event.
        emit TierRemoved(_tierId);
    }

    // Function to edit a subscription tier.
    function editTier(uint256 _tierId, string memory _name, uint256 _period, uint256 _price) public onlyRole(DEFAULT_ADMIN_ROLE) {
        // Get the tier to edit.
        Tier storage tier = tiers[_tierId];
        // Update the tier details.
        tier.name = _name;
        tier.period = _period;
        tier.price = _price;
        // Emit the TierUpdated event.
        emit TierUpdated(_tierId, _name, _period, _price);
    }

    // Function to add a NFT to a tier.
    function addNFTToTier(uint256 _tierId, uint256 _nftId) public onlyRole(DEFAULT_ADMIN_ROLE) {
        tiers[_tierId].allowedNFTs.push(_nftId);
        emit NFTAddedToTier(_tierId, _nftId);
    }

    // Function to remove a NFT from a tier.
    function removeNFTFromTier(uint256 _tierId, uint256 _nftId) public onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256[] storage nfts = tiers[_tierId].allowedNFTs;
        for (uint256 i = 0; i < nfts.length; i++) {
            if (nfts[i] == _nftId) {
                nfts[i] = nfts[nfts.length - 1];
                nfts.pop();
                emit NFTRemovedFromTier(_tierId, _nftId);
                return;
            }
        }
        revert("NFT not found in the allowed list");
    }

    // Function charge the user recurringly.
    function recurringPayment(uint256 _tierId) public payable {
        Tier storage tier = tiers[_tierId];
        require(userTiers[msg.sender] == _tierId, "User is not subscribed to this tier");
        require(msg.value >= tier.price, "Not enough funds to pay the recurring fee");

        // Transfer the funds to the seller's account
        payable(tier.seller).transfer(tier.price);
    }

    // Function to subscribe to a tier.
    function subscribeToTier(uint256 _tierId) public payable {
        Tier storage tier = tiers[_tierId];
        require(msg.value >= tier.price, "Not enough funds to subscribe to the tier");

        // Transfer the funds to the seller's account
        payable(tier.seller).transfer(tier.price);

        // Update the user's Tier ID in the userTiers mapping
        userTiers[msg.sender] = _tierId;
    }

    // Function to cancel tier subscription.
    function revokeSubscription() public {
        // Get the user's Tier ID
        uint256 tierId = userTiers[msg.sender];
        require(tierId > 0, "User is not subscribed to any tier");

        // Set the user's Tier ID to 0 to revoke their subscription
        userTiers[msg.sender] = 0;

        // Emit the SubscriptionRevoked event
        emit SubscriptionRevoked(tierId, msg.sender);
    }

    // Function to cancel tier subscription if user payment fails.
    function revokeSubscriptionForUser(address _user) public onlyRole(DEFAULT_ADMIN_ROLE) {
        // Get the user's Tier ID
        uint256 tierId = userTiers[_user];
        require(tierId > 0, "User is not subscribed to any tier");

        // Set the user's Tier ID to 0 to revoke their subscription
        userTiers[_user] = 0;

        // Emit the SubscriptionRevoked event
        emit SubscriptionRevoked(tierId, _user);
    }
}