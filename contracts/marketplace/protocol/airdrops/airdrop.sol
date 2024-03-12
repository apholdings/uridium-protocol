// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Airdrop {
    bytes32 public merkleRoot;
    IERC20 public token;
    mapping(address => bool) public hasClaimed;

    event Claimed(address claimant, uint256 amount);

    constructor(bytes32 _merkleRoot, address _tokenAddress) {
        merkleRoot = _merkleRoot;
        token = IERC20(_tokenAddress);
    }

    function claim(uint256 _amount, bytes32[] calldata _merkleProof) external {
        require(!hasClaimed[msg.sender], "Airdrop: Drop already claimed.");
        
        // Construct the leaf node from the claimant's address and amount
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, _amount));

        // Verify the claimant's proof
        require(MerkleProof.verify(_merkleProof, merkleRoot, leaf), "Airdrop: Invalid proof.");

        // Mark as claimed and send the tokens
        hasClaimed[msg.sender] = true;
        require(token.transfer(msg.sender, _amount), "Airdrop: Transfer failed.");

        emit Claimed(msg.sender, _amount);
    }
}