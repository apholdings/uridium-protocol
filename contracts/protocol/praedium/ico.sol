// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ICO is AccessControl,ReentrancyGuard {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant INVESTOR_ROLE = keccak256("INVESTOR_ROLE");

    IERC20 public daoToken;
    uint256 public totalInvestors;
    uint256 public totalInvestment;
    uint256 public startTime;
    uint256 public endTime;
    uint256 public tokenExchangeRate = 1000;
    uint256 public maxIcoTokens;

    mapping (address => Investor) public investors;
    mapping(address => bool) public whitelist;

    struct Investor {
        address investorAddress;
        uint256 investmentAmount;
        uint256 dateOfInvestment;
    }

    event TokensPurchased(address indexed investor, uint256 ethAmount, uint256 tokenAmount);
    event InvestorRemoved(address indexed investorAddress);
    event IcoTimeSet(uint256 indexed startTime, uint256 indexed endTime);
    event Withdraw(address indexed withdrawer, uint256 amount);
    event ExchangeRateEdited(uint256 newExchangeRate);

    constructor(address _daoToken, uint256 _maxIcoTokens) {
        daoToken = IERC20(_daoToken);
        maxIcoTokens = _maxIcoTokens;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(INVESTOR_ROLE, msg.sender);
    }

    function buyTokens() public payable nonReentrant {
        // Check if the ICO is active
        require(block.timestamp >= startTime && block.timestamp <= endTime, "ICO is not active.");
        
        // Check if the investor already exists
        // require(investors[msg.sender].investorAddress == address(0), "Investor already exists.");

        // Check if the investor is whitelisted
        require(hasRole(INVESTOR_ROLE, msg.sender), "Investor is not whitelisted.");

        uint256 ethAmount = msg.value;
        require(ethAmount >= 0.1 ether, "The investment amount must be at least 0.1 ETH");

        uint256 tokens = ethAmount * tokenExchangeRate;
        require(tokens > 0, "The investment must be greater than 0 PDM tokens");

        // Check if total tokens transferred for ICO doesn't exceed the maximum allowed
        require(tokens <= maxIcoTokens, "Maximum ICO token cap reached");

        // Add the investor to the mapping
        investors[msg.sender] = Investor(msg.sender, ethAmount, block.timestamp);
        // Emit event for InvestorAdded
        // Update the total investment
        totalInvestment += ethAmount;
        totalInvestors++;

        daoToken.transfer(msg.sender, tokens);

        emit TokensPurchased(msg.sender, ethAmount, tokens);
    }

    function removeInvestor(address _investorAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        // Check if the investor exists
        require(investors[_investorAddress].investorAddress != address(0), "Investor does not exist.");
        // Update the total investment
        totalInvestment -= investors[_investorAddress].investmentAmount;
        // Remove the investor from the mapping
        delete investors[_investorAddress];
        totalInvestors--;

        // Revoke investor role
        revokeRole(INVESTOR_ROLE, _investorAddress);

        emit InvestorRemoved(_investorAddress);
    }

    function setICOTime(uint256 _startTime, uint256 _endTime)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        startTime = _startTime;
        endTime = _endTime;

        emit IcoTimeSet(_startTime, _endTime);
    }

    function editExchangeRate(uint256 newExchangeRate) public onlyRole(DEFAULT_ADMIN_ROLE) {
        tokenExchangeRate = newExchangeRate;

        emit ExchangeRateEdited(newExchangeRate);
    }

    function addToWhitelist(address _address) public onlyRole(DEFAULT_ADMIN_ROLE) {
        whitelist[_address] = true;
        grantRole(INVESTOR_ROLE, _address);
    }

    function removeFromWhitelist(address _address) public onlyRole(DEFAULT_ADMIN_ROLE) {
        whitelist[_address] = false;
        revokeRole(INVESTOR_ROLE, _address);
    }
}