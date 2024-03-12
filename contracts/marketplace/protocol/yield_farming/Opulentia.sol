// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../uridium/token.sol";

interface IMigratorOpulentia {
    function migrate(IERC20 token) external returns (IERC20);
}

/**
 * @title Opulentia Yield Farming
 * @author Boomslag DAO
 * @notice Opulentia, the wealth creator, is not just any yield farming contract. 
 * It's like a Sith Lord of the DeFi universe, harnessing the power of the dark side of the force. 
 * But fear not, this isn't the kind of dark side that lures you into a trap. 
 * Instead, it's the kind that magically multiplies your tokens while you're busy watching Star Wars. 
 * May the yields be with you!
 */
/// @custom:security-contact security@boomslag.com
contract Opulentia is AccessControl {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /* 
    /////////////////////////////////
    1. Contract and Role Declarations 
    /////////////////////////////////

        - Define a constant role for the booth role
    */ 
    bytes32 public constant POOL_MANAGER_ROLE = keccak256("POOL_MANAGER_ROLE");

    /* 
    /////////////////////////////
    2. Structs and State Variables
    /////////////////////////////
        
        This section declares the state variables and data structures used in the contract.

    */

    // Info of each user.
    struct UserInfo {
        uint256 amount;     // How many Liquidity Provider (LP) tokens the user has supplied
        uint256 rewardDebt; // Reward debt. See explanation below.
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken;           // Address of LP token contract. Its a token linked to the pool
        uint256 allocPoint;       // Number used to set importance of this pool.
        uint256 lastRewardBlock;  // Number of block, when the reward in the pool was last calculated
        uint256 accUridiumPerShare; // How much uridium we get by one LP token we deposited in the pool. This value is multiplied by 10¹².
    }

    Uridium public uridium; // Uridium token
    address public devaddr; // address of the developer
    uint256 public bonusEndBlock; // Block number when bonus Uridium period ends.
    uint256 public uridiumPerBlock; // Uridium tokens created per block.
    uint256 public constant BONUS_MULTIPLIER = 10; // Bonus muliplier for early members.
    IMigratorOpulentia public migrator; // The migrator contract. It has a lot of power. Can only be set through governance (owner).

    PoolInfo[] public poolInfo; // Info of each pool.
    mapping(uint256 => mapping(address => UserInfo)) public userInfo; // Info of each user that stakes LP tokens.
    uint256 public totalAllocPoint = 0; // Total allocation poitns. Must be the sum of all allocation points in all pools.
    uint256 public startBlock; // The block number when Uridium mining starts.

    /* 
    /////////////////////////////
    3. Constructor and Events
    /////////////////////////////

        The constructor initializes the state of the contract with the following parameters:

        
    */

    constructor(
        Uridium _uridium,
        address _devaddr,
        uint256 _uridiumPerBlock,
        uint256 _startBlock,
        uint256 _bonusEndBlock
    ) {
        uridium = _uridium;
        devaddr = _devaddr;
        uridiumPerBlock = _uridiumPerBlock;
        bonusEndBlock = _bonusEndBlock;
        startBlock = _startBlock;
        _grantRole(POOL_MANAGER_ROLE, msg.sender);
    }

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    /* 
    /////////////////////////////
    4. Role-Based Functionality
    /////////////////////////////

        Group functions by the roles that can call them. 
        For example, all functions that require BOOTH_ROLE should be together.
    */ 

    // Update dev address by the previous dev.
    function setDev(address _devaddr) public {
        require(msg.sender == devaddr, "The Emperor is aware of your actions.");
        devaddr = _devaddr;
    }

    /**
     * @notice Add a new lp to the pool. Can only be called by the owner.
     * @param _allocPoint The number used to set the importance of the pool
     * @param _lpToken Liquidity Pool token address
     * @param _withUpdate Should update all pools or not.
     * @dev DO NOT add the same LP token more than once. Rewards will be messed up if you do.
     */
    function add(uint256 _allocPoint, IERC20 _lpToken, bool _withUpdate) public isPoolManager {
        if (_withUpdate) {
            // massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(PoolInfo({
            lpToken: _lpToken,
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            accUridiumPerShare: 0
        }));
    }

    /**
     * @notice Update the given pool's URIDIUM allocation point.
     * @param _pid Pool ID
     * @param _allocPoint The number used to set the importance of the pool
     * @param _withUpdate Should update all pools or not.
     * @dev Can only be called by the owner.
     */
    function set(uint256 _pid, uint256 _allocPoint, bool _withUpdate) public isPoolManager {
        if (_withUpdate) {
            // massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
        poolInfo[_pid].allocPoint = _allocPoint;
    }

    /**
     * @notice Set the migrator contract.
     * @param _migrator migrator interface
     * @dev Can only be called by the owner.
     */
    function setMigrator(IMigratorOpulentia _migrator) public isPoolManager {
        migrator = _migrator;
    }

    /* 
    /////////////////////////////
    5. Yield farming
    /////////////////////////////
        
        Group together all functions related to yield farming.
            
    */ 

    /**
     * @notice Deposit LP tokens to Opulentia for Uridium allocation.
     * @param _pid Pool ID
     * @param _amount Amount of tokens deposit
     */
    function deposit(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        updatePool(_pid);

        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accUridiumPerShare).div(1e12).sub(user.rewardDebt);
            if(pending > 0) {
                safeUridiumTransfer(msg.sender, pending);
            }
        }

        if(_amount > 0) {
            pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            user.amount = user.amount.add(_amount);
        }

        user.rewardDebt = user.amount.mul(pool.accUridiumPerShare).div(1e12);

        emit Deposit(msg.sender, _pid, _amount);
    }

    /**
     * @notice Withdraw LP tokens from Opulentia.
     * @param _pid Pool ID
     * @param _amount Amount of tokens to withdraw
     */
    function withdraw(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        require(user.amount >= _amount, "withdraw: not good");

        updatePool(_pid);

        uint256 pending = user.amount.mul(pool.accUridiumPerShare).div(1e12).sub(user.rewardDebt);
        
        if(pending > 0) {
            safeUridiumTransfer(msg.sender, pending);
        }

        if(_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
        }

        user.rewardDebt = user.amount.mul(pool.accUridiumPerShare).div(1e12);

        emit Withdraw(msg.sender, _pid, _amount);
    }

    /**
     * @notice Withdraw without caring about rewards.
     * @param _pid Pool ID
     * @dev Emergency use only.
     */
    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        pool.lpToken.safeTransfer(address(msg.sender), user.amount);
        emit EmergencyWithdraw(msg.sender, _pid, user.amount);
        user.amount = 0;
        user.rewardDebt = 0;
    }

    /* 
    /////////////////////////////
    6. Utility Functions
    /////////////////////////////

        Include utility functions like poolLength.
    */ 

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    /**
     * @notice Return reward multiplier over the given _from to _to block.
     * @param _from starting block
     * @param _to ending block
     * @return _multiplier returns reward multiplier
    */
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        if (_to <= bonusEndBlock) {
            return _to.sub(_from).mul(BONUS_MULTIPLIER);
        } else if (_from >= bonusEndBlock) {
            return _to.sub(_from);
        } else {
            return bonusEndBlock.sub(_from).mul(BONUS_MULTIPLIER).add(
                _to.sub(bonusEndBlock)
            );
        }
    }

    /**
     * @notice View function to see pending Uridium rewards for a user on frontend.
     * @param _pid Pool ID
     * @param _user user address
     * @return _pendingReward returns pending reward in uridium
    */
    function pendingRewards(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accUridiumPerShare = pool.accUridiumPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 uridiumReward = multiplier.mul(uridiumPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
            accUridiumPerShare = accUridiumPerShare.add(uridiumReward.mul(1e12).div(lpSupply));
        }
        return user.amount.mul(accUridiumPerShare).div(1e12).sub(user.rewardDebt);
    }

    /**
     * @notice Migrate lp token to another lp contract.
     * @param _pid Pool ID
     * @dev Can be called by anyone. We trust that migrator contract is good.
     */
    function migrate(uint256 _pid) public {
        require(address(migrator) != address(0), "migrate: no migrator");
        PoolInfo storage pool = poolInfo[_pid];
        IERC20 lpToken = pool.lpToken;
        uint256 bal = lpToken.balanceOf(address(this));
        lpToken.safeApprove(address(migrator), bal);
        IERC20 newLpToken = migrator.migrate(lpToken);
        require(bal == newLpToken.balanceOf(address(this)), "migrate: bad");
        pool.lpToken = newLpToken;
    }

    // Update reward variables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 uridiumReward = multiplier.mul(uridiumPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
        uridium.mint(devaddr, uridiumReward.div(10));
        uridium.mint(address(this), uridiumReward);
        pool.accUridiumPerShare = pool.accUridiumPerShare.add(uridiumReward.mul(1e12).div(lpSupply));
        pool.lastRewardBlock = block.number;
    }

    // Safe uridium transfer function, just in case if rounding error causes pool to not have enough URIDIUM.
    function safeUridiumTransfer(address _to, uint256 _amount) internal {
        uint256 uridiumBal = uridium.balanceOf(address(this));
        if (_amount > uridiumBal) {
            uridium.transfer(_to, uridiumBal);
        } else {
            uridium.transfer(_to, _amount);
        }
    }

    modifier isPoolManager() {
        require(hasRole(POOL_MANAGER_ROLE, msg.sender), "Caller is not a POOL_MANAGER");
        _;
    }
}