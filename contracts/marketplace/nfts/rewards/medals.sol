// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/// @custom:security-contact security@boomslag.com
contract Medals is ERC1155, AccessControl, ERC1155Supply, IERC2981  {

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ROYALTY_ADMIN_ROLE = keccak256("ROYALTY_ADMIN_ROLE");
    
    // Struct for metadata of a medal
    enum Rarity {Common, Rare, Epic, Legendary}

    struct MedalInfo {
        Rarity rarity;
        string metadataURI;
        uint256 royaltyPercentage;
        uint256 edition;
    }

    mapping(uint256 => MedalInfo) private _medalInfo;
    // New state variable for tracking the last token ID used
    uint256 private _lastTokenId;

    address public royaltyReceiver;
    uint256 public royaltyPercentage;

    constructor(
        address _royaltyReceiver,
        uint256 _royaltyPercentage,
        string memory _uri
    )
    ERC1155(_uri) 
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(ROYALTY_ADMIN_ROLE, msg.sender);

        royaltyReceiver = _royaltyReceiver;
        royaltyPercentage = _royaltyPercentage;
    }

    event Mint(uint256 indexed tokenId, uint256 qty, uint256 price, address indexed guy, string uri);
    event Transfer(address indexed from, address indexed to, uint256 indexed nftId, uint256 tokenId, uint256 qty, string uri);
    event SetUri(string newuri);

    function setURI(uint256 tokenId, string memory newuri) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(exists(tokenId), "Medal does not exist.");
        _medalInfo[tokenId].metadataURI = newuri;
        emit SetUri(newuri);
    }

    function setRoyaltyInfo(address receiver, uint256 percentage) public onlyRole(ROYALTY_ADMIN_ROLE) {
        require(percentage <= 10000, "Royalty too high"); // max 100%
        royaltyReceiver = receiver;
        royaltyPercentage = percentage;
    }

    function mint(
        address guy,
        uint256 qty,
        Rarity _rarity,
        uint256 _royaltyPercentage,
        uint256 _edition
    ) public onlyRole(MINTER_ROLE) {
        uint256 newTokenId = _lastTokenId + 1;

        // Ensure the royalty percentage is within bounds
        require(_royaltyPercentage <= 10000, "Royalty too high");

        // Mint the medals
        _mint(guy, newTokenId, qty, "");

        // Construct the URI if needed or use the provided _metadataURI directly
        string memory uriConstructed = string(abi.encodePacked(super.uri(newTokenId), Strings.toString(newTokenId), ".json"));

        // Assign medal info
        _medalInfo[newTokenId] = MedalInfo({
            rarity: _rarity,
            metadataURI: uriConstructed,
            royaltyPercentage: _royaltyPercentage,
            edition: _edition
        });

        // Update the last used token ID
        _lastTokenId = newTokenId;

        emit Mint(newTokenId, qty, 0, guy, uriConstructed);
    }
    
    function mintBatch(address _to, uint256[] memory _ids, uint256[] memory _amounts, bytes memory _data)
        public
        onlyRole(DEFAULT_ADMIN_ROLE){
        // Mints a batch of NFTs to the specified address
        // _mintBatch(_to, _ids, _amounts, _data);
        // Mint Batch is Disabled in this contract
    }

    function uri(uint256 _id) public view virtual override returns (string memory) {
        // Checks if the specified token exists
        require(exists(_id),"URI: Token does not exist.");
        // Retrieves the URI for the token and appends the token ID to the end of the URI
        return string(abi.encodePacked(super.uri(_id),Strings.toString(_id), ".json" ));
    }

    function royaltyInfo(uint256 tokenId, uint256 salePrice) external view override returns (address receiver, uint256 royaltyAmount) {
        require(exists(tokenId), "Token does not exist.");
        MedalInfo memory medal = _medalInfo[tokenId];
        receiver = royaltyReceiver;
        royaltyAmount = (salePrice * medal.royaltyPercentage) / 10000;
    }

    function getMedalInfo(uint256 tokenId) public view returns (MedalInfo memory) {
        require(exists(tokenId), "Medal does not exist.");
        return _medalInfo[tokenId];
    }

    function _beforeTokenTransfer(address operator, address from, address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data)
        internal
        override(ERC1155, ERC1155Supply)
    {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    // The following functions are overrides required by Solidity.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl, IERC165)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}