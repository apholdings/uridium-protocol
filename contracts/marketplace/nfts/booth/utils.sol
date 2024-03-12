// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/AccessControl.sol";

import "./booth.sol";
import "./types.sol";

contract BoothUtils is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    Booth public booth;
    uint256 public maxPageSize = 100; // Default value

    constructor(Booth _boothContractAddress) {
        booth = _boothContractAddress;
        _setupRole(ADMIN_ROLE, msg.sender);
    }

    function setMaxPageSize(uint256 _maxPageSize) public onlyRole(ADMIN_ROLE) {
        maxPageSize = _maxPageSize;
    }

    /* 
    /////////////////////////////
    Utility Functions
    /////////////////////////////

        Include utility functions.
    */ 

    /**
     * @notice Retrieves a paginated list of purchase transactions for a specific user.
     * @param user The address of the user whose transactions are being queried.
     * @param page The page number of the paginated results.
     * @param pageSize The number of transactions per page.
     * @return results An array of purchase transactions for the specified page.
     * @return count The total number of purchase transactions for the user.
     * @dev Pagination is implemented to manage large datasets.
     */
    function getUserTransactionHistory(
        address user, 
        uint256 page, 
        uint256 pageSize
    ) 
        public 
        view 
        returns (
            BoothTypes.Purchase[] memory results, 
            uint256 count
        ) 
    {
        // Assuming a function that returns total purchase count for a user exists in Booth contract
        count = booth.getTotalPurchasesForUser(user); 
        uint256 startIndex = (page - 1) * pageSize;
        require(startIndex < count, "Start index out of range");

        if (pageSize > maxPageSize) {
            pageSize = maxPageSize;
        }

        uint256 endIndex = startIndex + pageSize > count ? count : startIndex + pageSize;
        results = new BoothTypes.Purchase[](endIndex - startIndex);

        for (uint256 i = startIndex; i < endIndex; i++) {
            // Assuming a function that returns a specific purchase for a user exists in Booth contract
            results[i - startIndex] = booth.getPurchaseForUserAtIndex(user, i); 
        }

        return (results, count);
    }

    /**
     * @notice Returns the total number of purchases made for a specific NFT.
     * @param tokenId The ID of the NFT token.
     * @return The total number of purchases for the specified NFT.
     */
    function getTotalPurchasesForNFT(uint256 tokenId) public view returns (uint256) {
        return booth.getTotalPurchasesForToken(tokenId);
    }

    /**
     * @notice Retrieves a paginated list of NFT purchases made by a specific user.
     * @param user The address of the user whose NFT purchases are being queried.
     * @param tokenId The ID of the NFT token.
     * @param page The page number of the paginated results.
     * @param pageSize The number of NFT purchases per page.
     * @return results An array of NFT purchases for the specified page.
     * @return count The total number of NFT purchases made by the user for the specified token.
     * @dev Pagination is implemented to manage large datasets.
     */
    function getUserPurchasesForNFT(address user, uint256 tokenId, uint256 page, uint256 pageSize) public view 
    returns (
        BoothTypes.Purchase[] memory results, 
        uint256 count
    ) 
    {
        count = booth.getUserPurchaseCountForToken(user, tokenId);
        uint256 startIndex = (page - 1) * pageSize;
        require(startIndex < count, "Start index out of range");

        if (pageSize > maxPageSize) {
            pageSize = maxPageSize;
        }

        uint256 endIndex = startIndex + pageSize > count ? count : startIndex + pageSize;
        results = new BoothTypes.Purchase[](endIndex - startIndex);


        for (uint256 i = startIndex; i < endIndex; i++) {
            // Assuming a function that returns a specific purchase for a user exists in Booth contract
            results[i - startIndex] = booth.getPurchaseForUserAtIndex(user, i); 
        }

        return (results, count);
    }

    /**
     * @notice Retrieves a paginated list of all purchases for a specific NFT token ID.
     * @param tokenId The ID of the NFT token.
     * @param page The page number of the paginated results.
     * @param pageSize The number of purchases per page.
     * @return results An array of purchases for the specified NFT token ID.
     * @return count The total number of purchases for the specified NFT token ID.
     * @dev Pagination is implemented to manage large datasets.
     */
    function getPurchasesByTokenId(uint256 tokenId, uint256 page, uint256 pageSize) 
        public view 
        returns (
            BoothTypes.Purchase[] memory results, 
            uint256 count
        ) 
    {
        count = booth.getTotalPurchasesForToken(tokenId); 
        uint256 startIndex = (page - 1) * pageSize;
        require(startIndex < count, "Start index out of range");

        if (pageSize > maxPageSize) {
            pageSize = maxPageSize;
        }

        uint256 endIndex = startIndex + pageSize > count ? count : startIndex + pageSize;
        results = new BoothTypes.Purchase[](endIndex - startIndex);

        for (uint256 i = startIndex; i < endIndex; i++) {
            results[i - startIndex] = booth.getPurchaseForTokenAtIndex(tokenId, i); 
        }

        return (results, count);
    }

    /**
     * @notice Extracts the year and month from a given Unix timestamp.
     * @param timestamp The Unix timestamp.
     * @return year The year extracted from the timestamp.
     * @return month The month extracted from the timestamp.
     * @dev This is a simplified calculation that may not be accurate for all months due to varying lengths.
     */
    function _extractYearAndMonthFromTimestamp(uint256 timestamp) internal pure returns (uint256, uint256) {
        uint256 secondsInMinute = 60;
        uint256 minutesInHour = 60;
        uint256 hoursInDay = 24;
        uint256 daysInYear = 365;

        uint256 secondsInHour = secondsInMinute * minutesInHour;
        uint256 secondsInDay = secondsInHour * hoursInDay;
        uint256 secondsInYear = secondsInDay * daysInYear;

        // Calculate the year by dividing the timestamp by the number of seconds in a year
        uint256 year = 1970 + timestamp / secondsInYear;

        // Calculate the number of seconds that have passed since the start of the year
        uint256 secondsSinceStartOfYear = timestamp % secondsInYear;

        // Calculate the current month by dividing the number of seconds since the start of the year by the number of seconds in a month
        // Note: This is a simplification and will not be accurate for all months due to varying lengths of months
        uint256 month = secondsSinceStartOfYear / (secondsInDay * 30) + 1;

        return (year, month);
    }
}