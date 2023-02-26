// SPDX-License-Identifier: SPDX
pragma solidity ^0.8.9;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract Oracle {

    AggregatorV3Interface internal priceFeed;
    AggregatorV3Interface internal EthUsdpriceFeed;

    constructor(
        address _priceFeed, // EUR/USD price feed contract
        address _EthUsdpriceFeed // ETH/USD price feed contract
    )
    {
        priceFeed = AggregatorV3Interface(_priceFeed);
        EthUsdpriceFeed = AggregatorV3Interface(_EthUsdpriceFeed);
    }
    
    // Get the latest EUR/USD rate
    function getLatestEURUSDPrice() public view returns (int) {
        (
            /* uint80 roundID */,
            int price,
            /*uint startedAt*/,
            /*uint timeStamp*/,
            /*uint80 answeredInRound*/
        ) = priceFeed.latestRoundData();
        return price;
    }

    // Get the latest EUR/USD rate
    function getLatestETHUSDPrice() public view returns (int) {
        (
            /* uint80 roundID */,
            int price,
            /*uint startedAt*/,
            /*uint timeStamp*/,
            /*uint80 answeredInRound*/
        ) = EthUsdpriceFeed.latestRoundData();
        return price;
    }
}