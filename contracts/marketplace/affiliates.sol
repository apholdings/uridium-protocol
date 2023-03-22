// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract Affiliates is AccessControl {
    bytes32 public constant BOOTH_ROLE = keccak256("BOOTH_ROLE");

    // The percentage of the reward to be given to referrers at each level (in basis points, e.g., 1000 = 10%)
    uint256[] public referralRewardBasisPoints;

    // The mapping to store referrer addresses
    mapping(address => address) public referrers;
    
    // The maximum depth of the MLM hierarchy
    uint256 public maxDepth;

    event ReferralRewardUpdated(uint256 level, uint256 newRewardBasisPoints);

    constructor(
        uint256[] memory _referralRewardBasisPoints, 
        uint256 _maxDepth
    ) 
    {
        referralRewardBasisPoints = _referralRewardBasisPoints;
        maxDepth = _maxDepth;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BOOTH_ROLE, msg.sender);
    }

    function setReferralReward(uint256 level, uint256 newRewardBasisPoints) public onlyRole(BOOTH_ROLE) {
        referralRewardBasisPoints[level] = newRewardBasisPoints;
        emit ReferralRewardUpdated(level, newRewardBasisPoints);
    }

    function setReferrer(address user, address referrer) external onlyRole(BOOTH_ROLE) {
        referrers[user] = referrer;
    }

    function setMaxDepth(uint256 newMaxDepth) public onlyRole(BOOTH_ROLE) {
        maxDepth = newMaxDepth;
    }

    function handleAffiliateProgram(address buyer, uint256 purchasePrice) external payable {
        address currentReferrer = referrers[buyer];
        uint256 currentDepth = 0;

        while (currentReferrer != address(0) && currentDepth < maxDepth) {
            uint256 referralReward = (purchasePrice * referralRewardBasisPoints[currentDepth]) / 10000;
            payable(currentReferrer).transfer(referralReward);

            currentReferrer = referrers[currentReferrer];
            currentDepth++;
        }
    }
}