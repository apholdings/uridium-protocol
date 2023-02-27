// SPDX-License-Identifier: SPDX
pragma solidity ^0.8.9;

import "./oracle.sol";
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

    function read() public view returns (int) {
        return Oracle(oracle).read();
    }

    function peek() public view returns (uint256,bool) {
        return Oracle(oracle).peek();
    }
    
    function poke() public {
        Oracle(oracle).poke();
    }

}