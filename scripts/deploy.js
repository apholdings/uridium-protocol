const { ethers } = require('hardhat');
const web3 = require('web3');

// Function for a delay using a Promise
async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

async function countdownWithAnimation(seconds) {
  var P = ['\\', '|', '/', '-'];
  var x = 0;
  var intervalId = setInterval(function () {
    process.stdout.write(
      `\r${P[x++]} Starting Etherscan verification... ${seconds} seconds remaining`,
    );
    x &= 3;
  }, 250);
  while (seconds > 0) {
    await sleep(1000);
    seconds--;
  }
  clearInterval(intervalId);
  process.stdout.write('\n');
}

// This function fetches the current recommended gas price
async function getCurrentGasPrice(provider) {
  const currentGasPrice = await provider.getGasPrice();
  // Increase the gas price by 20% to prioritize this transaction
  const increasedGasPrice = currentGasPrice.mul(120).div(100);
  return increasedGasPrice;
}

const getBalance = async (deployer) => {
  return web3.utils.fromWei((await deployer.getBalance()).toString(), 'ether');
};

const polygonUrl = 'https://mumbai.polygonscan.com/address';

let affiliates;
let affiliate_utils;
let auctions;
let auction_utils;
let booth;
let booth_utils;
let ticket_registry;
let ticket;
let uridium;
let praedium;
let staking;
let ico;
let timeLock;
let governor;
let box;
let medals;

const deployTicketRegistry = true;
const deployTicket = true;
const deployAffiliates = true;
const deployAffiliateUtils = true;
const deployAuctions = true;
const deployAuctionUtils = true;
const deployBooth = true;
const deployBoothUtils = true;
/////////////////////////////////
const deployUridium = true;
const deployPraedium = true;
// Liquidity
const deployStaking = true;
const deployIco = true;
// Governance
const deployTimeLock = true;
const deployGovernor = true;
const deployBox = true;
const setupTimelockRoles = true;
// medal
const deployMedals = true;

