// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract BadgeSystem is ERC1155,AccessControl {
    
    struct Badge {
        uint256 id;
        string name;
        string description;
        uint256 requiredSales;
        uint256 requiredReferrals;
    }

    mapping(uint256 => Badge) public badges;
    uint256 public nextBadgeId;

    constructor(string memory _uri) ERC1155(_uri) {
    }

    function createBadge(
        string memory name, 
        string memory description, 
        uint256 requiredSales, 
        uint256 requiredReferrals
    ) external {
        Badge memory newBadge = Badge(nextBadgeId, name, description, requiredSales, requiredReferrals);
        badges[nextBadgeId] = newBadge;
        nextBadgeId++;
    }

    function mintBadge(address guy, uint256 badgeId) external {
        _mint(guy, badgeId, 1, "");
    }

    function updateBadgeMetrics(uint256 badgeId, uint256 requiredSales, uint256 requiredReferrals) external {
        badges[badgeId].requiredSales = requiredSales;
        badges[badgeId].requiredReferrals = requiredReferrals;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155,AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId) || interfaceId == type(IERC1155).interfaceId;
    }
}