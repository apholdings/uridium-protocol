// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/// @custom:security-contact security@boomslag.com
contract Token is ERC20, Pausable, AccessControl, ReentrancyGuard {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 public maxSupply;

    constructor(uint256 _maxSupply) 
    ERC20("Praedium", "PDM") 
    {
        _mint(msg.sender, 500000 * 10 ** decimals());
        maxSupply = _maxSupply * (10 ** decimals());
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        uint256 newTotalSupply = totalSupply() + amount;
        require(newTotalSupply <= maxSupply, "Exceeds max supply");
        _mint(to, amount);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        whenNotPaused
        nonReentrant
        override
    {
        require(to != address(0) || totalSupply() <= maxSupply, "Cannot transfer to zero address after max supply reached");
        super._beforeTokenTransfer(from, to, amount);
    }
}