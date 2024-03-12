// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract SharedTypes {
    struct RankCriteria {
        uint256 requiredDirectReferrals;
        uint256 requiredSalesVolume;
    }

    struct AffiliateNFTData {
        bool isAffiliated;
        address referrer; // Referrer for this specific NFT
        uint256 networkDepth; // The depth of the affiliate's network for this NFT
        uint256 totalRewards;
        uint256 pendingRewards;
        address[] referredUsers; // Users directly referred by this affiliate for this NFT
    }

    struct AffiliateData {
        address generalReferrer; // General referrer (across all NFTs)
        uint256 rank;
        uint256 directReferrals;
        uint256 salesVolume;
        mapping(uint256 => AffiliateNFTData) nftAffiliations; // NFT specific data
        // mapping(address => uint256) recruitsNetworkDepth; // General network depth of each recruit
    }
}