// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20FlashMint.sol";

/// @custom:security-contact security@boomslag.com
contract Galerium is ERC20, ERC20Burnable, Pausable,ReentrancyGuard, AccessControl, ERC20FlashMint {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor() 
    ERC20("Galerium", "GALR") 
    {        
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

    function mint(address usr, uint256 wad) public onlyRole(MINTER_ROLE) {
        _mint(usr, wad);
        emit Transfer(address(0), usr, wad);
    }

    function burn(uint256 amount) public virtual override
        whenNotPaused
        nonReentrant
     {
        require(msg.sender != address(0), "Galerium: burn from the zero address");
        require(amount > 0, "Galerium: amount must be greater than zero");
        require(balanceOf(msg.sender) >= amount, "Galerium: burn amount exceeds balance");
        require(!paused(), "Galerium: token transfer while paused");
        _burn(msg.sender, amount);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        whenNotPaused
        nonReentrant
        override
    {
        super._beforeTokenTransfer(from, to, amount);
    }

    // --- Alias ---
    function push(address usr, uint wad) external { // Sends GALR tokens to User
        transferFrom(msg.sender, usr, wad);
    }
    function pull(address usr, uint wad) external { // Pulls GALR tokens from user
        transferFrom(usr, msg.sender, wad);
    }
    function move(address src, address dst, uint wad) external { // Moves tokens From Src to Dst
        transferFrom(src, dst, wad);
    }
}