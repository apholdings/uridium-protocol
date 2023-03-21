// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Affiliates is Ownable {
    // The percentage of the reward to be given to referrers (in basis points, e.g., 1000 = 10%)
    uint256 public referralRewardBasisPoints;

    // The mapping to store referrer addresses
    mapping(address => address) public referrers;
    mapping(uint256 => mapping(address => address)) public courseReferrers;

    event ReferralRewardUpdated(uint256 newRewardBasisPoints);

    constructor(uint256 _referralRewardBasisPoints) {
        referralRewardBasisPoints = _referralRewardBasisPoints;
    }

    function setCourseReferrer(uint256 courseId, address user, address referrer) external onlyOwner {
        courseReferrers[courseId][user] = referrer;
    }


    function setReferralReward(uint256 newRewardBasisPoints) public onlyOwner {
        referralRewardBasisPoints = newRewardBasisPoints;
        emit ReferralRewardUpdated(newRewardBasisPoints);
    }

    function setReferrer(address user, address referrer) external onlyOwner {
        referrers[user] = referrer;
    }

    function handleAffiliateProgram(address buyer, address affiliate, uint256 purchasePrice) external payable {
        // Check if the referrer is valid and not the same as the buyer
        if (affiliate != address(0) && affiliate != buyer) {
            uint256 referralReward = (purchasePrice * referralRewardBasisPoints) / 10000;
            payable(affiliate).transfer(referralReward);
        }
    }
}