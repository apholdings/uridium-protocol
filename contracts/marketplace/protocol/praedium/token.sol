// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "./lib.sol";

/// @custom:security-contact security@boomslag.com
contract Token is ERC20Votes, Pausable, AccessControl, ReentrancyGuard, DSNote {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 public maxSupply;

    constructor(
        uint256 _maxSupply
    ) 
    ERC20("Praedium", "PDM") 
    ERC20Permit("Praedium")
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

    function stop() public note onlyRole(PAUSER_ROLE) {
        _pause();
        emit Stop();
    }

    function start() public note onlyRole(PAUSER_ROLE) {
        _unpause();
        emit Start();
    }

    function approve(address guy, uint256 wad) public virtual override returns (bool) {
        address owner = _msgSender();
        _approve(owner, guy, wad);
        emit Approval(owner, guy, wad);
        return true;
    }

    function mint(address guy, uint256 wad) note public onlyRole(MINTER_ROLE) {
        uint256 newTotalSupply = totalSupply() + wad;
        require(newTotalSupply <= maxSupply, "Exceeds max supply");
        _mint(guy, wad);
        emit Mint(guy, wad);
    }

    function burn(uint256 wad) note whenNotPaused public virtual {
        _burn(_msgSender(), wad);
        emit Burn(msg.sender, wad);
    }

    // --- Alias ---
    function push(address usr, uint wad) external { // Gives tokens from user
        transferFrom(msg.sender, usr, wad);
    }

    function pull(address usr, uint wad) external { // Pulls tokens from user
        transferFrom(usr, msg.sender, wad);
    }
    
    function move(address src, address dst, uint wad) external { // Moves tokens From Src to Dst
        transferFrom(src, dst, wad);
    }

    // The following functions are overrides required by Solidity.

    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        whenNotPaused
        nonReentrant
        override
    {
        require(to != address(0) || totalSupply() <= maxSupply, "Cannot transfer to zero address after max supply reached");

        super._beforeTokenTransfer(from, to, amount);
        emit Transfer(from, to, amount);
    }

    function _afterTokenTransfer( 
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20Votes) {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal override(ERC20Votes) {
        super._mint(to, amount);
    }
    function _burn(address account, uint256 amount) internal override(ERC20Votes) {
        super._burn(account, amount);
    }

}