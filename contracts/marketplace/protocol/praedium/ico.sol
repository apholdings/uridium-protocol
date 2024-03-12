// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
/*
    This contract handles the ICO for PDM tokens
 */

/// @custom:security-contact security@boomslag.com
contract ICO is AccessControl,ReentrancyGuard {
    using SafeMath for uint256;
    /* 
    /////////////////////////////////
    1. Role Declarations 
    /////////////////////////////////

      - Define a constant role for the INVESTOR_ROLE role

    */ 
    bytes32 public constant INVESTOR_ROLE = keccak256("INVESTOR_ROLE");
    bytes32 public constant BOOTH_ROLE = keccak256("BOOTH_ROLE");

    /* 
    /////////////////////////////
    2. Structs and State Variables
    /////////////////////////////

        - daoToken: 
        - totalTokensSold: 
        - totalInvestors: 
        - totalInvestment: 
        - startTime: 
        - endTime: 
        - tokenExchangeRate: 
        - maxIcoTokens: 
    */ 

    IERC20 public daoToken;
    uint256 public totalTokensSold;
    uint256 public totalInvestors;
    uint256 public totalInvestment;
    uint256 public startTime;
    uint256 public endTime;
    uint256 public tokenExchangeRate;
    uint256 public maxIcoTokens;
    uint256 public minInvestmentAmount;
    uint256 public maxInvestmentAmount;

    mapping (address => Investor) public investors;

    struct Investor {
        address investorAddress;
        uint256 investmentAmount;
        uint256 dateOfInvestment;
    }

    /* 
    /////////////////////////////
    3. Constructor and events
    /////////////////////////////

        The constructor initializes the contract's state.
      
        _daoToken: PDM contract address
        _maxIcoTokens: max number of tokens to be sold
    */

    constructor(
        address _daoToken, 
        uint256 _maxIcoTokens,
        uint256 _minInvestmentAmount,
        uint256 _maxInvestmentAmount,
        uint256 _startTime, 
        uint256 _endTime, 
        uint256 _tokenExchangeRate
    ) {
        daoToken = IERC20(_daoToken);
        maxIcoTokens = _maxIcoTokens; // in wei for ETH
        minInvestmentAmount = _minInvestmentAmount; // in wei for ETH
        maxInvestmentAmount = _maxInvestmentAmount; // in wei for ETH
        startTime = _startTime;
        endTime = _endTime;
        tokenExchangeRate = _tokenExchangeRate;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(INVESTOR_ROLE, msg.sender);
        _grantRole(BOOTH_ROLE, msg.sender);
    }

    event TokensPurchased(address indexed investor, uint256 ethAmount, uint256 tokenAmount);
    event InvestorRemoved(address indexed investorAddress);
    event IcoTimeSet(uint256 indexed startTime, uint256 indexed endTime);
    event Withdraw(address indexed withdrawer, uint256 amount);
    event ExchangeRateEdited(uint256 newExchangeRate);
    event InvestmentCapSet(uint256 minInvestmentAmount, uint256 maxInvestmentAmount);

    /* 
    /////////////////////////////
    4. Role-Based Functionality
    /////////////////////////////

      Group functions by the roles that can call them. 
      For example, all functions that require BOOTH_ROLE should be together.
    */ 
    function editExchangeRate(uint256 newExchangeRate) public onlyRole(DEFAULT_ADMIN_ROLE) {
        tokenExchangeRate = newExchangeRate;
        emit ExchangeRateEdited(newExchangeRate);
    }

    function setICOTime(uint256 _startTime, uint256 _endTime) public onlyRole(DEFAULT_ADMIN_ROLE) {
        startTime = _startTime;
        endTime = _endTime;

        emit IcoTimeSet(_startTime, _endTime);
    }

    function setInvestmentCaps(uint256 _minInvestmentAmount, uint256 _maxInvestmentAmount) public onlyRole(DEFAULT_ADMIN_ROLE) {
        minInvestmentAmount = _minInvestmentAmount;
        maxInvestmentAmount = _maxInvestmentAmount;
        emit InvestmentCapSet(_minInvestmentAmount, _maxInvestmentAmount);
    }

    function withdraw(address payable _to, uint256 _amount) public onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        require(_amount <= address(this).balance, "Insufficient funds in contract");
        require(_to != address(0), "Cannot withdraw to the zero address");

        // Transfer the specified amount of ETH to the given address
        (bool sent, ) = _to.call{value: _amount}("");
        require(sent, "Failed to send Ether");

        emit Withdraw(_to, _amount);
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

    /* 
    /////////////////////////////
    5. ICO Functions
    /////////////////////////////

      Include functions like buying tokens.
    */ 

    function buyTokens() public payable nonReentrant {
        require(block.timestamp >= startTime && block.timestamp <= endTime, "ICO is not active.");
        require(hasRole(INVESTOR_ROLE, msg.sender), "Investor is not whitelisted.");

        uint256 ethAmount = msg.value;

        // Ensure the investment is within the allowed limits
        require(ethAmount >= minInvestmentAmount, "Investment below minimum limit.");
        require(ethAmount <= maxInvestmentAmount, "Investment exceeds maximum limit.");

        // Adjust the calculation for tokensToBuy to reflect the new exchange rate interpretation
        // Now, exchangeRate = MATIC required for 1 PDM. So, tokensToBuy = ethAmount / exchangeRate
        // Ensure to handle division properly to account for Solidity's lack of decimal support.
        uint256 tokensToBuy = ethAmount / tokenExchangeRate;

        // Ensure the purchase does not exceed the maximum tokens available for the ICO
        require(totalTokensSold + tokensToBuy <= maxIcoTokens, "ICO token cap reached");
        
        // Transfer tokens to the buyer
        require(daoToken.transfer(msg.sender, tokensToBuy), "Failed to transfer tokens");

        // Update the total tokens sold and total investment after successful purchase
        totalTokensSold += tokensToBuy;
        totalInvestment += ethAmount;

        // Update the investor's record
        investors[msg.sender] = Investor(msg.sender, ethAmount, block.timestamp);
        totalInvestors++;

        emit TokensPurchased(msg.sender, ethAmount, tokensToBuy);
    }

    function allocateTokens(address _buyer, uint256 _tokenAmount) public onlyRole(BOOTH_ROLE) {
        require(_buyer != address(0), "Cannot allocate to the zero address");
        require(_tokenAmount > 0, "Token amount must be greater than zero");
        require(totalTokensSold + _tokenAmount <= maxIcoTokens, "Exceeds ICO token cap");
        
        // Transfer PDM tokens to the buyer
        require(daoToken.transfer(_buyer, _tokenAmount), "Failed to transfer tokens");
        
        // Update the total tokens sold
        totalTokensSold += _tokenAmount;
        
        // If the buyer is not already an investor, add them and update totals
        if (investors[_buyer].investorAddress == address(0)) {
            investors[_buyer] = Investor(_buyer, 0, block.timestamp); // Investment amount is 0 since paid by credit card
            totalInvestors++;
        }
        
        emit TokensPurchased(_buyer, 0, _tokenAmount); // Emitting 0 for ethAmount since it's a credit card transaction
    }

    /* 
    /////////////////////////////
    6. Helper Functions
    /////////////////////////////

    */ 

    function remainingTokens() public view returns (uint256) {
        return maxIcoTokens.sub(totalTokensSold);
    }

    function icoIsActive() public view returns (bool) {
        return block.timestamp >= startTime && block.timestamp <= endTime;
    }

    function investorTokenBalance(address investor) public view returns (uint256) {
        return daoToken.balanceOf(investor);
    }

    function minMaxInvestment() public view returns (uint256 minInvestment, uint256 maxInvestment) {
        return (minInvestmentAmount, maxInvestmentAmount);
    }

    function currentExchangeRate() public view returns (uint256) {
        return tokenExchangeRate;
    }

    function calculateTokenAmount(uint256 investment) public view returns (uint256) {
        require(icoIsActive(), "ICO is not active.");
        require(investment >= minInvestmentAmount && investment <= maxInvestmentAmount, "Investment out of bounds.");
        return investment / tokenExchangeRate;
    }
}