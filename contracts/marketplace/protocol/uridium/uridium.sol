// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20FlashMint.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

/// @custom:security-contact security@boomslag.com
contract Uridium is ERC20, ERC20Burnable, Pausable,ReentrancyGuard, AccessControl, ERC20FlashMint, ERC20Permit {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // --- EIP712 niceties ---
    bytes32 public constant PERMIT_TYPEHASH = keccak256(
        "Permit(address holder,address spender,uint256 nonce,uint256 expiry,bool allowed)"
    );

    constructor() 
    ERC20("Uridium", "URI")
    ERC20Permit("Uridium")
    {        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    event Mint(address indexed guy, uint wad);
    event Burn(address indexed guy, uint wad);
    event Stop();
    event Start();

    function stop() public onlyRole(PAUSER_ROLE) {
        _pause();
        emit Stop();
    }

    function start() public onlyRole(PAUSER_ROLE) {
        _unpause();
        emit Start();
    }

    function mint(address guy, uint256 wad) public onlyRole(MINTER_ROLE) {
        _mint(guy, wad);
        emit Transfer(address(0), guy, wad);
    }

    function burn(uint256 wad) public virtual override 
        whenNotPaused
     {
        require(msg.sender != address(0), "Uridium: burn from the zero address");
        require(wad > 0, "Uridium: amount must be greater than zero");
        require(balanceOf(msg.sender) >= wad, "Uridium: burn amount exceeds balance");
        require(!paused(), "Uridium: token transfer while paused");
        _burn(msg.sender, wad);
    }

    // --- Alias ---
    function push(address guy, uint wad) external {
        transferFrom(msg.sender, guy, wad);
    }

    function pull(address guy, uint wad) external { // Pulls GALR tokens from user
        transferFrom(guy, msg.sender, wad);
    }
    
    function move(address src, address dst, uint wad) external { // Moves tokens From Src to Dst
        transferFrom(src, dst, wad);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        whenNotPaused
        nonReentrant
        override
    {
        super._beforeTokenTransfer(from, to, amount);
    }
}