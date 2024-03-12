const { expect, assert } = require('chai');
const { ethers, network } = require('hardhat');

const moveBlocks = async (amount) => {
  for (let i = 0; i < amount; i++) {
    await network.provider.request({
      method: 'evm_mine',
      params: [],
    });
  }

  //   console.log(`Moved forward ${amount} blocks.`);
};

const moveTime = async (seconds) => {
  await network.provider.send('evm_increaseTime', [seconds]);
  //   console.log(`Moved forward ${seconds} seconds.`);
};

describe('Praedium Token Tests', function () {
  let Praedium, praedium;
  let owner, investor, uridiumFoundation, icoAddress, treasury, user;

  const initialSupply = ethers.utils.parseEther('1005577');
  const earlyInvestorsAllocation = initialSupply.mul(8).div(100);
  const uridiumFoundationAllocation = initialSupply.mul(10).div(100);
  const publicIcoAllocation = initialSupply.mul(10).div(100);
  const treasuryAllocation = initialSupply.mul(72).div(100);

  const minInvestmentAmount = ethers.utils.parseEther('1');
  const maxInvestmentAmount = ethers.utils.parseEther('900');

  // Calculate ICO start and end times
  const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds since Unix epoch
  const startTime = currentTime + 600; // ICO starts 10 minutes from "now"
  const endTime = startTime + 604800; // ICO ends 1 week after start time

  const tokenExchangeRate = 300;

  const REWARD_RATE = 1000;

  // For TimeLock
  const MIN_DELAY = 3600;
  const PROPOSERS = [];
  const EXECUTORS = [];
  // For Governor Contract
  const VOTING_DELAY = 1; // blocks
  const VOTING_PERIOD = 5; // blocks 45818 = 1 week
  const QUORUM_PERCENTAGE = 4; // percentage

  beforeEach(async function () {
    [owner, user, treasury, investor, uridiumFoundation, icoAddress] = await ethers.getSigners();

    // Deploy Uridium Contract
    Uridium = await ethers.getContractFactory('Uridium');
    uridium = await Uridium.deploy();
    await uridium.deployed();
    // Mint initial supply
    await uridium.mint(treasury.address, ethers.utils.parseEther('1000000'));

    // Deploy Praedium Contract
    Praedium = await ethers.getContractFactory('Token');
    praedium = await Praedium.deploy(initialSupply);
    await praedium.deployed();

    // Mint tokens for various allocations
    await praedium.mint(investor.address, earlyInvestorsAllocation);
    await praedium.mint(uridiumFoundation.address, uridiumFoundationAllocation);
    await praedium.mint(icoAddress.address, publicIcoAllocation);
    await praedium.mint(treasury.address, treasuryAllocation);
    // Ensure each relevant party delegates their voting power
    await praedium.connect(investor).delegate(investor.address);

    // Deploy Staking contract
    Staking = await ethers.getContractFactory('Staking');
    staking = await Staking.deploy(praedium.address, uridium.address, REWARD_RATE);
    await staking.deployed();

    // Deploy ICO Contract
    ICO = await ethers.getContractFactory('ICO');
    ico = await ICO.deploy(
      praedium.address,
      publicIcoAllocation,
      minInvestmentAmount,
      maxInvestmentAmount,
      startTime,
      endTime,
      tokenExchangeRate,
    );
    await ico.deployed();
    // Transfer PDM tokens to ICO contract from icoAddress for public sale
    await praedium.connect(icoAddress).transfer(ico.address, publicIcoAllocation);

    // Deploy Timelock, Governor and Box

    const ADMIN_ADDRESS = owner.address;
    TimeLock = await ethers.getContractFactory('TimeLock');
    timeLock = await TimeLock.deploy(MIN_DELAY, PROPOSERS, EXECUTORS, ADMIN_ADDRESS);

    GovernorContract = await ethers.getContractFactory('GovernorContract');
    governor = await GovernorContract.deploy(
      praedium.address,
      timeLock.address,
      VOTING_DELAY,
      VOTING_PERIOD,
      QUORUM_PERCENTAGE,
    );

    // Setup roles
    const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';
    const proposerRole = await timeLock.PROPOSER_ROLE();
    const executorRole = await timeLock.EXECUTOR_ROLE();
    const adminRole = await timeLock.TIMELOCK_ADMIN_ROLE();
    const proposerTx = await timeLock.grantRole(proposerRole, governor.address);
    await proposerTx.wait(1);
    const executorTx = await timeLock.grantRole(executorRole, ADDRESS_ZERO);
    await executorTx.wait(1);
    const revokeTx = await timeLock.revokeRole(adminRole, owner.address);
    await revokeTx.wait(1);

    Box = await ethers.getContractFactory('Box');
    box = await Box.deploy();
    const transferTx = await box.transferOwnership(timeLock.address);
    await transferTx.wait(1);

    // Assign minter role to relevant contracts
    const MINTER_ROLE = await uridium.MINTER_ROLE();
    await uridium.grantRole(MINTER_ROLE, staking.address);
  });

  describe('Deployment', function () {
    it('Deploy Praedium contract', async function () {
      expect(praedium.address).to.not.equal(0x0);
      expect(praedium.address).to.not.equal(null);
      expect(praedium.address).to.not.equal(undefined);
      expect(praedium.address).to.not.equal('');
    });

    it('Should retrieve the Max Supply', async () => {
      const maxSupply = await praedium.maxSupply();
      const maxSupplyInEther = ethers.utils.formatEther(maxSupply);
      // console.log('Max supply in ether:', maxSupplyInEther);
    });

    it('Should allocate to early investors, advisors, and the founding team', async () => {
      const balance = await praedium.balanceOf(investor.address);
      expect(balance).to.equal(earlyInvestorsAllocation);
    });

    it('Should allocate to the Uridium Foundation', async () => {
      const balance = await praedium.balanceOf(uridiumFoundation.address); // Replace with the address of the Uridium Foundation
      expect(balance).to.equal(uridiumFoundationAllocation);
    });

    it('Should allocate to the public ICO', async () => {
      const balance = await praedium.balanceOf(ico.address); // Replace with the address of the ICO allocation
      expect(balance).to.equal(publicIcoAllocation);
    });

    it('Should allocate 72% to the Treasury address', async () => {
      const balance = await praedium.balanceOf(treasury.address); // Replace with the address of the Praedium contract
      expect(balance).to.equal(treasuryAllocation);
    });
  });

  describe('Pausable', function () {
    it('Should pause the contract', async () => {
      // Attempt to pause the contract as the owner
      await praedium.connect(owner).stop();

      // Verify that the contract is paused
      expect(await praedium.paused()).to.equal(true);
    });

    it('Should unpause the contract', async () => {
      // Pause the contract first
      await praedium.connect(owner).stop();

      // Attempt to unpause the contract as the owner
      await praedium.connect(owner).start();

      // Verify that the contract is unpaused
      expect(await praedium.paused()).to.equal(false);
    });
  });

  describe('Transactions', function () {
    it("Should fail if sender doesn't have enough tokens", async () => {
      // Attempt to transfer more tokens than the sender's balance
      const initialOwnerBalance = await praedium.balanceOf(owner.address);
      const transferAmount = initialOwnerBalance.add(ethers.utils.parseEther('1'));
      await expect(praedium.transfer(investor.address, transferAmount)).to.be.revertedWith(
        'ERC20: transfer amount exceeds balance',
      );
    });

    it('Should update balances after transfers', async () => {
      // Transfer tokens from investor to icoAddress
      const previousIcoAddressBalance = await praedium.balanceOf(icoAddress.address);
      await praedium.connect(investor).transfer(icoAddress.address, ethers.utils.parseEther('2'));
      const icoAddressBalance = await praedium.balanceOf(icoAddress.address);

      // Check balances
      expect(icoAddressBalance).to.equal(
        previousIcoAddressBalance.add(ethers.utils.parseEther('2')),
      );
    });

    it('Should transfer from PDM contract to investor', async () => {
      // Transfer tokens from PDM contract to investor
      const previousInvestorAddressBalance = await praedium.balanceOf(investor.address);
      await praedium.connect(treasury).transfer(investor.address, ethers.utils.parseEther('2')); // Assuming 2 tokens should be transferred
      const investorAddressBalance = await praedium.balanceOf(investor.address);

      // Check balances
      expect(investorAddressBalance).to.equal(
        previousInvestorAddressBalance.add(ethers.utils.parseEther('2')),
      );
    });
  });

  describe('Allowance', function () {
    it('Should approve token transfer', async () => {
      const initialAllowance = await praedium.allowance(owner.address, investor.address);
      const amountToApprove = ethers.utils.parseEther('100'); // Approve 100 tokens
      await praedium.connect(owner).approve(investor.address, amountToApprove);

      const updatedAllowance = await praedium.allowance(owner.address, investor.address);
      expect(updatedAllowance).to.equal(amountToApprove);
    });
  });

  describe('Mint and Burn', function () {
    it("Should burn tokens from the sender's balance", async () => {
      const initialTreasuryBalance = await praedium.balanceOf(treasury.address);
      const burnAmount = ethers.utils.parseEther('50'); // Burn 50 tokens
      await praedium.connect(treasury).burn(burnAmount);

      const finalTreasuryBalance = await praedium.balanceOf(treasury.address);
      expect(finalTreasuryBalance).to.equal(initialTreasuryBalance.sub(burnAmount));
    });
  });

  describe('Push / Pull / Move', function () {
    it('Should push tokens to an address', async () => {
      const initialTreasuryBalance = await praedium.balanceOf(treasury.address);
      const initialInvestorBalance = await praedium.balanceOf(investor.address);

      const pushAmount = ethers.utils.parseEther('50'); // Push 50 tokens to the user
      // Approve the transfer
      await praedium.connect(treasury).approve(treasury.address, pushAmount);
      // Perform the push
      await praedium.connect(treasury).push(investor.address, pushAmount);

      // Check the final balances
      const finalTreasuryBalance = await praedium.balanceOf(treasury.address);
      expect(finalTreasuryBalance).to.equal(initialTreasuryBalance.sub(pushAmount));

      const finalInvestorBalance = await praedium.balanceOf(investor.address);
      expect(finalInvestorBalance).to.equal(initialInvestorBalance.add(pushAmount));
    });

    it('Should pull tokens from an address', async () => {
      // Initial balances
      const initialOwnerBalance = await praedium.balanceOf(owner.address);
      const initialInvestorBalance = await praedium.balanceOf(investor.address);
      // Define amounts
      const pullAmount = ethers.utils.parseEther('30'); // Push 50 tokens to the user
      // Approve the transfer
      await praedium.connect(investor).approve(owner.address, pullAmount);
      // Perform the pull
      await praedium.connect(owner).pull(investor.address, pullAmount);
      // Check the final balances
      const finalOwnerBalance = await praedium.balanceOf(owner.address);
      expect(finalOwnerBalance).to.equal(initialOwnerBalance.add(pullAmount));

      const finalInvestorBalance = await praedium.balanceOf(investor.address);
      expect(finalInvestorBalance).to.equal(initialInvestorBalance.sub(pullAmount));
    });

    it('Should move tokens from one address to another', async () => {
      // Initial balances
      const initialTreasuryBalance = await praedium.balanceOf(treasury.address);
      const initialInvestorBalance = await praedium.balanceOf(investor.address);

      // Define amounts
      const moveAmount = ethers.utils.parseEther('30'); // Move 30 tokens to the investor

      // Approve the transfer from treasury to investor
      await praedium.connect(treasury).approve(owner.address, moveAmount);

      // Perform the move
      // Note: The move function implementation implies the 'owner' (the caller of move)
      // has been granted allowance by 'src' (treasury) to move tokens on its behalf.
      await praedium.connect(owner).move(treasury.address, investor.address, moveAmount);

      // Check the final balances
      const finalTreasuryBalance = await praedium.balanceOf(treasury.address);
      expect(finalTreasuryBalance).to.equal(initialTreasuryBalance.sub(moveAmount));

      const finalInvestorBalance = await praedium.balanceOf(investor.address);
      expect(finalInvestorBalance).to.equal(initialInvestorBalance.add(moveAmount));
    });
  });

  describe('ICO', function () {
    async function fastForwardTimeToStart() {
      // Fast-forward time to just after the ICO's start time
      await ethers.provider.send('evm_increaseTime', [
        startTime - (await ethers.provider.getBlock('latest')).timestamp + 1,
      ]);
      await ethers.provider.send('evm_mine'); // Mine a new block for the time change to take effect
    }
    async function fastForwardTimeToEnd() {
      // Simulate ICO end
      await ethers.provider.send('evm_increaseTime', [endTime + 1]);
      await ethers.provider.send('evm_mine', []);
    }
    async function grantInvestorRole(guy) {
      const INVESTOR_ROLE = await ico.INVESTOR_ROLE();
      await ico.grantRole(INVESTOR_ROLE, guy);
    }

    it('should not allow contributions before ICO starts', async () => {
      await expect(
        ico.connect(investor).buyTokens({ value: ethers.utils.parseEther('300') }),
      ).to.be.revertedWith('ICO is not active.');
    });

    it('should not allow contributions after ICO ends', async () => {
      // Simulate ICO end
      await fastForwardTimeToEnd();

      await expect(
        ico.connect(investor).buyTokens({ value: ethers.utils.parseEther('300') }),
      ).to.be.revertedWith('ICO is not active.');
    });

    it('should reject contributions below the minimum investment amount', async () => {
      await fastForwardTimeToStart();
      await grantInvestorRole(investor.address);

      const tooLowAmount = ethers.utils.parseEther('0.5'); // Below the 1 ETH minimum
      await expect(ico.connect(investor).buyTokens({ value: tooLowAmount })).to.be.revertedWith(
        'Investment below minimum limit.',
      );
    });

    it('should reject contributions above the maximum investment amount', async () => {
      await fastForwardTimeToStart();
      await grantInvestorRole(investor.address);

      const tooHighAmount = ethers.utils.parseEther('901'); // Above the 300,000 ETH maximum
      await expect(ico.connect(investor).buyTokens({ value: tooHighAmount })).to.be.revertedWith(
        'Investment exceeds maximum limit.',
      );
    });

    it('should allocate the correct amount of tokens for a given investment', async () => {
      await fastForwardTimeToStart();
      await grantInvestorRole(investor.address);
      const investmentAmount = ethers.utils.parseEther('300'); // Example investment
      const initialInvestorBalance = await praedium.balanceOf(investor.address);
      await ico.connect(investor).buyTokens({ value: investmentAmount });
      const finalInvestorBalance = await praedium.balanceOf(investor.address);
      expect(finalInvestorBalance).to.be.above(initialInvestorBalance);
    });

    it('should apply the exchange rate correctly', async () => {
      await fastForwardTimeToStart();
      await grantInvestorRole(user.address);

      const investmentAmount = ethers.utils.parseEther('300'); // Investor sends 300 MATIC
      const expectedTokens = ethers.utils.parseEther('1'); // Expected to receive 1 PDM for every 300 MATIC

      await ico.connect(user).buyTokens({ value: investmentAmount });

      const balance = await praedium.balanceOf(user.address);
      expect(balance).to.equal(expectedTokens);
    });

    it('should allow only the owner to withdraw funds', async () => {
      await fastForwardTimeToStart();
      await grantInvestorRole(user.address);
      const investmentAmount = ethers.utils.parseEther('300'); // Investor sends 300 MATIC
      await ico.connect(user).buyTokens({ value: investmentAmount });
      await fastForwardTimeToEnd();

      const withdrawAmount = ethers.utils.parseEther('100');
      await expect(ico.connect(user).withdraw(owner.address, withdrawAmount)).to.be.reverted; // Assuming "other" is not an owner or doesn't have the correct role

      const initialBalance = await ethers.provider.getBalance(owner.address);
      await ico.connect(owner).withdraw(owner.address, withdrawAmount);

      const finalBalance = await ethers.provider.getBalance(owner.address);
      expect(finalBalance).to.be.above(initialBalance);
    });

    it('should correctly report remaining tokens', async () => {
      // Assuming initial conditions are set, and no tokens are sold yet
      const remaining = await ico.remainingTokens();
      expect(remaining).to.equal(publicIcoAllocation);
    });

    it('should accurately reflect the ICO status', async () => {
      // Before ICO starts
      expect(await ico.icoIsActive()).to.be.false;
      // Fast-forward time to during the ICO
      await fastForwardTimeToStart();
      expect(await ico.icoIsActive()).to.be.true;
      // Fast-forward time to after the ICO
      await fastForwardTimeToEnd();
      expect(await ico.icoIsActive()).to.be.false;
    });

    it('should return the correct min and max investment amounts', async () => {
      const [minInvestment, maxInvestment] = await ico.minMaxInvestment();
      expect(minInvestment).to.equal(minInvestmentAmount);
      expect(maxInvestment).to.equal(maxInvestmentAmount);
    });

    it('should return the current exchange rate', async () => {
      const rate = await ico.currentExchangeRate();
      expect(rate).to.equal(tokenExchangeRate);
    });

    it('should correctly calculate token amount for a given investment', async () => {
      // Test with a known investment amount
      await fastForwardTimeToStart();
      const investmentAmount = ethers.utils.parseEther('300'); // Use the correct unit for your contract
      const expectedTokens = investmentAmount.div(tokenExchangeRate); // Adjust based on your contract logic
      const calculatedTokens = await ico.calculateTokenAmount(investmentAmount);
      expect(calculatedTokens).to.equal(expectedTokens);
    });
  });

  describe('DAO Governance', function () {
    let proposalId;
    const newBoxValue = 42;
    const description = 'Proposal #1: Change box value to 42';
    const voteWay = 1; // for
    const reason = 'I lika do da cha cha';

    async function createProposal(governor, box, proposer, description, newBoxValue) {
      const encodedFunctionCall = box.interface.encodeFunctionData('store', [newBoxValue]);
      const targets = [box.address];
      const values = [0];
      const calldatas = [encodedFunctionCall];

      // Make sure the proposer has enough tokens to propose
      const balance = await praedium.balanceOf(proposer.address);
      if (balance.lt(ethers.utils.parseEther('1'))) {
        throw new Error('Proposer does not have enough tokens to propose');
      }

      // Create the proposal
      const tx = await governor.connect(proposer).propose(targets, values, calldatas, description);
      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === 'ProposalCreated');
      const proposalId = event.args.proposalId;

      // Verify the proposal is in the Pending state
      const proposalState = await governor.state(proposalId);
      if (proposalState !== 0) {
        // Assuming 0 corresponds to the Pending state
        throw new Error(`Proposal is not in the Pending state: state=${proposalState}`);
      }

      return { proposalId, encodedFunctionCall }; // Return the proposalId and any other data you might need
    }

    async function createProposalVotingPeriod(
      governor,
      proposer,
      description,
      newVotingPeriodValue,
    ) {
      const encodedFunctionCall = governor.interface.encodeFunctionData('setVotingPeriod', [
        newVotingPeriodValue,
      ]);
      const targets = [governor.address];
      const values = [0];
      const calldatas = [encodedFunctionCall];

      // Make sure the proposer has enough tokens to propose
      const balance = await praedium.balanceOf(proposer.address);
      if (balance.lt(ethers.utils.parseEther('1'))) {
        throw new Error('Proposer does not have enough tokens to propose');
      }

      // Create the proposal
      const tx = await governor.connect(proposer).propose(targets, values, calldatas, description);
      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === 'ProposalCreated');
      const proposalId = event.args.proposalId;

      // Verify the proposal is in the Pending state
      const proposalState = await governor.state(proposalId);
      if (proposalState !== 0) {
        // Assuming 0 corresponds to the Pending state
        throw new Error(`Proposal is not in the Pending state: state=${proposalState}`);
      }

      return { proposalId, encodedFunctionCall }; // Return the proposalId and any other data you might need
    }

    it('can only be changed through governance', async () => {
      await expect(box.store(55)).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('can create proposals', async () => {
      const description = 'Change box value';
      const newBoxValue = 42; // Example new value for the box

      // Use the helper method to create a proposal
      const { proposalId } = await createProposal(
        governor,
        box,
        investor,
        description,
        newBoxValue,
      );
      expect(proposalId).to.not.be.undefined;
      expect(await governor.state(proposalId)).to.equal(0); // Assuming 0 is the state for "Pending"
    });

    it('can change votingPeriod through a proposal', async () => {
      const description = 'Change voting period value to 10 minutes';
      const newVotingPeriodValue = 286; // Example new value for the votingPeriod

      // Check currrent voting period
      const initialVotingPeriod = await governor.votingPeriod();
      console.log('Initial Voting Period: ', initialVotingPeriod);

      // Use the helper method to create a proposal
      const { proposalId, encodedFunctionCall } = await createProposalVotingPeriod(
        governor,
        investor,
        description,
        newVotingPeriodValue,
      );
      expect(proposalId).to.not.be.undefined;
      expect(await governor.state(proposalId)).to.equal(0);

      // 2) VOTE ON PROPOSAL
      await moveBlocks(VOTING_DELAY + 1);
      const voteTx = await governor
        .connect(investor)
        .castVoteWithReason(proposalId, voteWay, reason);
      await voteTx.wait(1);
      proposalState = await governor.state(proposalId);
      assert.equal(proposalState.toString(), '1');
      await moveBlocks(VOTING_PERIOD + 1);

      // queue & execute
      const descriptionHash = ethers.utils.id(description);
      const queueTx = await governor.queue(
        [governor.address],
        [0],
        [encodedFunctionCall],
        descriptionHash,
      );
      await queueTx.wait(1);
      await moveTime(MIN_DELAY + 1);
      await moveBlocks(1);
      proposalState = await governor.state(proposalId);
      //   console.log(`Current Proposal State: ${proposalState}`);

      //   console.log('Executing...');
      const exTx = await governor.execute(
        [governor.address],
        [0],
        [encodedFunctionCall],
        descriptionHash,
      );
      await exTx.wait(1);
      const finalVotingPeriod = await governor.votingPeriod();
      console.log('Final Voting Period: ', finalVotingPeriod);

      // Assert that the final voting period is equal to the new voting period value
      // and that it's different from the initial voting period
      expect(finalVotingPeriod).to.equal(newVotingPeriodValue);
      expect(finalVotingPeriod).to.not.equal(initialVotingPeriod);

      // Alternatively, using BigNumber comparison
      expect(finalVotingPeriod.eq(ethers.BigNumber.from(newVotingPeriodValue))).to.be.true;
      expect(finalVotingPeriod.eq(initialVotingPeriod)).to.be.false;

      finalProposalState = await governor.state(proposalId);
      assert.equal(finalProposalState.toString(), '7');
    });

    it('can cast votes', async function () {
      const description = 'Change box value';
      const newBoxValue = 42; // Example new value for the box

      // Use the helper method to create a proposal
      const { proposalId } = await createProposal(
        governor,
        box,
        investor,
        description,
        newBoxValue,
      );

      await moveBlocks(VOTING_DELAY + 1);

      const voteTx = await governor
        .connect(investor)
        .castVoteWithReason(proposalId, voteWay, reason);
      await voteTx.wait(1);

      hasVoted = await governor.hasVoted(proposalId, investor.address);
      expect(hasVoted).to.be.true;
    });

    it('should not allow a user without tokens to create a proposal', async function () {
      const encodedFunctionCall = box.interface.encodeFunctionData('store', [newBoxValue]);
      const targets = [box.address];
      const values = [0];
      const calldatas = [encodedFunctionCall];

      // Attempt to create a proposal as a user without any Praedium tokens
      await expect(
        governor.connect(user).propose(targets, values, calldatas, description),
      ).to.be.revertedWith('Governor: proposer votes below proposal threshold');
    });

    it('returns the correct proposal threshold', async function () {
      // Fetch the proposal threshold from the contract
      const threshold = await governor.proposalThreshold();

      // Assuming the threshold is set to 1 PDM token (1e18 wei for a token with 18 decimals)
      const expectedThreshold = ethers.utils.parseUnits('1', 'ether'); // 'ether' assumes 18 decimal places

      // Check if the returned threshold matches the expected value
      expect(threshold).to.equal(expectedThreshold);
    });

    it('returns the correct voting delay', async function () {
      // Fetch the voting delay from the contract
      const delay = await governor.votingDelay();

      // Define the expected delay value, e.g., 1 block
      const expectedDelay = VOTING_DELAY; // Replace with your contract's configured value

      // Check if the returned delay matches the expected value
      expect(delay).to.equal(expectedDelay);
    });

    it('returns the correct voting period', async function () {
      // Fetch the voting delay from the contract
      const period = await governor.votingPeriod();

      // Define the expected delay value, e.g., 1 block
      const expectedPeriod = VOTING_PERIOD; // Replace with your contract's configured value

      // Check if the returned delay matches the expected value
      expect(period).to.equal(expectedPeriod);
    });

    it('returns the correct quorum', async function () {
      // Fetch the current block number
      const currentBlockNumber = await ethers.provider.getBlockNumber();

      // Use a block number that is guaranteed to be mined. Subtract 1 from the current block number.
      const pastBlockNumber = currentBlockNumber > 0 ? currentBlockNumber - 1 : 0;

      // Fetch the quorum for the past (or specific) block number
      const quorum = await governor.quorum(pastBlockNumber);

      // Define the expected quorum value
      // This depends on how your contract calculates quorum. For example, if your quorum is a percentage
      // of the total token supply, you need to calculate what that would be based on the current supply.
      // Assuming QUORUM_PERCENTAGE is the fraction of the total supply needed for a quorum, e.g., 4 for 4%
      // You need to calculate the expected quorum in tokens, not just use the percentage directly.
      const totalSupply = await praedium.totalSupply();
      const expectedQuorum = totalSupply.mul(QUORUM_PERCENTAGE).div(100);

      // Check if the returned quorum matches the expected value
      expect(quorum).to.equal(expectedQuorum);
    });

    it('accurately reports vote counts at a specific block number', async function () {
      const blockNumber = await ethers.provider.getBlockNumber();

      // Perform some actions that might affect voting power or wait for a block to mine if necessary
      // For example, transferring some tokens, though this specific action might not be needed
      // if you've already set up the test conditions as needed.

      // Note: You might need to wait for another block to be mined if your governance system
      // calculates votes based on past block snapshots.
      await ethers.provider.send('evm_mine'); // Mine an additional block to ensure state changes are recorded

      //   const newBlockNumber = await ethers.provider.getBlockNumber();

      // Fetch the votes for `voter` at the specific block number
      const votes = await governor.getVotes(investor.address, blockNumber);
      const investorPDMBalance = await praedium.balanceOf(investor.address);

      // Assuming the voter's entire token balance counts towards their votes
      expect(votes).to.equal(investorPDMBalance);
    });

    it('correctly reports the state of a proposal', async function () {
      const encodedFunctionCall = box.interface.encodeFunctionData('store', [newBoxValue]);
      const targets = [box.address];
      const values = [0];
      const calldatas = [encodedFunctionCall];
      const tx = await governor.connect(investor).propose(targets, values, calldatas, description);
      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === 'ProposalCreated');
      proposalId = event.args.proposalId;

      // Check the initial state of the proposal, assuming it starts as Pending
      expect(await governor.state(proposalId)).to.equal(0); // Assuming 0 corresponds to Pending

      // // Simulate progression to the next state, e.g., voting
      // // This might involve manipulating blocks/time if your testing environment allows it
      // // and performing actions like voting on the proposal
      await moveBlocks(VOTING_DELAY + 1);
      const voteTx = await governor
        .connect(investor)
        .castVoteWithReason(proposalId, voteWay, reason);
      await voteTx.wait(1);
      proposalState = await governor.state(proposalId);
      assert.equal(proposalState.toString(), '1');

      // // After actions that should change the proposal's state, check it again
      // // For example, assuming 1 corresponds to Active
      expect(await governor.state(proposalId)).to.equal(1); // Replace with actual checks for your governance model
    });

    it('executes a proposal correctly', async function () {
      // 1) CREATE PROPOSAL
      const description = 'Change box value';
      const newBoxValue = 42; // Example new value for the box

      // Use the helper method to create a proposal
      const { proposalId, encodedFunctionCall } = await createProposal(
        governor,
        box,
        investor,
        description,
        newBoxValue,
      );
      expect(proposalId).to.not.be.undefined;
      expect(await governor.state(proposalId)).to.equal(0); // Assuming 0 is the state for "Pending"

      // 2) VOTE ON PROPOSAL
      await moveBlocks(VOTING_DELAY + 1);
      const voteTx = await governor
        .connect(investor)
        .castVoteWithReason(proposalId, voteWay, reason);
      await voteTx.wait(1);
      proposalState = await governor.state(proposalId);
      assert.equal(proposalState.toString(), '1');
      //   console.log(`Current Proposal State: ${proposalState}`);
      await moveBlocks(VOTING_PERIOD + 1);

      // queue & execute
      const descriptionHash = ethers.utils.id(description);
      const queueTx = await governor.queue(
        [box.address],
        [0],
        [encodedFunctionCall],
        descriptionHash,
      );
      await queueTx.wait(1);
      await moveTime(MIN_DELAY + 1);
      await moveBlocks(1);
      proposalState = await governor.state(proposalId);
      //   console.log(`Current Proposal State: ${proposalState}`);

      //   console.log('Executing...');
      const exTx = await governor.execute(
        [box.address],
        [0],
        [encodedFunctionCall],
        descriptionHash,
      );
      await exTx.wait(1);
      const boxValue = await box.retrieve();
      assert.equal(
        boxValue.toString(),
        newBoxValue.toString(),
        'The retrieved value does not match the stored value.',
      );
      finalProposalState = await governor.state(proposalId);
      assert.equal(finalProposalState.toString(), '7');
      //   console.log(`Final Proposal State: ${finalProposalState}`);
    });

    it('marks a proposal as defeated [3] if no votes are cast and the voting period ends', async function () {
      const description = 'Change box value';
      const newBoxValue = 42; // Example new value for the box

      // Use the helper method to create a proposal
      const { proposalId } = await createProposal(
        governor,
        box,
        investor,
        description,
        newBoxValue,
      );

      await moveBlocks(VOTING_DELAY + 1);
      proposalState = await governor.state(proposalId);
      assert.equal(proposalState.toString(), '1');
      await moveBlocks(VOTING_PERIOD + 1);

      await moveTime(MIN_DELAY + 1);
      await moveBlocks(1);
      proposalState = await governor.state(proposalId);
      assert.equal(proposalState.toString(), '3');
    });

    it('marks a proposal as succeeded [4] if votes are cast and the voting period ends', async function () {
      const description = 'Change box value';
      const newBoxValue = 42; // Example new value for the box

      // Use the helper method to create a proposal
      const { proposalId } = await createProposal(
        governor,
        box,
        investor,
        description,
        newBoxValue,
      );

      await moveBlocks(VOTING_DELAY + 1);
      const voteTx = await governor
        .connect(investor)
        .castVoteWithReason(proposalId, voteWay, reason);
      await voteTx.wait(1);
      proposalState = await governor.state(proposalId);
      assert.equal(proposalState.toString(), '1');
      //   console.log(`Current Proposal State: ${proposalState}`);
      await moveBlocks(VOTING_PERIOD + 1);

      await moveTime(MIN_DELAY + 1);
      await moveBlocks(1);
      proposalState = await governor.state(proposalId);
      //   console.log(`Current Proposal State: ${proposalState}`);
      assert.equal(proposalState.toString(), '4');
    });
  });

  describe('Staking', function () {
    it('should be able to set reward rate', async () => {
      await staking.connect(owner).setRewardRate(5000);
      const rewardRate = await staking.rewardRate();
      expect(rewardRate).to.equal(5000);
    });
    it('should be able to stake', async () => {
      const amountToApprove = ethers.utils.parseEther('100');
      const amountToStake = ethers.utils.parseEther('50');
      await praedium.connect(investor).approve(staking.address, amountToApprove);
      await staking.connect(investor).stake(amountToStake);

      // Call the isUserStaking function to check if the investor is staking and the amount they have staked
      const [isStaking, stakedAmount] = await staking.isUserStaking(investor.address);

      // Validate that the investor is indeed staking
      expect(isStaking).to.be.true;

      // Validate that the staked amount matches the amount we sent in
      expect(stakedAmount).to.equal(amountToStake);
    });
    // it('should be able to unstake along with rewards', async () => {
    //   const amountToApprove = ethers.utils.parseEther('100');
    //   const amountToStake = ethers.utils.parseEther('50');
    //   await praedium.connect(investor).approve(staking.address, amountToApprove);
    //   await staking.connect(investor).stake(amountToStake);
    //   // Fast forward time by 365 days
    //   const secondsInYear = 365 * 24 * 60 * 60;
    //   await moveTime(secondsInYear);
    //   await moveBlocks(1); // Mine at least one block to process the time leap
    //   // Capture the investor's URI balance before unstaking
    //   const initialURIBalance = await uridium.balanceOf(investor.address);
    //   // Perform unstake operation
    //   await staking.connect(investor).unstake(amountToStake);
    //   // Capture the investor's URI balance after unstaking
    //   const finalURIBalance = await uridium.balanceOf(investor.address);
    //   expect(finalURIBalance).to.be.above(initialURIBalance);

    //   // // Assuming the reward rate and calculation logic to determine the expected reward
    //   // const expectedReward = calculateExpectedReward(amountToStake, secondsInYear); // You need to define this based on your reward calculation logic

    //   // // Verify that the investor's URI balance has increased by the expected reward amount
    //   // expect(finalURIBalance.sub(initialURIBalance)).to.equal(expectedReward);
    // });
    it('should be able to calculate rewards', async () => {
      const amountToApprove = ethers.utils.parseEther('1000');
      const amountToStake = ethers.utils.parseEther('500');
      await praedium.connect(investor).approve(staking.address, amountToApprove);
      await staking.connect(investor).stake(amountToStake);

      // Fast forward time by 365 days
      const secondsInYear = 365 * 24 * 60 * 60;
      await moveTime(secondsInYear);
      await moveBlocks(1);
      // Calculate the expected reward
      const expectedReward = await staking.calculateReward(investor.address);
      // Convert the expected reward from Wei to Ether for logging
      const expectedRewardInEther = ethers.utils.formatEther(expectedReward);
      console.log(`Expected Reward in Ether after 365 days: ${expectedRewardInEther}`);
    });
    it('should be able to claim rewards', async () => {
      const amountToApprove = ethers.utils.parseEther('100');
      const amountToStake = ethers.utils.parseEther('50');
      await praedium.connect(investor).approve(staking.address, amountToApprove);
      await staking.connect(investor).stake(amountToStake);

      // Fast forward time by 365 days
      const secondsInYear = 365 * 24 * 60 * 60;
      await moveTime(secondsInYear);
      await moveBlocks(1);
      // Capture the investor's URI balance before unstaking
      const initialURIBalance = await uridium.balanceOf(investor.address);
      // Perform unstake operation
      await staking.connect(investor).claimRewards();
      // Capture the investor's URI balance after unstaking
      const finalURIBalance = await uridium.balanceOf(investor.address);
      expect(finalURIBalance).to.be.above(initialURIBalance);
    });
    it('should be able to view available rewards', async () => {
      const amountToApprove = ethers.utils.parseEther('100');
      const amountToStake = ethers.utils.parseEther('50');
      await praedium.connect(investor).approve(staking.address, amountToApprove);
      await staking.connect(investor).stake(amountToStake);

      // Fast forward time by 365 days
      const secondsInYear = 365 * 24 * 60 * 60;
      await moveTime(secondsInYear);
      await moveBlocks(1);

      // Calculate the expected reward
      const expectedReward = await staking.calculateReward(investor.address);
      const availableReward = await staking.viewAvailableRewards(investor.address);
      expect(availableReward).to.equal(expectedReward);
    });
  });
});
