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

    constructor(
        uint256 _maxSupply
    ) 
    ERC20("Praedium", "PDM") 
    {
        maxSupply = _maxSupply;
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

    function approve(address guy, uint256 wad) public virtual override returns (bool) {
        address owner = _msgSender();
        _approve(owner, guy, wad);
        emit Approval(owner, guy, wad);
        return true;
    }

    function mint(address guy, uint256 wad) public onlyRole(MINTER_ROLE) {
        uint256 newTotalSupply = totalSupply() + wad;
        require(newTotalSupply <= maxSupply, "Exceeds max supply");
        emit Mint(guy, wad);
        _mint(guy, wad);
    }

    function burn(uint256 wad) public virtual {
        emit Burn(msg.sender, wad);
        _burn(_msgSender(), wad);
    }

    // --- Alias ---
    function push(address usr, uint wad) external {
        transferFrom(msg.sender, usr, wad);
    }

    function pull(address usr, uint wad) external { // Pulls GALR tokens from user
        transferFrom(usr, msg.sender, wad);
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
        require(to != address(0) || totalSupply() <= maxSupply, "Cannot transfer to zero address after max supply reached");

        emit Transfer(from, to, amount);
        super._beforeTokenTransfer(from, to, amount);
    }
}