async function main() {
  const [deployer] = await ethers.getSigners();

  let investor = '0x1a76b300E3d5513d9F5D4BEEDF101c1DdA141091'; // 80,446
  let uridiumFoundation = '0xF9D3E93c5C14Cbdbe8354C7F79C4316d51E4d6f4'; // 100,557
  let icoAddress = '0x740fFB7686c793259cd6f1e95388f95717a32B16'; // 100,557
  let treasury = '0xf3CC6a922e762727c82444E2f10D7F37839f9c10';

  const initialSupply = ethers.utils.parseEther('1005577');
  const earlyInvestorsAllocation = initialSupply.mul(8).div(100);
  const uridiumFoundationAllocation = initialSupply.mul(10).div(100);
  const publicIcoAllocation = initialSupply.mul(10).div(100);
  const treasuryAllocation = initialSupply.mul(72).div(100);

  const gasPrice = await getCurrentGasPrice(deployer.provider);
  // const gasLimit = await estimateGasLimitWithBuffer(contract, 'mint', [recipient, amount]);

  const grantRoleGasPrice = await deployer.provider.getGasPrice();
  const increasedGrantRoleGasPrice = grantRoleGasPrice.add(ethers.BigNumber.from('1000000000')); // Add 1 Gwei to the current gas price

  console.log('Deploying contracts with the account:', deployer.address);

  const initialBalance = await getBalance(deployer);
  console.log('Account balance previous to Deployment:', initialBalance);

  /**
   * @info Deployment script for the Ticket Registry Contract.
   * @params No params required
   */
  if (deployTicketRegistry) {
    console.log(`
    ================ Deploying: Ticket Registry Contract ================  
    `);
    const TicketRegistry = await ethers.getContractFactory('TicketRegistry');

    console.log('Creating the contract instance...');
    ticket_registry = await TicketRegistry.deploy({
      gasPrice: gasPrice,
      // gasLimit: gasLimit,
    });
    console.log(`Contract instance created. Address: ${ticket_registry.address}`);

    console.log('Awaiting deployment transaction receipt...');
    const ticket_registry_receipt = await ticket_registry.deployTransaction.wait();
    console.log('Deployment transaction receipt received.');

    console.log(`
      
      Ticket Registry contract deployed to: ${polygonUrl}/${ticket_registry.address}
      Transaction hash: ${ticket_registry_receipt.transactionHash}
      Gas used: ${web3.utils.fromWei(ticket_registry_receipt.gasUsed.toString(), 'ether')}
    
    `);

    // Add a delay with a countdown timer
    await countdownWithAnimation(120);
    await hre.run('verify:verify', {
      address: ticket_registry.address,
      contract: 'contracts/marketplace/nfts/tickets/registry.sol:TicketRegistry',
      constructorArguments: [],
    });

    await ticket_registry.grantRole(await ticket_registry.BOOTH_ROLE(), deployer.address, {
      gasPrice: increasedGrantRoleGasPrice,
    });
  }

  /**
   * @info Deployment script for the Ticket Contract. This script deploys a new Ticket Contract
   *      to the blockchain with specified parameters such as NFT ID, price, royalty information, and URI.
   *      It also handles Etherscan verification post-deployment.
   * @params
   *      - nftId: The unique identifier for the NFT.
   *      - nftPrice: The price of the NFT in Ether.
   *      - initialStock: The initial stock quantity of the NFT.
   *      - useStock: Flag to indicate whether to use stock management.
   *      - limitedEdition: Flag to indicate if the NFT is a limited edition.
   *      - royaltyReceiver: Address to receive the royalties.
   *      - royaltyPercentage: The royalty percentage in basis points.
   *      - platformAddress: The address of the platform owner.
   *      - uri: The base URI for the NFT metadata.
   */
  if (deployTicket) {
    console.log(`
    ================ Deploying: Ticket Contract ================
    `);
    const Ticket = await ethers.getContractFactory('Ticket');

    const platformAddress = deployer.address;
    const royaltyReceiver = uridiumFoundation;

    const nftPrice = ethers.utils.parseEther('0.01');
    const royaltyPercentage = 500; // 5% represented in basis points (100 basis points = 1%)
    const initialStock = 30;
    const nftId = 1;
    const useStock = false;
    const limitedEdition = false;
    const uri = 'https://api.boomslag.com/api/courses/nft/';

    console.log('Creating the contract instance...');
    ticket = await Ticket.deploy(
      nftId,
      nftPrice,
      initialStock,
      useStock,
      limitedEdition,
      royaltyReceiver,
      royaltyPercentage,
      [platformAddress, royaltyReceiver],
      [40, 60],
      uri,
      ticket_registry.address,
      {
        gasPrice: gasPrice,
        // gasLimit: gasLimit,
      },
    );
    console.log(`Contract instance created. Address: ${ticket.address}`);

    console.log('Awaiting deployment transaction receipt...');
    const receipt = await ticket.deployTransaction.wait();
    console.log('Deployment transaction receipt received.');

    console.log(`
  
      Ticket contract deployed to: ${polygonUrl}/${ticket.address}
      Transaction hash: ${receipt.transactionHash}
      Gas used: ${web3.utils.fromWei(receipt.gasUsed.toString(), 'ether')}
  
    `);

    await countdownWithAnimation(120);

    await hre.run('verify:verify', {
      address: ticket.address,
      contract: 'contracts/marketplace/nfts/tickets/ticket.sol:Ticket',
      constructorArguments: [
        nftId,
        nftPrice,
        initialStock,
        useStock,
        limitedEdition,
        royaltyReceiver,
        royaltyPercentage,
        [platformAddress, royaltyReceiver],
        [40, 60],
        uri,
        ticket_registry.address,
      ],
    });

    // Grant BOOTH_ROLE to the booth contract in the Ticket contract
    await ticket.grantRole(await ticket.BOOTH_ROLE(), deployer.address, {
      gasPrice: increasedGrantRoleGasPrice,
    });
  }

  /**
   * @info deploy the affiliats contract
   * @params
   */
  if (deployAffiliates) {
    console.log(`
    ================ Deploying: Affiliates Contract ================
    `);
    const Affiliates = await ethers.getContractFactory('Affiliates');

    const maxReferralDepth = 5;
    const referralRewardBasisPointsArray = [
      [1000, 1050, 1100, 1150, 1200], // Level 1: Bronze 10%, Silver 10.5%, Gold 11%, Platinum 11.5%, Diamond 12%
      [800, 850, 900, 950, 1000], // Level 2: Bronze 8%, Silver 8.5%, Gold 9%, Platinum 9.5%, Diamond 10%
      [600, 650, 700, 750, 800], // Level 3: Bronze 6%, Silver 6.5%, Gold 7%, Platinum 7.5%, Diamond 8%
      [400, 450, 500, 550, 600], // Level 4: Bronze 4%, Silver 4.5%, Gold 5%, Platinum 5.5%, Diamond 6%
      [200, 250, 300, 350, 400], // Level 5: Bronze 2%, Silver 2.5%, Gold 3%, Platinum 3.5%, Diamond 4%
    ];

    // Define the rank criteria
    const rankCriteriasArray = [
      { requiredDirectReferrals: 3, requiredSalesVolume: ethers.utils.parseEther('25') },
      { requiredDirectReferrals: 7, requiredSalesVolume: ethers.utils.parseEther('60') },
      { requiredDirectReferrals: 15, requiredSalesVolume: ethers.utils.parseEther('120') },
      { requiredDirectReferrals: 30, requiredSalesVolume: ethers.utils.parseEther('250') },
      { requiredDirectReferrals: 50, requiredSalesVolume: ethers.utils.parseEther('400') },
    ];

    console.log('Creating the contract instance...');
    affiliates = await Affiliates.deploy(
      referralRewardBasisPointsArray,
      rankCriteriasArray,
      maxReferralDepth,
      ticket_registry.address,
      {
        gasPrice: gasPrice,
        // gasLimit: gasLimit,
      },
    );
    console.log(`Contract instance created. Address: ${affiliates.address}`);

    console.log('Awaiting deployment transaction receipt...');
    const affiliatesReceipt = await affiliates.deployTransaction.wait();
    console.log('Deployment transaction receipt received.');

    console.log(`
    
      Affiliates contract deployed to: ${polygonUrl}/${affiliates.address}
      Transaction hash: ${affiliatesReceipt.transactionHash}
      Gas used: ${web3.utils.fromWei(affiliatesReceipt.gasUsed.toString(), 'ether')}
    
    `);

    await countdownWithAnimation(120);
    await hre.run('verify:verify', {
      address: affiliates.address,
      contract: 'contracts/marketplace/nfts/affiliates/affiliates.sol:Affiliates',
      constructorArguments: [
        referralRewardBasisPointsArray,
        rankCriteriasArray,
        maxReferralDepth,
        ticket_registry.address,
      ],
    });

    // Grant BOOTH_ROLE to the booth contract in the Affiliates contract
    await affiliates.grantRole(await affiliates.BOOTH_ROLE(), deployer.address, {
      gasPrice: increasedGrantRoleGasPrice,
    });
  }

  /**
   * @info deploy the affiliate utils contract
   * @params
   */
  if (deployAffiliateUtils) {
    console.log(`
    ================ Deploying: Affiliate Utils Contract ================
    `);

    const AffiliateUtils = await ethers.getContractFactory('AffiliateUtils');

    console.log('Creating the contract instance...');
    affiliate_utils = await AffiliateUtils.deploy(affiliates.address, {
      gasPrice: gasPrice,
      // gasLimit: gasLimit,
    });
    console.log(`Contract instance created. Address: ${affiliate_utils.address}`);

    console.log('Awaiting deployment transaction receipt...');
    const affiliate_utils_receipt = await affiliate_utils.deployTransaction.wait();
    console.log('Deployment transaction receipt received.');

    console.log(`
    
      Affiliate Utils contract deployed to: ${polygonUrl}/${affiliate_utils.address}
      Transaction hash: ${affiliate_utils_receipt.transactionHash}
      Gas used: ${web3.utils.fromWei(affiliate_utils_receipt.gasUsed.toString(), 'ether')}
    
    `);

    await countdownWithAnimation(120);
    await hre.run('verify:verify', {
      address: affiliate_utils.address,
      contract: 'contracts/marketplace/nfts/affiliates/utils.sol:AffiliateUtils',
      constructorArguments: [affiliates.address],
    });
  }

  /**
   * @info deploy the auctions contract
   * @params
   */
  if (deployAuctions) {
    console.log(`
    ================ Deploying: Auctions Contract ================
    `);

    const Auctions = await ethers.getContractFactory('Auctions');

    const timeExtensionThreshold = 300; // 5 minutes in seconds
    // const initialMinBidIncrement = 10**18; // 1 MATIC in wei
    const initialMinBidIncrement = ethers.utils.parseEther('1.0'); // 1 MATIC
    const depositPercentage = 500;
    const bidLockPeriod = 300; // 5 minutes in seconds
    const platformCommission = 500; // 5% represented in basis points

    console.log('Creating the contract instance...');
    auctions = await Auctions.deploy(
      ticket.address,
      ticket_registry.address,
      timeExtensionThreshold,
      initialMinBidIncrement,
      depositPercentage,
      bidLockPeriod,
      platformCommission,
      {
        gasPrice: gasPrice,
        // gasLimit: gasLimit,
      },
    );
    console.log(`Contract instance created. Address: ${auctions.address}`);

    console.log('Awaiting deployment transaction receipt...');
    const auctionReceipt = await auctions.deployTransaction.wait();
    console.log('Deployment transaction receipt received.');

    // Grant Booth Role

    console.log(`
    
      Auctions contract deployed to: ${polygonUrl}/${auctions.address}
      Transaction hash: ${auctionReceipt.transactionHash}
      Gas used: ${web3.utils.fromWei(auctionReceipt.gasUsed.toString(), 'ether')}
  
    `);

    await countdownWithAnimation(120);

    await hre.run('verify:verify', {
      address: auctions.address,
      contract: 'contracts/marketplace/nfts/auctions/auctions.sol:Auctions',
      constructorArguments: [
        ticket.address,
        ticket_registry.address,
        timeExtensionThreshold,
        initialMinBidIncrement,
        depositPercentage,
        bidLockPeriod,
        platformCommission,
      ],
    });

    await auctions.grantRole(await auctions.BOOTH_ROLE(), deployer.address, {
      gasPrice: increasedGrantRoleGasPrice,
    });
  }

  /**
   * @info deploy the auction utils contract
   * @params
   */
  if (deployAuctionUtils) {
    console.log(`
    ================ Deploying: Auction Utils Contract ================
    `);

    const AuctionUtils = await ethers.getContractFactory('AuctionUtils');

    console.log('Creating the contract instance...');
    auction_utils = await AuctionUtils.deploy(
      auctions.address, //auctions.address,
      {
        gasPrice: gasPrice,
        // gasLimit: gasLimit,
      },
    );
    console.log(`Contract instance created. Address: ${auction_utils.address}`);

    console.log('Awaiting deployment transaction receipt...');
    const auction_utils_receipt = await auction_utils.deployTransaction.wait();
    console.log('Deployment transaction receipt received.');

    console.log(`
    
      Auction Utils contract deployed to: ${polygonUrl}/${auction_utils.address}
      Transaction hash: ${auction_utils_receipt.transactionHash}
      Gas used: ${web3.utils.fromWei(auction_utils_receipt.gasUsed.toString(), 'ether')}
    
    `);

    await countdownWithAnimation(120);
    await hre.run('verify:verify', {
      address: auction_utils.address,
      contract: 'contracts/marketplace/nfts/auctions/utils.sol:AuctionUtils',
      constructorArguments: [
        auctions.address, //auctions.address,
      ],
    });
  }

  /**
   * @info deploy the booth contract
   * @params
   */
  if (deployBooth) {
    console.log(`
    ================ Deploying: Booth Contract ================
    `);

    const commissionPercentage = 25;
    const Booth = await ethers.getContractFactory('Booth');

    console.log('Creating the contract instance...');
    booth = await Booth.deploy(affiliates.address, commissionPercentage, ticket_registry.address, {
      gasPrice: gasPrice,
      // gasLimit: gasLimit,
    });
    console.log(`Contract instance created. Address: ${booth.address}`);

    console.log('Awaiting deployment transaction receipt...');
    const boothReceipt = await booth.deployTransaction.wait();
    console.log('Deployment transaction receipt received.');

    console.log(`
    
      Booth contract deployed to: ${polygonUrl}/${booth.address}
      Transaction hash: ${boothReceipt.transactionHash}
      Gas used: ${web3.utils.fromWei(boothReceipt.gasUsed.toString(), 'ether')}
      
    `);

    await countdownWithAnimation(120);
    await hre.run('verify:verify', {
      address: booth.address,
      contract: 'contracts/marketplace/nfts/booth/booth.sol:Booth',
      constructorArguments: [affiliates.address, commissionPercentage, ticket_registry.address],
    });
  }

  /**
   * @info deploy the booth utils contract
   * @params
   */
  if (deployBoothUtils) {
    console.log(`
    ================ Deploying: Booth Utils Contract ================
    `);
    const BoothUtils = await ethers.getContractFactory('BoothUtils');

    console.log('Creating the contract instance...');
    booth_utils = await BoothUtils.deploy(booth.address, {
      gasPrice: gasPrice,
      // gasLimit: gasLimit,
    });
    console.log(`Contract instance created. Address: ${booth.address}`);
    console.log('Awaiting deployment transaction receipt...');
    const boothUtilsReceipt = await booth_utils.deployTransaction.wait();
    console.log('Deployment transaction receipt received.');

    console.log(`
    
      Booth Utils contract deployed to: ${polygonUrl}/${booth_utils.address}
      Transaction hash: ${boothUtilsReceipt.transactionHash}
      Gas used: ${boothUtilsReceipt.gasUsed.toString()}
      MATIC Cost: ${web3.utils.fromWei(boothUtilsReceipt.gasUsed.toString(), 'ether')}
    
    `);

    await countdownWithAnimation(120);
    await hre.run('verify:verify', {
      address: booth_utils.address,
      contract: 'contracts/marketplace/nfts/booth/utils.sol:BoothUtils',
      constructorArguments: [booth.address],
    });
  }

  /**
   * @info deploy Uridium contract
   * @params
   */
  if (deployUridium) {
    console.log(`
    ================ Deploying: Uridium Contract ================
    `);
    const mintAmount = ethers.utils.parseUnits('1000000', 'ether'); // 'ether' unit here represents 1 token = 10^18 of its smallest unit
    const Uridium = await ethers.getContractFactory('Uridium');
    console.log('Creating the contract instance...');
    uridium = await Uridium.deploy({
      gasPrice: gasPrice,
      // gasLimit: gasLimit,
    });
    console.log(`Contract instance created. Address: ${uridium.address}`);

    console.log('Awaiting deployment transaction receipt...');
    const uridiumReceipt = await uridium.deployTransaction.wait();
    console.log('Deployment transaction receipt received.');

    console.log(`
    
      Uridium contract deployed to: ${polygonUrl}/${uridium.address}
      Transaction hash: ${uridiumReceipt.transactionHash}
      Gas used: ${uridiumReceipt.gasUsed.toString()}
      MATIC Cost: ${web3.utils.fromWei(uridiumReceipt.gasUsed.toString(), 'ether')}
    
    `);

    await countdownWithAnimation(120);
    await hre.run('verify:verify', {
      address: uridium.address,
      contract: 'contracts/marketplace/protocol/uridium/token.sol:Uridium',
      constructorArguments: [],
    });

    // Minting 1,000,000 tokens to the deployer's address
    console.log(`Minting 1,000,000 tokens to deployer's address: ${deployer.address}`);
    await uridium.mint(deployer.address, mintAmount, {
      gasPrice: gasPrice,
      // gasLimit: gasLimit,
    });
    console.log('Minting complete.');
  }

  if (deployPraedium) {
    console.log(`
    ================ Deploying: Praedium Contract ================
    `);

    const Praedium = await ethers.getContractFactory('Token');
    console.log('Creating the contract instance...');
    praedium = await Praedium.deploy(initialSupply, {
      gasPrice: gasPrice,
      // gasLimit: gasLimit,
    });
    console.log(`Contract instance created. Address: ${praedium.address}`);

    console.log('Awaiting deployment transaction receipt...');
    const praediumReceipt = await praedium.deployTransaction.wait();
    console.log('Deployment transaction receipt received.');

    console.log(`
      Praedium contract deployed to: ${polygonUrl}/${praedium.address}
      Transaction hash: ${praediumReceipt.transactionHash}
      Gas used: ${praediumReceipt.gasUsed.toString()}
      MATIC Cost: ${web3.utils.fromWei(praediumReceipt.gasUsed.toString(), 'ether')}
    `);

    await countdownWithAnimation(120);
    await hre.run('verify:verify', {
      address: praedium.address,
      contract: 'contracts/marketplace/protocol/praedium/token.sol:Token',
      constructorArguments: [initialSupply],
    });

    await praedium.mint(investor, earlyInvestorsAllocation, {
      gasPrice: gasPrice,
      // gasLimit: gasLimit,
    });
    await praedium.mint(uridiumFoundation, uridiumFoundationAllocation, {
      gasPrice: gasPrice,
      // gasLimit: gasLimit,
    });
    await praedium.mint(icoAddress, publicIcoAllocation, {
      gasPrice: gasPrice,
      // gasLimit: gasLimit,
    });
    await praedium.mint(treasury, treasuryAllocation, {
      gasPrice: gasPrice,
      // gasLimit: gasLimit,
    });
    console.log('Minting complete.');
  }

  if (deployStaking) {
    console.log(`
      ================ Deploying: Staking Contract ================
      `);

    const Staking = await ethers.getContractFactory('Staking');
    console.log('Creating the contract instance...');
    staking = await Staking.deploy(praedium.address, uridium.address, 1000, {
      gasPrice: gasPrice,
      // gasLimit: gasLimit,
    });
    console.log(`Contract instance created. Address: ${staking.address}`);

    console.log('Awaiting deployment transaction receipt...');
    const stakingReceipt = await staking.deployTransaction.wait();
    console.log('Deployment transaction receipt received.');

    console.log(`
      Staking contract deployed to: ${polygonUrl}/${staking.address}
      Transaction hash: ${stakingReceipt.transactionHash}
      Gas used: ${stakingReceipt.gasUsed.toString()}
      MATIC Cost: ${web3.utils.fromWei(stakingReceipt.gasUsed.toString(), 'ether')}
    `);

    await countdownWithAnimation(120);
    await hre.run('verify:verify', {
      address: staking.address,
      contract: 'contracts/marketplace/protocol/staking/staking.sol:Staking',
      constructorArguments: [praedium.address, uridium.address, 1000],
    });

    // Assign minter role to relevant contracts
    const MINTER_ROLE = await uridium.MINTER_ROLE();
    await uridium.grantRole(MINTER_ROLE, staking.address, {
      gasPrice: gasPrice,
      // gasLimit: gasLimit,
    });
  }

  if (deployIco) {
    console.log(`
        ================ Deploying: Ico Contract ================
        `);

    const minInvestmentAmount = ethers.utils.parseEther('1');
    const maxInvestmentAmount = ethers.utils.parseEther('200000');
    const tokenExchangeRate = 2;
    // Calculate ICO start and end times
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds since Unix epoch
    const startTime = currentTime + 600; // ICO starts 10 minutes from "now"
    const endTime = startTime + 604800 * 4; // ICO ends 4 weeks after start time

    const ICO = await ethers.getContractFactory('ICO');
    console.log('Creating the contract instance...');
    ico = await ICO.deploy(
      praedium.address,
      publicIcoAllocation,
      minInvestmentAmount,
      maxInvestmentAmount,
      startTime,
      endTime,
      tokenExchangeRate,
      {
        gasPrice: gasPrice,
        // gasLimit: gasLimit,
      },
      // {
      //   gasPrice: ethers.utils.parseUnits('104', 'gwei'), // Adjust the gas price as needed
      // },
    );
    console.log(`Contract instance created. Address: ${ico.address}`);

    console.log('Awaiting deployment transaction receipt...');
    const icoReceipt = await ico.deployTransaction.wait();
    console.log('Deployment transaction receipt received.');

    console.log(`
        Ico contract deployed to: ${polygonUrl}/${ico.address}
        Transaction hash: ${icoReceipt.transactionHash}
        Gas used: ${icoReceipt.gasUsed.toString()}
        MATIC Cost: ${web3.utils.fromWei(icoReceipt.gasUsed.toString(), 'ether')}
      `);

    await countdownWithAnimation(120);
    await hre.run('verify:verify', {
      address: staking.address,
      contract: 'contracts/marketplace/protocol/praedium/ico.sol:ICO',
      constructorArguments: [
        praedium.address,
        publicIcoAllocation,
        minInvestmentAmount,
        maxInvestmentAmount,
        startTime,
        endTime,
        tokenExchangeRate,
      ],
    });
  }

  if (deployTimeLock) {
    console.log(`
        ================ Deploying: TimeLock Contract ================
        `);

    const MIN_DELAY = 120;
    const PROPOSERS = [];
    const EXECUTORS = [];

    const TimeLock = await ethers.getContractFactory('TimeLock');
    console.log('Creating the contract instance...');
    timeLock = await TimeLock.deploy(MIN_DELAY, PROPOSERS, EXECUTORS, deployer.address, {
      gasPrice: gasPrice,
      // gasLimit: gasLimit,
    });
    console.log(`Contract instance created. Address: ${timeLock.address}`);

    console.log('Awaiting deployment transaction receipt...');
    const timeLockReceipt = await timeLock.deployTransaction.wait();
    console.log('Deployment transaction receipt received.');

    console.log(`
        TimeLock contract deployed to: ${polygonUrl}/${timeLock.address}
        Transaction hash: ${timeLockReceipt.transactionHash}
        Gas used: ${timeLockReceipt.gasUsed.toString()}
        MATIC Cost: ${web3.utils.fromWei(timeLockReceipt.gasUsed.toString(), 'ether')}
      `);

    await countdownWithAnimation(120);
    await hre.run('verify:verify', {
      address: timeLock.address,
      contract: 'contracts/marketplace/protocol/governance/Timelock.sol:TimeLock',
      constructorArguments: [MIN_DELAY, PROPOSERS, EXECUTORS, deployer.address],
    });
  }

  if (deployGovernor) {
    console.log(`
        ================ Deploying: Governor Contract ================
        `);

    // For Governor Contract
    const VOTING_DELAY = 1; // blocks
    const VOTING_PERIOD = 55; // blocks 45818 = 1 week in Ethereum
    const QUORUM_PERCENTAGE = 4; // percentage

    const GovernorContract = await ethers.getContractFactory('GovernorContract');
    console.log('Creating the contract instance...');
    governor = await GovernorContract.deploy(
      praedium.address,
      timeLock.address,
      VOTING_DELAY,
      VOTING_PERIOD,
      QUORUM_PERCENTAGE,
      {
        gasPrice: gasPrice,
        // gasLimit: gasLimit,
      },
      // {
      //   gasPrice: ethers.utils.parseUnits('104', 'gwei'), // Adjust the gas price as needed
      // },
    );
    console.log(`Contract instance created. Address: ${governor.address}`);

    console.log('Awaiting deployment transaction receipt...');
    const governorReceipt = await governor.deployTransaction.wait();
    console.log('Deployment transaction receipt received.');

    console.log(`
        Governor contract deployed to: ${polygonUrl}/${governor.address}
        Transaction hash: ${governorReceipt.transactionHash}
        Gas used: ${governorReceipt.gasUsed.toString()}
        MATIC Cost: ${web3.utils.fromWei(governorReceipt.gasUsed.toString(), 'ether')}
      `);

    await countdownWithAnimation(120);
    await hre.run('verify:verify', {
      address: governor.address,
      contract: 'contracts/marketplace/protocol/governance/GovernorContract.sol:GovernorContract',
      constructorArguments: [
        praedium.address,
        timeLock.address,
        VOTING_DELAY,
        VOTING_PERIOD,
        QUORUM_PERCENTAGE,
      ],
    });
  }

  if (deployBox) {
    console.log(`
        ================ Deploying: Box Contract ================
        `);

    const Box = await ethers.getContractFactory('Box');
    console.log('Creating the contract instance...');
    box = await Box.deploy();
    console.log(`Contract instance created. Address: ${box.address}`);

    console.log('Awaiting deployment transaction receipt...');
    const boxReceipt = await box.deployTransaction.wait();
    console.log('Deployment transaction receipt received.');

    console.log(`
        Box contract deployed to: ${polygonUrl}/${box.address}
        Transaction hash: ${boxReceipt.transactionHash}
        Gas used: ${boxReceipt.gasUsed.toString()}
        MATIC Cost: ${web3.utils.fromWei(boxReceipt.gasUsed.toString(), 'ether')}
      `);

    await countdownWithAnimation(120);
    await hre.run('verify:verify', {
      address: box.address,
      contract: 'contracts/marketplace/protocol/governance/Box.sol:Box',
      constructorArguments: [],
    });
    await box.transferOwnership(timeLock.address, {
      gasPrice: gasPrice,
      // gasLimit: gasLimit,
    });
  }

  if (setupTimelockRoles) {
    const proposerRole = await timeLock.PROPOSER_ROLE();
    const proposerTx = await timeLock.grantRole(proposerRole, governor.address, {
      gasPrice: gasPrice,
      // gasLimit: gasLimit,
    });
    await proposerTx.wait(1);

    const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';
    const executorRole = await timeLock.EXECUTOR_ROLE();
    const executorTx = await timeLock.grantRole(executorRole, ADDRESS_ZERO, {
      gasPrice: gasPrice,
      // gasLimit: gasLimit,
    });
    await executorTx.wait(1);

    const adminRole = await timeLock.TIMELOCK_ADMIN_ROLE();
    const revokeTx = await timeLock.revokeRole(adminRole, deployer.address, {
      gasPrice: gasPrice,
      // gasLimit: gasLimit,
    });
    await revokeTx.wait(1);
  }

  if (deployMedals) {
    console.log(`
        ================ Deploying: Medals Contract ================
        `);

    const uri = 'https://api.boomslag.com/api/medals/nft/';
    const Medals = await ethers.getContractFactory('Medals');
    console.log('Creating the contract instance...');
    medals = await Medals.deploy(uridiumFoundation, 500, uri, {
      gasPrice: gasPrice,
      // gasLimit: gasLimit,
    });
    console.log(`Contract instance created. Address: ${medals.address}`);

    console.log('Awaiting deployment transaction receipt...');
    const medalsReceipt = await medals.deployTransaction.wait();
    console.log('Deployment transaction receipt received.');

    console.log(`
        Medals contract deployed to: ${polygonUrl}/${medals.address}
        Transaction hash: ${medalsReceipt.transactionHash}
        Gas used: ${medalsReceipt.gasUsed.toString()}
        MATIC Cost: ${web3.utils.fromWei(medalsReceipt.gasUsed.toString(), 'ether')}
      `);

    await countdownWithAnimation(120);
    await hre.run('verify:verify', {
      address: medals.address,
      contract: 'contracts/marketplace/nfts/rewards/medals.sol:Medals',
      constructorArguments: [uridiumFoundation, 500, uri],
    });
  }

  console.log(`============ FINAL DEPLOYMENT COSTS ==============`);
  const finalBalance = await getBalance(deployer);
  console.log('Account balance previous to Deployment:', initialBalance);
  console.log(`Final Deployer Account Balance: ${finalBalance}`);
}

main().catch((err) => {
  console.log(err);
  process.exitCode = 1;
});
