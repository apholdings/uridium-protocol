// SPDX-License-Identifier: SPDX
pragma solidity ^0.8.9;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract Oracle {

    AggregatorV3Interface internal priceFeed;

    uint256 public age; // Age of price feed
    uint256 public val; // Price median value

    event LogPrice(uint256 val, uint256 age);

    constructor(
        address _priceFeed // ETH/USD price feed contract
    )
    {
        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    function read() public view returns (int) {
        (
            /* uint80 roundID */,
            int price,
            /*uint startedAt*/,
            /*uint timeStamp*/,
            /*uint80 answeredInRound*/
        ) = priceFeed.latestRoundData();
        return price;
    }

    function peek() external view returns (uint256,bool) {
        (
            /* uint80 roundID */,
            int price,
            uint startedAt,
            uint timeStamp,
            /* uint80 answeredInRound */
        ) = priceFeed.latestRoundData();
        
        bool isRoundDataValid = (timeStamp > 0 && (block.timestamp - timeStamp) <= 300);
        uint256 roundAge = block.timestamp - startedAt;

        return (uint256(price), isRoundDataValid && roundAge <= 300);
    }

    function poke() external {
        (
            /* uint80 roundID */,
            int price,
            uint startedAt,
            uint timeStamp,
            /* uint80 answeredInRound */
        ) = priceFeed.latestRoundData();

        require((timeStamp > 0) && (block.timestamp - timeStamp) <= 300, "Oracle/invalid-price-feed");
        
        age = block.timestamp - startedAt;
        val = uint256(price);

        emit LogPrice(val, age);
    }
}