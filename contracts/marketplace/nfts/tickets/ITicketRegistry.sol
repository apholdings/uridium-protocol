// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface ITicketRegistry {
    function specialUpdateOnMint(
        address _guy, 
        uint256 _tokenId, 
        uint256 _nftId, 
        uint256 _qty, 
        uint256 _price, 
        string memory _uri
    ) external;

    function specialUpdateOnTransfer(
        address _from, 
        address _to, 
        uint256 _tokenId, 
        uint256 _nftId, 
        uint256 _qty, 
        uint256 _price, 
        string memory _uri
    ) external;

    function isCurrentlyMinting() external view returns (bool);
}