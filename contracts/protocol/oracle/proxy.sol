// SPDX-License-Identifier: SPDX
pragma solidity ^0.8.9;

import "./Oracle.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";


contract Proxy is AccessControl {

    address public oracle;

    constructor()
    {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function setOracle(address _oracle) public onlyRole(DEFAULT_ADMIN_ROLE) {
        oracle = _oracle;
    }

    function getLatestEURUSDPrice() public view returns (int) {
        return Oracle(oracle).getLatestEURUSDPrice();
    }

    function getLatestETHUSDPrice() public view returns (int) {
        return Oracle(oracle).getLatestETHUSDPrice();
    }
}