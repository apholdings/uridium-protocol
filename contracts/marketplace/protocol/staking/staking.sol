// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import "../uridium/token.sol";

contract Staking is ReentrancyGuard, AccessControl, Pausable  {
    bytes32 public constant REWARD_MANAGER_ROLE = keccak256("REWARD_MANAGER_ROLE");

    IERC20 public stakedToken; // PDM (praedium)
    Uridium public rewardToken; // URI (uridium)

    struct Stake {
        uint256 amount;
        uint256 startTime;
        uint256 lastClaimTime;
        uint256 unclaimedRewards;
        bool active;
    }

    mapping(address => Stake) public stakes;
    uint256 public totalStaked;
    uint256 public rewardRate; // Annual reward rate, for simplicity's sake

    event Staked(address indexed user, uint256 amount, uint256 startTime);
    event Unstaked(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardRateChanged(uint256 newRewardRate);
    event RewardPoolIncreased(uint256 amount);
    event RewardPoolDecreased(uint256 amount);

    constructor(
        IERC20 _stakedToken, 
        Uridium _rewardToken,
        uint256 _rewardRate
    ) {
        stakedToken = _stakedToken;
        rewardToken = _rewardToken;
        rewardRate = _rewardRate;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REWARD_MANAGER_ROLE, msg.sender); // Assign the reward manager role
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function setRewardRate(uint256 _newRewardRate) external onlyRole(REWARD_MANAGER_ROLE) {
        rewardRate = _newRewardRate;
        emit RewardRateChanged(_newRewardRate);
    }

    function addToRewardPool(uint256 _amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_amount > 0, "Amount must be greater than 0");
        rewardToken.transferFrom(msg.sender, address(this), _amount);
        emit RewardPoolIncreased(_amount);
    }

    function removeFromRewardPool(uint256 _amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_amount <= viewAvailableRewardPool(), "Amount exceeds available pool");
        rewardToken.transfer(msg.sender, _amount);
        emit RewardPoolDecreased(_amount);
    }

    function viewAvailableRewardPool() public view returns (uint256) {
        return rewardToken.balanceOf(address(this)) - totalStaked; // Assuming rewardToken != stakedToken
    }

    function stake(uint256 _amount) external nonReentrant whenNotPaused {
        require(_amount > 0, "Cannot stake 0");
        stakedToken.transferFrom(msg.sender, address(this), _amount);

        Stake storage userStake = stakes[msg.sender];
        if (userStake.active) {
            userStake.amount += _amount;
        } else {
            stakes[msg.sender] = Stake({
                amount: _amount,
                startTime: block.timestamp,
                lastClaimTime: block.timestamp,
                unclaimedRewards: 0,
                active: true
            });
        }

        totalStaked += _amount;
        emit Staked(msg.sender, _amount, block.timestamp);
    }

    function unstake(uint256 _amount) external nonReentrant whenNotPaused {
        Stake storage userStake = stakes[msg.sender];
        require(userStake.active, "No active stake");
        require(userStake.amount >= _amount, "Insufficient staked amount");
        require(_amount > 0, "Amount must be greater than 0");

        userStake.amount -= _amount;
        totalStaked -= _amount;

        if (userStake.amount == 0) {
            userStake.active = false;
        }

        stakedToken.transfer(msg.sender, _amount);
        emit Unstaked(msg.sender, _amount);
    }

    function claimRewards() external nonReentrant whenNotPaused {
        require(stakes[msg.sender].active, "No active stake");
        uint256 reward = calculateReward(msg.sender);

        require(reward > 0, "No rewards to claim");

        stakes[msg.sender].lastClaimTime = block.timestamp;
        stakes[msg.sender].unclaimedRewards = 0;

        rewardToken.mint(msg.sender, reward);
        emit RewardPaid(msg.sender, reward);
    }

    function calculateReward(address _user) public view returns (uint256) {
        Stake storage userStake = stakes[_user];
        if (!userStake.active) return 0;

        uint256 timeSinceLastClaim = block.timestamp - userStake.lastClaimTime;
        uint256 reward = (userStake.amount * rewardRate * timeSinceLastClaim) / (365 days) / 100;
        return reward + userStake.unclaimedRewards;
    }

    function viewAvailableRewards(address _user) public view returns (uint256) {
        return calculateReward(_user);
    }

    function isUserStaking(address _user) public view returns (bool, uint256) {
        Stake storage userStake = stakes[_user];
        bool isStaking = userStake.active && userStake.amount > 0;
        return (isStaking, userStake.amount);
    }
}