// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

abstract contract BoothTypes {
    struct Purchase {
        uint256 tokenId;
        uint256 nftId;
        uint256 qty;
        uint256 price;
        uint256 timestamp;
    }
}