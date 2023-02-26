// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MCT {
    IERC20 public token;

    constructor(address _token) {
        token = IERC20(_token);
    }

    function test(address recipient, uint256 amount) external {
        token.approve(address(this), amount);
        token.transferFrom(msg.sender, recipient, amount);
    }

    function getBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}