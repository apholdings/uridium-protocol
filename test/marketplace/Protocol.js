const { expect, assert } = require('chai');
const { ethers } = require('hardhat');

let Ticket,
  ticket,
  Affiliates,
  affiliates,
  Booth,
  booth,
  TicketRegistry,
  ticket_registry,
  AuctionUtilities,
  auction_utilities;
let owner,
  seller,
  buyer,
  buyer2,
  royaltyReceiver,
  affiliate,
  affiliate2,
  affiliate3,
  affiliate4,
  affiliate5,
  affiliate6,
  affiliate7,
  affiliate8,
  affiliate9;

const nftPrice = ethers.utils.parseEther('0.01');
const uri = 'https://api.boomslag.com/api/courses/nft/';
const initialStock = 30;
const tokenId = 123;
const royaltyPercentage = 500; // 5% represented in basis points (100 basis points = 1%)
const commissionPercent = 25; // 5% represented in basis points (100 basis points = 1%)
const useStock = true;
const limitedEdition = false;

const timeExtensionThreshold = 300; // 5 minutes in seconds
// const initialMinBidIncrement = 10**18; // 1 MATIC in wei
const initialMinBidIncrement = ethers.utils.parseEther('1.0'); // 1 MATIC
const depositPercentage = 500;
const bidLockPeriod = 300; // 5 minutes in seconds
const platformCommission = 500; // 5% represented in basis points

const maxReferralDepth = 5; // MLM Max number of Hierarchy

// With this structure, affiliates are incentivized to improve their rank and work on their direct
// referrals as they receive higher rewards for higher ranks and closer relationships.
// At the same time, the maximum reward an affiliate can get from a single sale is capped at 25 %,
// ensuring a balance in the reward distribution.
// Level 1: Bronze 8%, Silver 10%, Gold 12%, Platinum 14%, Diamond 16%
// Level 2: Bronze 6%, Silver 8%,  Gold 10%, Platinum 12%, Diamond 14%
// Level 3: Bronze 4%, Silver 6%,  Gold 8%,  Platinum 10%, Diamond 12%
// Level 4: Bronze 2%, Silver 4%,  Gold 6%,  Platinum 8%,  Diamond 10%
// Level 5: Bronze 1%, Silver 2%,  Gold 4%,  Platinum 6%,  Diamond 8%

const referralRewardBasisPointsArray = [
  [1000, 1100, 1200, 1300, 1400], // Level 1: Bronze 10%, Silver 11%, Gold 12%, Platinum 13%, Diamond 14%
  [700, 850, 1000, 1150, 1300], // Level 2: Increase by a factor that reduces the gap slightly but still provides incentive for higher ranks
  [500, 650, 800, 950, 1100], // Level 3: Same as above, continue reducing the gap
  [300, 450, 600, 750, 900], // Level 4: Continue the trend
  [150, 300, 450, 600, 750], // Level 5: By this level, the difference between ranks narrows as the depth increases
];

// Define the rank criteria
const rankCriteriasArray = [
  { requiredDirectReferrals: 5, requiredSalesVolume: ethers.utils.parseEther('1') },
  { requiredDirectReferrals: 10, requiredSalesVolume: ethers.utils.parseEther('5') },
  { requiredDirectReferrals: 20, requiredSalesVolume: ethers.utils.parseEther('10') },
  { requiredDirectReferrals: 50, requiredSalesVolume: ethers.utils.parseEther('20') },
  { requiredDirectReferrals: 100, requiredSalesVolume: ethers.utils.parseEther('50') },
];

beforeEach(async function () {
  [
    owner,
    seller,
    buyer,
    buyer2,
    royaltyReceiver,
    affiliate,
    affiliate2,
    affiliate3,
    affiliate4,
    affiliate5,
    affiliate6,
    affiliate7,
    affiliate8,
    affiliate9,
  ] = await ethers.getSigners();

  // Deploy Affiliates Contract and set ranks
  Affiliates = await ethers.getContractFactory('Affiliates');
  affiliates = await Affiliates.deploy(
    referralRewardBasisPointsArray,
    rankCriteriasArray,
    maxReferralDepth,
  );
  await affiliates.deployed();

  // Deploy Ticket Contract
  Ticket = await ethers.getContractFactory('Ticket');
  ticket = await Ticket.deploy(
    tokenId,
    nftPrice,
    initialStock,
    useStock,
    limitedEdition,
    royaltyReceiver.address,
    royaltyPercentage,
    [owner.address, seller.address],
    [10, 90],
    uri,
  ); // Payees, Shares
  await ticket.deployed();

  // Deploy Auctions Contract
  Auctions = await ethers.getContractFactory('Auctions');
  auctions = await Auctions.deploy(
    ticket.address,
    timeExtensionThreshold,
    initialMinBidIncrement,
    depositPercentage,
    bidLockPeriod,
    platformCommission,
  );
  await auctions.deployed();

  AuctionUtilities = await ethers.getContractFactory('AuctionUtils');
  auction_utilities = await AuctionUtilities.deploy(auctions.address);
  await auction_utilities.deployed();

  // Deploy Booth Contract
  Booth = await ethers.getContractFactory('Booth');
  booth = await Booth.deploy(affiliates.address, commissionPercent);
  await booth.deployed();

  // Deploy ticket_registry Contract
  TicketRegistry = await ethers.getContractFactory('TicketRegistry');
  ticket_registry = await TicketRegistry.deploy();
  await ticket_registry.deployed();

  // Register the objectId and its corresponding ticket contract IMPORTANT STEP!
  await booth.registerObject(tokenId, ticket.address);
  await ticket_registry.registerObject(tokenId, ticket.address);

  // Grant BOOTH Role to the Booth contract
  const BOOTH_ROLE = await affiliates.BOOTH_ROLE();
  await affiliates.grantRole(BOOTH_ROLE, booth.address);
  await affiliates.grantRole(BOOTH_ROLE, owner.address);

  await auctions.grantRole(await auctions.BOOTH_ROLE(), booth.address);

  await ticket.grantRole(await ticket.BOOTH_ROLE(), booth.address);
  await ticket_registry.grantRole(await ticket_registry.BOOKING_ROLE(), booth.address);
});

const testTicket = false;
if (testTicket) {
  describe('Ticket Contract', function () {
    describe('Deployment and Initial Settings', function () {
      it('should deploy the Ticket contract', async function () {
        expect(ticket.address).to.not.equal(0x0);
        expect(ticket.address).to.not.equal(null);
        expect(ticket.address).to.not.equal(undefined);
        expect(ticket.address).to.not.equal('');
      });

      it('should have correct initial settings', async function () {
        const deployedTokenId = await ticket.tokenId();
        const deployedPrice = await ticket.price();
        const deployedStock = await ticket.stock(tokenId);
        const deployedUseStock = await ticket.useStock();
        const deployedLimitedEdition = await ticket.limitedEdition();
        const deployedRoyaltyReceiver = await ticket.royaltyReceiver();
        const deployedRoyaltyPercentage = await ticket.royaltyPercentage();

        expect(deployedTokenId).to.equal(tokenId);
        expect(deployedPrice).to.equal(nftPrice);
        expect(deployedStock).to.equal(initialStock);
        expect(deployedUseStock).to.equal(useStock);
        expect(deployedLimitedEdition).to.equal(limitedEdition);
        expect(deployedRoyaltyReceiver).to.equal(royaltyReceiver.address);
        expect(deployedRoyaltyPercentage).to.equal(royaltyPercentage);
      });
    });

    describe('Functionality Testing', function () {
      it('should change and verify price', async function () {
        const newPrice = ethers.utils.parseEther('0.02');
        await ticket.connect(owner).updatePrice(newPrice);
        expect(await ticket.price()).to.equal(newPrice);
      });

      it('should mint directly using the ticket and update the registry', async function () {
        const nftId = 1;
        const qty = 1;
        const guy = buyer.address;
        const tx = await ticket.connect(buyer).mint(tokenId, nftId, qty, guy, { value: nftPrice });
        const receipt = await tx.wait();
        const mintEvent = receipt.events.find((event) => event.event === 'Mint');
        expect(mintEvent).to.exist;

        expect(await ticket.balanceOf(buyer.address, nftId)).to.equal(1);

        // Simulate listening for the Mint event and updating the TicketRegistry

        // Ensure the test account has the BOOKING_ROLE in the TicketRegistry
        await ticket_registry
          .connect(owner)
          .updateOwnershipOnMint(
            mintEvent.args.guy,
            mintEvent.args.tokenId,
            mintEvent.args.nftId,
            mintEvent.args.qty,
            mintEvent.args.price,
            mintEvent.args.uri,
          );

        // // Verify the update in the registry
        const [ownedNFTs, totalNFTs] = await ticket_registry.getOwnedNFTs(guy, 1, 10);

        const nftDetails = ownedNFTs[0];
        // console.log('NFT ID', nftDetails.nftId)
        // console.log('Token ID', nftDetails.tokenId)
        // console.log('Owner', nftDetails.owner)
        // console.log('Qty', nftDetails.qty)
        // console.log('Price', nftDetails.price)
        // console.log('URI', nftDetails.uri)

        expect(nftDetails.nftId).to.equal(nftId);

        // expect(nftDetails[0].toNumber()).to.equal(1)
        expect(totalNFTs.toNumber()).to.equal(1);
      });

      it('should verify URI', async function () {
        // Test URI verification
        const nftId = 1;
        const qty = 1;
        const guy = buyer.address;
        await ticket.connect(buyer).mint(tokenId, nftId, qty, guy, { value: nftPrice });
        // console.log('NFT Metadata URI: ', await ticket.uri(nftId));
        expect(await ticket.uri(nftId)).to.equal(uri + nftId + '.json');
      });

      it('should verify buyer has access', async function () {
        const nftId = 1;
        const qty = 1;
        const guy = buyer.address;
        const tx = await ticket.connect(buyer).mint(tokenId, nftId, qty, guy, { value: nftPrice });
        const receipt = await tx.wait();
        const mintEvent = receipt.events.find((event) => event.event === 'Mint');
        expect(mintEvent).to.exist;
        expect(await ticket.balanceOf(buyer.address, nftId)).to.equal(1);

        await ticket_registry
          .connect(owner)
          .updateOwnershipOnMint(
            mintEvent.args.guy,
            mintEvent.args.tokenId,
            mintEvent.args.nftId,
            mintEvent.args.qty,
            mintEvent.args.price,
            mintEvent.args.uri,
          );

        // Verify buyer owns nft
        // 1) getbalance
        const nft_blance = await ticket.balanceOf(buyer.address, nftId);
        // console.log(nft_blance)
        expect(nft_blance).to.equal(1);

        // 2) ddoesUserOwnNFT
        const user_owns_nft = await ticket_registry.doesUserOwnNFT(buyer.address, nftId);
        // console.log(user_owns_nft)
        expect(user_owns_nft).to.be.true;
      });

      it("should verify buyer doens't has access after transfer", async function () {
        const nftId = 1;
        const qty = 1;
        const guy = buyer.address;
        const tx = await ticket.connect(buyer).mint(tokenId, nftId, qty, guy, { value: nftPrice });
        const receipt = await tx.wait();
        const mintEvent = receipt.events.find((event) => event.event === 'Mint');
        expect(mintEvent).to.exist;
        expect(await ticket.balanceOf(buyer.address, nftId)).to.equal(1);

        await ticket_registry
          .connect(owner)
          .updateOwnershipOnMint(
            mintEvent.args.guy,
            mintEvent.args.tokenId,
            mintEvent.args.nftId,
            mintEvent.args.qty,
            mintEvent.args.price,
            mintEvent.args.uri,
          );

        // Verify buyer owns the NFT
        expect(await ticket.balanceOf(buyer.address, nftId)).to.equal(1);
        expect(await ticket_registry.doesUserOwnNFT(buyer.address, nftId)).to.be.true;

        // Transfer NFT from buyer to buyer2
        const tx_transfer = await ticket
          .connect(buyer)
          .safeTransferFrom(buyer.address, buyer2.address, nftId, qty, '0x');

        const receipt_transfer = await tx_transfer.wait();
        const transferEvent = receipt_transfer.events.find((event) => event.event === 'Transfer');
        expect(transferEvent).to.exist;

        // Update ownership in the registry
        await ticket_registry.connect(owner).updateOwnershipOnTransfer(
          buyer.address, // from
          buyer2.address, // to
          transferEvent.args.tokenId.toNumber(), // tokenId
          transferEvent.args.nftId.toNumber(), // nftId
          transferEvent.args.qty.toNumber(), // qty
          nftPrice, // price
          transferEvent.args.uri, // uri
        );

        // Verify that buyer no longer owns the NFT
        expect(await ticket_registry.doesUserOwnNFT(buyer.address, nftId)).to.be.false;

        // Verify that buyer2 now owns the NFT
        expect(await ticket_registry.doesUserOwnNFT(buyer2.address, nftId)).to.be.true;
      });

      it('should check max supply', async function () {
        expect(await ticket.stock(tokenId)).to.equal(initialStock);
      });
    });

    describe('Ticket Contract Royalties', function () {
      beforeEach(async function () {
        const nftId = 1;
        const qty = 1;
        const guy = buyer.address;
        await ticket.connect(buyer).mint(tokenId, nftId, qty, guy, { value: nftPrice });
      });

      it('should check royalty receiver', async function () {
        const [receiver] = await ticket.royaltyInfo(tokenId, nftPrice);
        expect(receiver).to.equal(royaltyReceiver.address);
      });

      it('should check royalty percentage', async function () {
        const [, royaltyAmount] = await ticket.royaltyInfo(tokenId, nftPrice);
        const expectedRoyaltyAmount = nftPrice.mul(royaltyPercentage).div(10000);
        expect(royaltyAmount).to.equal(expectedRoyaltyAmount);
      });

      it('should retrieve royalty information', async function () {
        const nftId = 1;
        const qty = 1;
        const guy = buyer.address;
        const salePrice = ethers.utils.parseEther('0.05');

        await ticket.connect(buyer).mint(tokenId, nftId, qty, guy, { value: salePrice });

        const [receiver, royaltyAmount] = await ticket.royaltyInfo(tokenId, salePrice);
        const expectedRoyaltyAmount = salePrice.mul(royaltyPercentage).div(10000);

        expect(receiver).to.equal(royaltyReceiver.address);
        expect(royaltyAmount).to.equal(expectedRoyaltyAmount);
      });
    });

    describe('Admin Functions', function () {
      it('should set stock limit', async function () {
        const newStockLimit = 50;
        await ticket.connect(owner).setStock(tokenId, newStockLimit);
        expect(await ticket.stock(tokenId)).to.equal(newStockLimit);
      });

      it('should set use stock flag', async function () {
        const newUseStockFlag = true;
        await ticket.connect(owner).setUseStock(newUseStockFlag);
        expect(await ticket.useStock()).to.equal(newUseStockFlag);
      });

      it('should update price', async function () {
        const newPrice = ethers.utils.parseEther('0.03');
        await ticket.connect(owner).updatePrice(newPrice);
        expect(await ticket.price()).to.equal(newPrice);
      });
    });
  });
}

const testAffiliates = false;
if (testAffiliates) {
  describe('Affiliates Contract', function () {
    describe('Deployment and Initial Settings', function () {
      it('should deploy the Affiliates contract', async function () {
        expect(affiliates.address).to.not.equal(0x0);
        expect(affiliates.address).to.not.equal(null);
        expect(affiliates.address).to.not.equal(undefined);
        expect(affiliates.address).to.not.equal('');
      });

      it('should have correct initial referral reward basis points', async function () {
        for (let i = 0; i < referralRewardBasisPointsArray.length; i++) {
          for (let j = 0; j < referralRewardBasisPointsArray[i].length; j++) {
            const deployedReferralReward = await affiliates.referralRewardBasisPoints(i, j);
            expect(deployedReferralReward).to.equal(referralRewardBasisPointsArray[i][j]);
          }
        }
      });

      it('should have correct initial rank criterias', async function () {
        for (let i = 0; i < rankCriteriasArray.length; i++) {
          const deployedRankCriteria = await affiliates.rankCriterias(i);
          expect(deployedRankCriteria.requiredDirectReferrals).to.equal(
            rankCriteriasArray[i].requiredDirectReferrals,
          );
          expect(deployedRankCriteria.requiredSalesVolume).to.equal(
            rankCriteriasArray[i].requiredSalesVolume,
          );
        }
      });

      it('should have correct initial max referral depth', async function () {
        const deployedMaxReferralDepth = await affiliates.maxDepth();
        expect(deployedMaxReferralDepth).to.equal(maxReferralDepth);
      });
    });

    describe('Functional Tests', function () {
      it('should correctly set and update referral rewards', async function () {
        // const BOOTH_ROLE = await affiliates.BOOTH_ROLE();
        // await affiliates.grantRole(BOOTH_ROLE, owner.address);

        // Update referral rewards
        const newRewardBasisPoints = 1500; // Example new reward basis points (15%)
        const levelToUpdate = 1; // Example level to update
        const rankToUpdate = 1; // Example rank to update

        // Update the reward for a specific level and rank
        await affiliates
          .connect(owner)
          .setReferralReward(levelToUpdate, rankToUpdate, newRewardBasisPoints);

        // Check that the reward was updated
        const updatedReward = await affiliates.referralRewardBasisPoints(
          levelToUpdate,
          rankToUpdate,
        );
        expect(updatedReward).to.equal(newRewardBasisPoints);
      });

      it('should correctly assign and manage referrer ranks', async function () {
        // Assign a rank to a referrer
        const initialRank = 1; // Example initial rank
        await affiliates.setReferrerRank(affiliate.address, initialRank);

        // Check the assigned rank
        let currentRank = await affiliates.getReferrerRank(affiliate.address);
        expect(currentRank).to.equal(initialRank);
      });

      it('should update sales volume correctly', async function () {
        // Set a referrer for a buyer
        const buyerReferrer = affiliate.address; // Example referrer address
        await affiliates.setReferrer(buyer.address, buyerReferrer);

        // Simulate a sale and update the sales volume
        const saleAmount = ethers.utils.parseEther('1'); // Example sale amount
        await affiliates.connect(owner).updateSalesVolume(buyerReferrer, saleAmount);

        // Check the updated sales volume
        const updatedSalesVolume = await affiliates.salesVolume(buyerReferrer);
        expect(updatedSalesVolume).to.equal(saleAmount);

        // Optionally, simulate additional sales and check cumulative sales volume
        const additionalSaleAmount = ethers.utils.parseEther('2'); // Example additional sale amount
        await affiliates.connect(owner).updateSalesVolume(buyerReferrer, additionalSaleAmount);

        const totalSalesVolume = await affiliates.salesVolume(buyerReferrer);
        expect(totalSalesVolume).to.equal(saleAmount.add(additionalSaleAmount));
      });

      it('should handle rank up based on criteria', async function () {
        // Set a referrer for a buyer
        const referrer = affiliate.address; // Example referrer address
        await affiliates.setReferrer(buyer.address, referrer);

        // Assign initial rank to the referrer
        const initialRank = 0; // Assuming rank starts from 0
        await affiliates.setReferrerRank(referrer, initialRank);

        // Simulate referrals and sales to meet the criteria for rank up
        const requiredReferrals = rankCriteriasArray[initialRank + 1].requiredDirectReferrals;
        const requiredSalesVolume = rankCriteriasArray[initialRank + 1].requiredSalesVolume;
        for (let i = 0; i < requiredReferrals; i++) {
          const newBuyer = ethers.Wallet.createRandom().address; // Create a dummy buyer address
          await affiliates.setReferrer(newBuyer, referrer); // Set referrer for the new buyer
        }
        await affiliates.connect(owner).updateSalesVolume(referrer, requiredSalesVolume);

        // Perform a rank up
        await affiliates.rankUp(referrer);

        // Check the updated rank
        const updatedRank = await affiliates.getReferrerRank(referrer);
        expect(updatedRank).to.equal(initialRank + 1);
      });

      it('should correctly handle affiliate program commissions', async function () {
        // Set up the referral structure
        // affiliate -> affiliate2 -> affiliate3 -> affiliate4 -> affiliate5
        await affiliates.setReferrer(affiliate2.address, affiliate.address);
        await affiliates.setReferrer(affiliate3.address, affiliate2.address);
        await affiliates.setReferrer(affiliate4.address, affiliate3.address);
        await affiliates.setReferrer(affiliate5.address, affiliate4.address);

        // Set up the referrer ranks
        await affiliates.setReferrerRank(affiliate.address, 0);
        await affiliates.setReferrerRank(affiliate2.address, 1);
        await affiliates.setReferrerRank(affiliate3.address, 2);
        await affiliates.setReferrerRank(affiliate4.address, 3);
        await affiliates.setReferrerRank(affiliate5.address, 4);

        // Affiliate 5 Was referred by Affiliate 4 and he makes a purchase
        const purchasePrice = ethers.utils.parseEther('0.01');
        const nftId = 1;
        const qty = 1;
        const guy = affiliate5.address;

        const initialBalances = [
          await ethers.provider.getBalance(affiliate.address),
          await ethers.provider.getBalance(affiliate2.address),
          await ethers.provider.getBalance(affiliate3.address),
          await ethers.provider.getBalance(affiliate4.address),
          await ethers.provider.getBalance(affiliate5.address),
        ];
        // console.log('Initial Balances: ', initialBalances)
        // Purchase the NFT from the booth
        await booth.grantRole(await booth.BUYER_ROLE(), affiliate5.address);
        await booth
          .connect(affiliate5)
          .affiliateBuy(tokenId, nftId, qty, guy, { value: purchasePrice });

        const finalBalances = [
          await ethers.provider.getBalance(affiliate.address),
          await ethers.provider.getBalance(affiliate2.address),
          await ethers.provider.getBalance(affiliate3.address),
          await ethers.provider.getBalance(affiliate4.address),
          await ethers.provider.getBalance(affiliate5.address),
        ];
        // console.log('Final Balances: ', finalBalances)
        expect(finalBalances[0]).to.be.above(initialBalances[0]);
        expect(finalBalances[1]).to.be.above(initialBalances[1]);
        expect(finalBalances[2]).to.be.above(initialBalances[2]);
        expect(finalBalances[3]).to.be.above(initialBalances[3]);
        // expect(finalBalances[4]).to.be.equal(initialBalances[4]);
      });

      it('should correctly set and retrieve referrers', async function () {
        // Set up referrer relationships
        await affiliates.setReferrer(buyer.address, affiliate.address);
        await affiliates.setReferrer(affiliate.address, affiliate2.address);
        await affiliates.setReferrer(affiliate2.address, affiliate3.address);

        // Retrieve and check referrers
        const referrerOfBuyer = await affiliates.getReferrer(buyer.address);
        expect(referrerOfBuyer).to.equal(affiliate.address);

        const referrerOfAffiliate = await affiliates.getReferrer(affiliate.address);
        expect(referrerOfAffiliate).to.equal(affiliate2.address);

        const referrerOfAffiliate2 = await affiliates.getReferrer(affiliate2.address);
        expect(referrerOfAffiliate2).to.equal(affiliate3.address);
      });

      it('should correctly calculate and distribute rewards', async function () {
        // Set up the referral chain
        // affiliate -> affiliate2 -> affiliate3 -> affiliate4 -> affiliate5
        // Affiliate 1 refers affiliate 2
        await affiliates.setReferrer(affiliate2.address, affiliate.address);
        // Affiliate 2 refers affiliate 3
        await affiliates.setReferrer(affiliate3.address, affiliate2.address);

        // Store initial balances of the affiliates
        const initialBalanceAffiliate1 = await ethers.provider.getBalance(affiliate.address);
        const initialBalanceAffiliate2 = await ethers.provider.getBalance(affiliate2.address);

        // Simulate a purchase that should trigger rewards
        // Make sure the buyer has the BUYER_ROLE and enough funds
        await booth.grantRole(await booth.BUYER_ROLE(), affiliate3.address);
        // affiliate 3 will make a purchase
        await booth
          .connect(affiliate3)
          .affiliateBuy(tokenId, 1, 1, affiliate3.address, { value: nftPrice.mul(1) });

        // // Helper function to calculate expected rewards
        // function calculateExpectedReward(rank, purchaseAmount, level) {
        //     const rewardBasisPoints = referralRewardBasisPointsArray[level][rank];
        //     return purchaseAmount.mul(rewardBasisPoints).div(10000);
        // }

        // // Calculate expected rewards for each affiliate
        // const affiliate1Rank = await affiliates.getReferrerRank(affiliate.address);
        // const affiliate2Rank = await affiliates.getReferrerRank(affiliate2.address);

        // const affiliate1Reward = calculateExpectedReward(affiliate1Rank, purchaseAmount, 0); // Assuming affiliate1 is at level 0 in the referral chain
        // const affiliate2Reward = calculateExpectedReward(affiliate2Rank, purchaseAmount, 1); // Assuming affiliate2 is at level 1 in the referral chain

        const finalBalanceAffiliate1 = await ethers.provider.getBalance(affiliate.address);
        const finalBalanceAffiliate2 = await ethers.provider.getBalance(affiliate2.address);

        expect(finalBalanceAffiliate1).to.be.above(initialBalanceAffiliate1);
        expect(finalBalanceAffiliate2).to.be.above(initialBalanceAffiliate2);
      });

      it('should manage direct referrals correctly', async function () {
        // Initially, affiliates should have no direct referrals
        expect(await affiliates.directReferrals(affiliate.address)).to.equal(0);
        expect(await affiliates.directReferrals(affiliate2.address)).to.equal(0);

        // Add direct referrals
        await affiliates.setReferrer(buyer.address, affiliate.address);
        await affiliates.setReferrer(buyer2.address, affiliate.address);
        await affiliates.setReferrer(seller.address, affiliate2.address);

        // Check updated direct referral counts
        expect(await affiliates.directReferrals(affiliate.address)).to.equal(2); // buyer and buyer2 referred by affiliate
        expect(await affiliates.directReferrals(affiliate2.address)).to.equal(1); // seller referred by affiliate2

        // Adding more referrals
        const anotherBuyer = (await ethers.getSigners())[8]; // Example of getting another signer
        await affiliates.setReferrer(anotherBuyer.address, affiliate.address);

        // Check updated direct referral counts again
        expect(await affiliates.directReferrals(affiliate.address)).to.equal(3); // now affiliate has 3 direct referrals
      });

      it('should correctly check eligibility for rank up', async function () {
        // Set initial sales volume and direct referrals for an affiliate
        const initialSalesVolume = ethers.utils.parseEther('1'); // Example sales volume
        await affiliates.updateSalesVolume(affiliate.address, initialSalesVolume);
        // Simulate a few direct referrals
        await affiliates.setReferrer(buyer.address, affiliate.address);
        await affiliates.setReferrer(buyer2.address, affiliate.address);

        // Check initial rank of the affiliate
        const initialRank = await affiliates.getReferrerRank(affiliate.address);
        expect(initialRank).to.equal(0); // Assuming rank starts from 0

        // Check eligibility for rank up before meeting criteria
        let isEligibleBefore = await affiliates.checkEligibilityForRankUp(affiliate.address);
        expect(isEligibleBefore).to.equal(false); // Not eligible yet

        // Update sales volume and direct referrals to meet rank up criteria
        const rankCriteria = await affiliates.rankCriterias(1); // Assuming next rank is 1
        await affiliates.updateSalesVolume(affiliate.address, rankCriteria.requiredSalesVolume);
        for (let i = 0; i < rankCriteria.requiredDirectReferrals; i++) {
          const newBuyer = (await ethers.getSigners())[10 + i]; // Example of getting new signers
          await affiliates.setReferrer(newBuyer.address, affiliate.address);
        }

        // Check eligibility for rank up after meeting criteria
        let isEligibleAfter = await affiliates.checkEligibilityForRankUp(affiliate.address);
        expect(isEligibleAfter).to.equal(true); // Should be eligible now

        // Perform the rank up
        await affiliates.rankUp(affiliate.address);

        // Verify that the rank has been updated
        const newRank = await affiliates.getReferrerRank(affiliate.address);
        expect(newRank).to.equal(initialRank + 1);
      });

      it('should correctly calculate referral depth', async function () {
        // Set up the referral structure
        // affiliate -> affiliate2 -> affiliate3 -> affiliate4 -> affiliate5
        await affiliates.setReferrer(affiliate2.address, affiliate.address);
        await affiliates.setReferrer(affiliate3.address, affiliate2.address);
        await affiliates.setReferrer(affiliate4.address, affiliate3.address);
        await affiliates.setReferrer(affiliate5.address, affiliate4.address);

        // Check referral depth for each affiliate
        let depthAffiliate = await affiliates.getReferralDepth(affiliate.address);
        let depthAffiliate2 = await affiliates.getReferralDepth(affiliate2.address);
        let depthAffiliate3 = await affiliates.getReferralDepth(affiliate3.address);
        let depthAffiliate4 = await affiliates.getReferralDepth(affiliate4.address);

        expect(depthAffiliate).to.equal(0);
        expect(depthAffiliate2).to.equal(1);
        expect(depthAffiliate3).to.equal(2);
        expect(depthAffiliate4).to.equal(3);
      });

      it('should correctly retrieve referrer and rank information', async function () {
        // Set up referrers and ranks
        await affiliates.setReferrer(buyer.address, affiliate.address);
        await affiliates.setReferrer(affiliate.address, affiliate2.address);

        // Set ranks for the affiliates
        const rankAffiliate = 1; // Example rank
        const rankAffiliate2 = 2; // Example rank
        await affiliates.setReferrerRank(affiliate.address, rankAffiliate);
        await affiliates.setReferrerRank(affiliate2.address, rankAffiliate2);

        // Retrieve referrer information
        const referrerOfBuyer = await affiliates.getReferrer(buyer.address);
        const referrerOfAffiliate = await affiliates.getReferrer(affiliate.address);

        // Retrieve rank information
        const rankOfAffiliate = await affiliates.getReferrerRank(affiliate.address);
        const rankOfAffiliate2 = await affiliates.getReferrerRank(affiliate2.address);

        // Verify referrer information
        expect(referrerOfBuyer).to.equal(affiliate.address);
        expect(referrerOfAffiliate).to.equal(affiliate2.address);

        // Verify rank information
        expect(rankOfAffiliate).to.equal(rankAffiliate);
        expect(rankOfAffiliate2).to.equal(rankAffiliate2);
      });

      it('should correctly calculate referral rewards in a complete hierarchy', async function () {
        // Set up the referral structure
        // affiliate -> affiliate2 -> affiliate3 -> affiliate4 -> affiliate5
        await affiliates.setReferrer(affiliate2.address, affiliate.address);
        await affiliates.setReferrer(affiliate3.address, affiliate2.address);
        await affiliates.setReferrer(affiliate4.address, affiliate3.address);
        await affiliates.setReferrer(affiliate5.address, affiliate4.address);

        // Set up the referrer ranks
        await affiliates.setReferrerRank(affiliate.address, 0);
        await affiliates.setReferrerRank(affiliate2.address, 1);
        await affiliates.setReferrerRank(affiliate3.address, 2);
        await affiliates.setReferrerRank(affiliate4.address, 3);
        await affiliates.setReferrerRank(affiliate5.address, 4);

        const affiliateDepth = await affiliates.getReferralDepth(affiliate.address);
        const affiliate2Depth = await affiliates.getReferralDepth(affiliate2.address);
        const affiliate3Depth = await affiliates.getReferralDepth(affiliate3.address);
        const affiliate4Depth = await affiliates.getReferralDepth(affiliate4.address);
        const affiliate5Depth = await affiliates.getReferralDepth(affiliate5.address);

        const reward = await affiliates.calculateReward(affiliate.address, affiliateDepth);
        const reward2 = await affiliates.calculateReward(affiliate2.address, affiliate2Depth);
        const reward3 = await affiliates.calculateReward(affiliate3.address, affiliate3Depth);
        const reward4 = await affiliates.calculateReward(affiliate4.address, affiliate4Depth);
        const reward5 = await affiliates.calculateReward(affiliate5.address, affiliate5Depth);

        let rewards = [reward, reward2, reward3, reward4, reward5];

        // // console.log(rewards)
        expect(rewards[0].toString()).to.equal('100');
        expect(rewards[1].toString()).to.equal('70');
        expect(rewards[2].toString()).to.equal('50');
        expect(rewards[3].toString()).to.equal('30');
        expect(rewards[4].toString()).to.equal('15');
      });

      it('should start a new hierarchy for affiliate6', async function () {
        // Set up the original referral structure
        // affiliate -> affiliate2 -> affiliate3 -> affiliate4 -> affiliate5
        await affiliates.setReferrer(affiliate2.address, affiliate.address);
        await affiliates.setReferrer(affiliate3.address, affiliate2.address);
        await affiliates.setReferrer(affiliate4.address, affiliate3.address);
        await affiliates.setReferrer(affiliate5.address, affiliate4.address);

        // Now, introduce affiliate6 into the system as the new circle head.
        // Let's say affiliate6 was introduced to the system by affiliate but he's starting his new circle.
        await affiliates.setReferrer(affiliate6.address, affiliate.address);

        // Now, affiliate6 refers affiliate7, affiliate8, and so on...
        await affiliates.setReferrer(affiliate7.address, affiliate6.address);

        // Checking affiliate6's referrer
        const affiliate6Referrer = await affiliates.getReferrer(affiliate6.address);
        assert.equal(affiliate6Referrer, affiliate.address, 'Referrer for User 6 is incorrect');

        // Checking affiliate7's referrer
        const affiliate7Referrer = await affiliates.getReferrer(affiliate7.address);
        assert.equal(affiliate7Referrer, affiliate6.address, 'Referrer for User 7 is incorrect');

        const depth = await affiliates.getReferralDepth(affiliate7.address);
        assert.equal(depth.toString(), '2', 'Referral depth for affiliate5 is incorrect');

        // ... Continue this pattern for affiliate8, affiliate9, and so on until you've validated the circle hierarchy for affiliate6.
        // Add more affiliates to affiliate6's circle

        await affiliates.setReferrer(affiliate8.address, affiliate6.address);
        await affiliates.setReferrer(affiliate9.address, affiliate8.address);

        // Check the referrer for affiliate8 and affiliate9
        const affiliate8Referrer = await affiliates.getReferrer(affiliate8.address);
        assert.equal(affiliate8Referrer, affiliate6.address, 'Referrer for User 8 is incorrect');

        const affiliate9Referrer = await affiliates.getReferrer(affiliate9.address);
        assert.equal(affiliate9Referrer, affiliate8.address, 'Referrer for User 9 is incorrect');

        // Optionally, you can also verify if affiliate6's circle is independent of the previous circle by ensuring that rewards don't propagate outside the circle.
        const affiliateDepth = await affiliates.getReferralDepth(affiliate.address);
        const affiliate2Depth = await affiliates.getReferralDepth(affiliate2.address);
        const affiliate3Depth = await affiliates.getReferralDepth(affiliate3.address);
        const affiliate4Depth = await affiliates.getReferralDepth(affiliate4.address);
        const affiliate5Depth = await affiliates.getReferralDepth(affiliate5.address);

        const reward = await affiliates.calculateReward(affiliate.address, affiliateDepth);
        const reward2 = await affiliates.calculateReward(affiliate2.address, affiliate2Depth);
        const reward3 = await affiliates.calculateReward(affiliate3.address, affiliate3Depth);
        const reward4 = await affiliates.calculateReward(affiliate4.address, affiliate4Depth);
        const reward5 = await affiliates.calculateReward(affiliate5.address, affiliate5Depth);

        let rewards = [reward, reward2, reward3, reward4, reward5];

        // Calculate rewards for the new hierarchy
        const depthAffiliate6 = await affiliates.getReferralDepth(affiliate6.address);
        const depthAffiliate7 = await affiliates.getReferralDepth(affiliate7.address);
        // Verify the depth for affiliate8 and affiliate9
        const depthAffiliate8 = await affiliates.getReferralDepth(affiliate8.address);
        assert.equal(depthAffiliate8.toString(), '2', 'Referral depth for affiliate8 is incorrect');
        const depthAffiliate9 = await affiliates.getReferralDepth(affiliate9.address);
        assert.equal(depthAffiliate9.toString(), '3', 'Referral depth for affiliate9 is incorrect');

        const reward6 = await affiliates.calculateReward(affiliate6.address, depthAffiliate6);
        const reward7 = await affiliates.calculateReward(affiliate7.address, depthAffiliate7);
        const reward8 = await affiliates.calculateReward(affiliate8.address, depthAffiliate8);
        const reward9 = await affiliates.calculateReward(affiliate9.address, depthAffiliate9);

        let rewardsHierarchy2 = [reward6, reward7, reward8, reward9];

        // Assert the calculated rewards against expected values for Hierarchy 1
        expect(rewards[0].toString()).to.equal('100');
        expect(rewards[1].toString()).to.equal('70');
        expect(rewards[2].toString()).to.equal('50');
        expect(rewards[3].toString()).to.equal('30');
        expect(rewards[4].toString()).to.equal('15');

        // Assert the calculated rewards against expected values for Hierarchy 2
        expect(rewardsHierarchy2[0].toString()).to.equal('70'); // Expected value for affiliate6 in the new hierarchy
        expect(rewardsHierarchy2[1].toString()).to.equal('50'); // Expected value for affiliate7 in the new hierarchy
        expect(rewardsHierarchy2[2].toString()).to.equal('50'); // Expected value for affiliate8 in the new hierarchy
        expect(rewardsHierarchy2[3].toString()).to.equal('30'); // Expected value for affiliate9 in the new hierarchy
      });
    });

    describe('Edge Cases', function () {
      it('should avoid setting invalid commission percentages', async function () {
        await expect(
          booth.setCommissionPercent(11000), // 110% in basis points
        ).to.be.revertedWith('Invalid commission percentage');
      });

      it("should avoid joining program for object that doesn't exist", async function () {
        await expect(
          booth.connect(affiliate).joinAffiliateProgram(999, owner.address),
        ).to.be.revertedWith('Invalid object');
      });

      it('should avoid joining the affiliate program twice for the same object', async function () {
        await booth.connect(affiliate).joinAffiliateProgram(tokenId, owner.address);
        await expect(
          booth.connect(affiliate).joinAffiliateProgram(tokenId, owner.address),
        ).to.be.revertedWith('Already an affiliate for this NFT');
      });
    });

    describe('Access Control Tests', function () {
      let nonBoothAccount;
      let nonAffiliateAccount;

      beforeEach(async function () {
        [, nonBoothAccount, nonAffiliateAccount] = await ethers.getSigners();
      });

      it('should restrict access to BOOTH_ROLE functions', async function () {
        const levelToUpdate = 1;
        const rankToUpdate = 1;
        const newRewardBasisPoints = 1500;
        const BOOTH_ROLE = await affiliates.BOOTH_ROLE();

        await expect(
          affiliates
            .connect(nonBoothAccount)
            .setReferralReward(levelToUpdate, rankToUpdate, newRewardBasisPoints),
        ).to.be.revertedWith(
          'AccessControl: account ' +
            nonBoothAccount.address.toLowerCase() +
            ' is missing role ' +
            BOOTH_ROLE.toLowerCase(),
        );
      });

      it('should restrict access to AFFILIATE_ROLE functions', async function () {
        const referrer = nonAffiliateAccount.address;
        const referred = (await ethers.getSigners())[4].address;
        const AFFILIATE_ROLE = await affiliates.AFFILIATE_ROLE();

        await expect(
          affiliates.connect(nonAffiliateAccount).setReferrer(referred, referrer),
        ).to.be.revertedWith('Caller is not a booth or an affiliate'); // Update this line to match the actual error thrown by your contract
      });
    });

    describe('Event Emission Tests', function () {
      // Assuming necessary roles and permissions are already set in the beforeEach block

      it('should emit ReferralRewardUpdated event correctly', async function () {
        const level = 0;
        const rank = 0;
        const newRewardBasisPoints = 1500; // New reward basis points

        await expect(affiliates.connect(owner).setReferralReward(level, rank, newRewardBasisPoints))
          .to.emit(affiliates, 'ReferralRewardUpdated')
          .withArgs(level, rank, newRewardBasisPoints);
      });

      it('should emit RankUp event correctly', async function () {
        // Set initial sales volume and direct referrals for an affiliate
        const initialSalesVolume = ethers.utils.parseEther('1'); // Example sales volume
        await affiliates.updateSalesVolume(affiliate.address, initialSalesVolume);
        // Simulate a few direct referrals
        await affiliates.setReferrer(buyer.address, affiliate.address);
        await affiliates.setReferrer(buyer2.address, affiliate.address);

        // Check initial rank of the affiliate
        const initialRank = await affiliates.getReferrerRank(affiliate.address);
        expect(initialRank).to.equal(0); // Assuming rank starts from 0

        // Update sales volume and direct referrals to meet rank up criteria
        const rankCriteria = await affiliates.rankCriterias(1); // Assuming next rank is 1
        await affiliates.updateSalesVolume(affiliate.address, rankCriteria.requiredSalesVolume);
        for (let i = 0; i < rankCriteria.requiredDirectReferrals; i++) {
          const newBuyer = (await ethers.getSigners())[10 + i]; // Example of getting new signers
          await affiliates.setReferrer(newBuyer.address, affiliate.address);
        }

        // Perform the rank up and expect the RankUp event to be emitted
        await expect(affiliates.rankUp(affiliate.address))
          .to.emit(affiliates, 'RankUp')
          .withArgs(affiliate.address, initialRank + 1);

        // Verify that the rank has been updated
        const newRank = await affiliates.getReferrerRank(affiliate.address);
        expect(newRank).to.equal(initialRank + 1);
      });

      it('should emit DirectReferralAdded event correctly', async function () {
        await expect(affiliates.connect(owner).setReferrer(buyer.address, affiliate.address))
          .to.emit(affiliates, 'DirectReferralAdded')
          .withArgs(affiliate.address, buyer.address);
      });

      it('should emit SalesVolumeUpdated event correctly', async function () {
        const amount = ethers.utils.parseEther('1');

        await expect(affiliates.connect(owner).updateSalesVolume(affiliate.address, amount))
          .to.emit(affiliates, 'SalesVolumeUpdated')
          .withArgs(affiliate.address, amount);
      });
    });
  });
}

const testBooth = false;
if (testBooth) {
  describe('Booth Contract', function () {
    async function buyNFT(id, guy) {
      // Common setup steps
      const _nftId = id;
      const _qty = 1;
      const _guy = guy;
      const _value = nftPrice.mul(_qty);

      // Grant BUYER_ROLE and buy the NFT
      await booth.grantRole(await booth.BUYER_ROLE(), buyer.address);
      const tx = await booth.connect(buyer).buy(tokenId, _nftId, _qty, _guy, { value: _value });
      const receipt = await tx.wait();
      const purchaseMadeEvent = receipt.events.find((event) => event.event === 'PurchaseMade');
      // console.log(purchaseMadeEvent);
      await ticket_registry
        .connect(owner)
        .updateOwnershipOnMint(
          purchaseMadeEvent.args.guy,
          purchaseMadeEvent.args.tokenId,
          purchaseMadeEvent.args.nftId,
          purchaseMadeEvent.args.qty,
          purchaseMadeEvent.args.price,
          purchaseMadeEvent.args.uri,
        );
      return purchaseMadeEvent.args.nftId;
    }

    describe('Deployment and Initial Settings', function () {
      it('should deploy the Booth contract', async function () {
        expect(booth.address).to.not.equal(0x0);
        expect(booth.address).to.not.equal(null);
        expect(booth.address).to.not.equal(undefined);
        expect(booth.address).to.not.equal('');
      });

      it('should have correct initial commission percent', async function () {
        // Retrieve the current commission percent from the Booth contract
        const currentCommissionPercent = await booth.commissionPercent();

        // Assert that the current commission percent is equal to the expected initial value
        expect(currentCommissionPercent).to.equal(
          commissionPercent,
          'Initial commission percent is incorrect',
        );
      });
    });

    describe('Functional Tests', function () {
      it('should correctly set commission percent', async function () {
        // Define a new commission percent
        const newCommissionPercent = 30; // Example: 30%
        // Set the new commission percent using the Booth contract
        await booth.connect(owner).setCommissionPercent(newCommissionPercent);
        // Retrieve the updated commission percent
        const updatedCommissionPercent = await booth.commissionPercent();
        // Assert that the updated commission percent matches the new value
        expect(updatedCommissionPercent).to.equal(
          newCommissionPercent,
          'Commission percent was not updated correctly',
        );
      });

      it('should register objects and corresponding ticket contracts correctly', async function () {
        // Define a new object ID and corresponding ticket contract
        const newObjectId = 456; // Example object ID
        const newTicketContract = await Ticket.deploy(
          newObjectId,
          nftPrice,
          initialStock,
          useStock,
          limitedEdition,
          royaltyReceiver.address,
          royaltyPercentage,
          [owner.address, seller.address],
          [10, 90],
          uri,
        );
        await newTicketContract.deployed();

        // Register the new object and its ticket contract
        await booth.connect(owner).registerObject(newObjectId, newTicketContract.address);

        // Retrieve the ticket contract registered for the new object ID
        const registeredTicketContract = await booth.objectToTicket(newObjectId);

        // Assert that the registered ticket contract matches the new ticket contract
        expect(registeredTicketContract).to.equal(
          newTicketContract.address,
          'Object was not registered correctly with its ticket contract',
        );
      });

      it('should correctly authorize buyers', async function () {
        // Select a buyer to authorize (e.g., buyer2)
        const buyerToAuthorize = buyer2.address;
        // Authorize the buyer using the Booth contract
        await booth.connect(owner).authorizeBuyer(buyerToAuthorize);
        // Check if the buyer has been granted the BUYER_ROLE
        const isBuyerAuthorized = await booth.hasRole(await booth.BUYER_ROLE(), buyerToAuthorize);
        // Assert that the buyer is authorized
        expect(isBuyerAuthorized).to.equal(true, 'Buyer was not authorized correctly');
      });

      it('should handle affiliate program joins and purchases', async function () {
        const nftId = 1;
        const qty = 1;

        // Affiliate 1 becomes affiliate of NFT
        await booth.connect(affiliate).joinAffiliateProgram(tokenId, owner.address);
        // Affiliate2 joins affiliate program under Affiliate and buys the NFT
        // 1) Grant Buyer Role to Affiliate 2
        await booth.grantRole(await booth.BUYER_ROLE(), affiliate2.address);
        // 2) call joinAffiliateProgramAndBuy method with affiliate 2
        await booth
          .connect(affiliate2)
          .joinAffiliateProgramAndBuy(tokenId, nftId, qty, affiliate.address, {
            value: nftPrice.mul(qty),
          });

        // Check if Affiliate2 is an affiliate for the course
        // Check if Affiliate2 is added under Affiliate

        // Check if Affiliate2 is an affiliate for the course
        expect(await booth.verifyAffiliate(tokenId, affiliate2.address)).to.be.true;
        // Check if Affiliate2 is added under Affiliate
        expect(await affiliates.referrers(affiliate2.address)).to.equal(affiliate.address);
      });

      it('should correctly handle affiliate buys', async function () {
        // Test affiliate buys
        await affiliates.setReferrer(affiliate2.address, affiliate.address);
        // Affiliate 2 refers affiliate 3
        await affiliates.setReferrer(affiliate3.address, affiliate2.address);

        // Store initial balances of the affiliates
        const initialBalanceAffiliate1 = await ethers.provider.getBalance(affiliate.address);
        const initialBalanceAffiliate2 = await ethers.provider.getBalance(affiliate2.address);

        // Simulate a purchase that should trigger rewards
        // Make sure the buyer has the BUYER_ROLE and enough funds
        await booth.grantRole(await booth.BUYER_ROLE(), affiliate3.address);
        // affiliate 3 will make a purchase
        await booth
          .connect(affiliate3)
          .affiliateBuy(tokenId, 1, 1, affiliate3.address, { value: nftPrice.mul(1) });
        const finalBalanceAffiliate1 = await ethers.provider.getBalance(affiliate.address);
        const finalBalanceAffiliate2 = await ethers.provider.getBalance(affiliate2.address);

        expect(finalBalanceAffiliate1).to.be.above(initialBalanceAffiliate1);
        expect(finalBalanceAffiliate2).to.be.above(initialBalanceAffiliate2);
      });

      it('should correctly verify affiliate status', async function () {
        // Define parameters for the test
        const objectId = tokenId; // Use the existing tokenId for simplicity
        const referrer = owner.address; // Use the owner as a referrer for simplicity

        // Affiliate joins the program for the specified object
        await booth.connect(affiliate).joinAffiliateProgram(objectId, referrer);

        // Verify affiliate status for the object
        const isAffiliateRegistered = await booth.verifyAffiliate(objectId, affiliate.address);

        // Assert that the affiliate is correctly registered for the object
        expect(isAffiliateRegistered).to.equal(true, 'Affiliate status not correctly verified');
      });

      it('should correctly handle NFT purchases', async function () {
        const guy = buyer.address;
        const nftId = await buyNFT(1, guy);
        const nft_blance = await ticket.balanceOf(buyer.address, nftId);
        expect(nft_blance).to.equal(1);
        // Test if the BUYER_ROLE has been revoked from the buyer
        expect(await booth.hasRole(await booth.BUYER_ROLE(), buyer.address)).to.equal(false);
      });

      it('should correctly handle NFT purchases with discount', async function () {
        const nftId = 1;
        const qty = 1;
        const guy = buyer.address;
        await booth.grantRole(await booth.BUYER_ROLE(), buyer.address);
        await booth
          .connect(buyer)
          .buy(tokenId, nftId, qty, guy, { value: ethers.utils.parseEther('0.005') });
      });

      it('should store purchase details accurately', async function () {
        // Define the parameters for the buy function
        let _nftId = 1;
        let _qty = 1;
        let _guy = buyer.address; // Assuming accounts[1] is the buyer
        let _value = nftPrice.mul(_qty);

        // Get the initial balance of the buyer
        const initialBalance = await ethers.provider.getBalance(_guy);

        // Call the buy function
        await booth.grantRole(await booth.BUYER_ROLE(), buyer.address);
        await booth.connect(buyer).buy(tokenId, _nftId, _qty, _guy, { value: nftPrice.mul(_qty) });

        // Get the final balance of the buyer
        const finalBalance = await ethers.provider.getBalance(_guy);

        // Check if the buyer's balance has decreased correctly
        expect(initialBalance).to.be.above(finalBalance);

        // Retrieve the purchase details
        let purchase = await booth.ticketBuyers(tokenId, _guy);

        // Check if the purchase details are stored correctly
        assert.equal(purchase.tokenId, tokenId, 'The tokenId was not stored correctly');
        assert.equal(purchase.nftId, _nftId, 'The nftId was not stored correctly');
        assert.equal(purchase.qty, _qty, 'The quantity was not stored correctly');
        assert.equal(
          purchase.price.toString(),
          _value.toString(),
          'The price was not stored correctly',
        );
      });

      it('should handle gift NFTs correctly', async function () {
        // Test gifting NFTs
        const nftId = 1;
        const qty = 1;
        const guy = affiliate.address;

        await booth.connect(owner).gift(tokenId, nftId, qty, guy, { value: nftPrice.mul(qty) });
        const nft_blance = await ticket.balanceOf(guy, nftId);
        expect(nft_blance).to.equal(1);
      });

      it('should correctly verify ticket access', async function () {
        // Test verifying ticket access
        const nftId = 1;
        const qty = 1;
        const guy = buyer.address;

        // console.log('Initial Stock',currentStock)
        await booth.grantRole(await booth.BUYER_ROLE(), buyer.address);
        await booth.connect(buyer).buy(tokenId, nftId, qty, guy, { value: nftPrice.mul(qty) });
        // Now, test if the buyer has access to the NFT
        expect(await ticket.balanceOf(guy, nftId)).to.equal(1);
        // You can also test if another buyer (who didn't buy the NFT) doesn't have access
        expect(await ticket.balanceOf(affiliate.address, nftId)).to.equal(0);
      });

      it('should correctly check object registration status', async function () {
        // Test checking object registration status
        expect(await booth.isObjectRegistered(tokenId)).to.equal(true);
      });
    });

    describe('Access Control Tests', function () {
      it('should restrict access to BOOTH_ROLE functions', async function () {
        // Define a function that requires the BOOTH_ROLE

        const BOOTH_ROLE = await booth.BOOTH_ROLE();

        let functionRequiringBoothRole = async () => {
          await booth.connect(buyer).registerObject(tokenId, ticket.address);
        };

        // Expect the function to fail when called by an account without the BOOTH_ROLE
        await expect(functionRequiringBoothRole()).to.be.revertedWith(
          'AccessControl: account ' +
            buyer.address.toLowerCase() +
            ' is missing role ' +
            BOOTH_ROLE.toLowerCase(),
        );
      });

      it('should restrict access to BUYER_ROLE functions', async function () {
        const _nftId = 1;
        const _qty = 1;
        const _guy = buyer.address;

        let functionRequiringBuyerRole = async () => {
          await booth
            .connect(buyer)
            .buy(tokenId, _nftId, _qty, _guy, { value: nftPrice.mul(_qty) });
        };

        const BUYER_ROLE = await booth.BUYER_ROLE();

        // Expect the function to fail when called by an account without the BUYER_ROLE
        await expect(functionRequiringBuyerRole()).to.be.revertedWith(
          'AccessControl: account ' +
            buyer.address.toLowerCase() +
            ' is missing role ' +
            BUYER_ROLE.toLowerCase(),
        );
      });
    });

    describe('Event Emission Tests', function () {
      it('should emit CommissionSet event correctly', async function () {
        // Define a new commission percent
        const newCommissionPercent = 30; // Example: 30%

        // Set the new commission percent using the Booth contract and expect the CommissionSet event
        await expect(booth.connect(owner).setCommissionPercent(newCommissionPercent))
          .to.emit(booth, 'CommissionSet')
          .withArgs(newCommissionPercent);
      });

      it('should emit ObjectRegistered event correctly', async function () {
        // Define a new object ID and corresponding ticket contract
        const newObjectId = 456; // Example object ID
        const newTicketContract = await Ticket.deploy(
          newObjectId,
          nftPrice,
          initialStock,
          useStock,
          limitedEdition,
          royaltyReceiver.address,
          royaltyPercentage,
          [owner.address, seller.address],
          [10, 90],
          uri,
        );
        await newTicketContract.deployed();

        // Register the new object and its ticket contract and expect the ObjectRegistered event
        await expect(booth.connect(owner).registerObject(newObjectId, newTicketContract.address))
          .to.emit(booth, 'ObjectRegistered')
          .withArgs(newObjectId, newTicketContract.address);
      });

      it('should emit BuyerAuthorized event correctly', async function () {
        // Select a buyer to authorize (e.g., buyer2)
        const buyerToAuthorize = buyer2.address;

        // Authorize the buyer using the Booth contract and expect the BuyerAuthorized event
        await expect(booth.connect(owner).authorizeBuyer(buyerToAuthorize))
          .to.emit(booth, 'BuyerAuthorized')
          .withArgs(buyerToAuthorize);
      });

      it('should emit AffiliateJoined event correctly', async function () {
        // Define a new object ID and corresponding ticket contract
        const newObjectId = 456; // Example object ID
        const newTicketContract = await Ticket.deploy(
          newObjectId,
          nftPrice,
          initialStock,
          useStock,
          limitedEdition,
          royaltyReceiver.address,
          royaltyPercentage,
          [owner.address, seller.address],
          [10, 90],
          uri,
        );
        await newTicketContract.deployed();

        // Register the new object and its ticket contract
        await booth.connect(owner).registerObject(newObjectId, newTicketContract.address);

        // Define a referrer
        const referrer = affiliate2.address;

        // Join the affiliate program using the Booth contract and expect the AffiliateJoined event
        await expect(booth.connect(affiliate).joinAffiliateProgram(newObjectId, referrer))
          .to.emit(booth, 'AffiliateJoined')
          .withArgs(newObjectId, affiliate.address, referrer);
      });

      it('should emit PurchaseMade event correctly', async function () {
        const nftId = 1;
        const qty = 1;
        const guy = buyer.address;

        // Grant BUYER_ROLE to the buyer
        await booth.grantRole(await booth.BUYER_ROLE(), buyer.address);

        // Get the current block for the timestamp
        const block = await ethers.provider.getBlock('latest');
        const timestamp = block.timestamp;

        // Buy the NFT and expect the PurchaseMade event
        const tx = await booth
          .connect(buyer)
          .buy(tokenId, nftId, qty, guy, { value: nftPrice.mul(qty) });

        // Get the block of the transaction
        const txReceipt = await tx.wait();
        const txBlock = await ethers.provider.getBlock(txReceipt.blockNumber);

        // Check the timestamp difference
        const timeDifference = Math.abs(txBlock.timestamp - timestamp);

        // Expect the time difference to be less than or equal to 2 seconds
        assert(timeDifference <= 2, 'Timestamp difference is more than 2 seconds');

        const nftUri = await ticket.uri(nftId);
        // Expect the PurchaseMade event with the correct arguments
        await expect(tx)
          .to.emit(booth, 'PurchaseMade')
          .withArgs(tokenId, nftId, qty, guy, nftPrice.mul(qty), nftUri, txBlock.timestamp);
      });

      it('should emit NftGifted event correctly', async function () {
        // Define a recipient for the NFT gift
        const recipient = buyer2.address;

        // Define a NFT ID and quantity for the gift
        const nftId = 1;
        const qty = 1;

        // Gift the NFT using the Booth contract and expect the NftGifted event
        await expect(booth.connect(owner).gift(tokenId, nftId, qty, recipient))
          .to.emit(booth, 'NftGifted')
          .withArgs(tokenId, nftId, qty, recipient);
      });
    });
  });
}

const testTicketRegistry = true;
if (testTicketRegistry) {
  describe('Ticket Registry Contract', function () {
    async function buyNFT(id, guy) {
      // Common setup steps
      const _nftId = id;
      const _qty = 1;
      const _guy = guy;
      const _value = nftPrice.mul(_qty);

      // Grant BUYER_ROLE and buy the NFT
      await booth.grantRole(await booth.BUYER_ROLE(), buyer.address);
      const tx = await ticket.connect(buyer).mint(tokenId, _nftId, _qty, _guy, { value: _value });
      const receipt = await tx.wait();
      const mintEvent = receipt.events.find((event) => event.event === 'Mint');
      await ticket_registry
        .connect(owner)
        .updateOwnershipOnMint(
          mintEvent.args.guy,
          mintEvent.args.tokenId,
          mintEvent.args.nftId,
          mintEvent.args.qty,
          mintEvent.args.price,
          mintEvent.args.uri,
        );
      return mintEvent.args.nftId;
    }

    describe('Deployment and Initial Settings', function () {
      it('should deploy the Ticket Registry contract', async function () {
        expect(ticket_registry.address).to.not.equal(0x0);
        expect(ticket_registry.address).to.not.equal(null);
        expect(ticket_registry.address).to.not.equal(undefined);
        expect(ticket_registry.address).to.not.equal('');
      });
      it('should have correct initial settings', async function () {});
    });

    describe('Functional Tests', function () {
      it('should correctly register a ticket contract', async function () {
        // Define a new object ID and corresponding ticket contract
        const newObjectId = 456; // Example object ID
        const newTicketContract = await Ticket.deploy(
          newObjectId,
          nftPrice,
          initialStock,
          useStock,
          limitedEdition,
          royaltyReceiver.address,
          royaltyPercentage,
          [owner.address, seller.address],
          [10, 90],
          uri,
        );
        await newTicketContract.deployed();

        // Register the new object and its ticket contract
        await ticket_registry.connect(owner).registerObject(newObjectId, newTicketContract.address);

        // // Retrieve the ticket contract registered for the new object ID
        // const registeredTicketContract = await ticket_registry.isObjectRegistered(newObjectId);

        // // Assert that the registered ticket contract matches the new ticket contract
        // expect(registeredTicketContract).to.equal(true);
      });

      it('should prevent re-registering an already registered ticket contract', async function () {
        // Use an existing object ID and ticket contract for this test
        const existingObjectId = tokenId; // tokenId from the beforeEach setup
        const existingTicketContract = ticket; // ticket contract from the beforeEach setup

        // Attempt to re-register the same object ID and ticket contract
        // This should fail since it's already registered in the beforeEach setup
        let errorThrown = false;
        try {
          await ticket_registry
            .connect(owner)
            .registerObject(existingObjectId, existingTicketContract.address);
        } catch (error) {
          errorThrown = true;
          expect(error.message).to.include('Object already registered');
        }

        // Assert that an error was thrown
        expect(errorThrown).to.be.true;
      });

      it('should correctly check if an object is registered', async function () {
        // Define a new object ID and corresponding ticket contract
        const newObjectId = 456; // Example object ID
        const newTicketContract = await Ticket.deploy(
          newObjectId,
          nftPrice,
          initialStock,
          useStock,
          limitedEdition,
          royaltyReceiver.address,
          royaltyPercentage,
          [owner.address, seller.address],
          [10, 90],
          uri,
        );
        await newTicketContract.deployed();

        // Register the new object and its ticket contract
        await ticket_registry.connect(owner).registerObject(newObjectId, newTicketContract.address);

        // Retrieve the ticket contract registered for the new object ID
        const registeredTicketContract = await ticket_registry.isObjectRegistered(newObjectId);

        // Assert that the registered ticket contract matches the new ticket contract
        expect(registeredTicketContract).to.equal(true);
      });

      it('should return the correct stock for a registered ticket', async function () {
        // Use an existing object ID for this test
        const objectId = tokenId; // tokenId from the beforeEach setup

        // Retrieve the remaining stock for the ticket
        const remainingStock = await ticket_registry.getStock(objectId);

        // Calculate the expected remaining stock
        const expectedRemainingStock = initialStock - (await ticket.totalSupply(objectId));

        // Assert that the remaining stock matches the expected value
        expect(remainingStock).to.equal(expectedRemainingStock);
      });

      it('should accurately report the use of stock for a ticket', async function () {
        // Use an existing object ID for this test
        const objectId = tokenId; // tokenId from the beforeEach setup

        // Check if the ticket uses stock
        const usesStock = await ticket_registry.getUseStock(objectId);

        // Assert that the use of stock matches the setup in the contract
        expect(usesStock).to.equal(useStock);
      });

      // Additional functional tests can be added here
      it('should list user owned nfts', async function () {
        const guy = buyer.address;
        const nftIDs = [123, 321, 231, 213];
        const boughtNFTs = [];

        for (let i = 0; i < nftIDs.length; i++) {
          const nftID = await buyNFT(nftIDs[i], guy);
          boughtNFTs.push(nftID);
          expect(await ticket.balanceOf(buyer.address, nftID)).to.equal(1);
        }

        const [ownedNFTs, totalNFTs] = await ticket_registry.getOwnedNFTs(guy, 1, 12);

        expect(ownedNFTs.length).to.be.equal(boughtNFTs.length);
        expect(totalNFTs).to.be.equal(boughtNFTs.length);
      });
    });

    describe('Access Control Tests', function () {
      it('should restrict registration function to only users with BOOKING_ROLE', async function () {
        // Test restriction of registration function

        const BOOKING_ROLE = await ticket_registry.BOOKING_ROLE();

        let functionRequiringTicketRegistryRole = async () => {
          await ticket_registry.connect(buyer).registerObject(tokenId, ticket.address);
        };

        // Expect the function to fail when called by an account without the BOOKING_ROLE
        await expect(functionRequiringTicketRegistryRole()).to.be.revertedWith(
          'AccessControl: account ' +
            buyer.address.toLowerCase() +
            ' is missing role ' +
            BOOKING_ROLE.toLowerCase(),
        );
      });
    });

    describe('Event Emission Tests', function () {
      it('should emit an ObjectRegistered event on successful registration', async function () {
        // Define a new object ID and corresponding ticket contract for testing
        const newObjectId = 789; // Example new object ID
        const newTicketContract = await Ticket.deploy(
          newObjectId,
          nftPrice,
          initialStock,
          useStock,
          limitedEdition,
          royaltyReceiver.address,
          royaltyPercentage,
          [owner.address, seller.address],
          [10, 90],
          uri,
        );
        await newTicketContract.deployed();

        // Register the new object and listen for the ObjectRegistered event
        await expect(
          ticket_registry.connect(owner).registerObject(newObjectId, newTicketContract.address),
        )
          .to.emit(ticket_registry, 'ObjectRegistered')
          .withArgs(newObjectId, newTicketContract.address);
      });
    });
  });
}

const testAuctions = false;
if (testAuctions) {
  describe('Auctions Contract', function () {
    async function setupAuction() {
      // Common setup steps
      const _nftId = 123;
      const _qty = 1;
      const _guy = buyer.address;
      const _value = nftPrice.mul(_qty);

      // Grant BUYER_ROLE and buy the NFT
      await booth.grantRole(await booth.BUYER_ROLE(), buyer.address);
      await booth.connect(buyer).buy(tokenId, _nftId, _qty, _guy, { value: _value });

      // Grant Auctions contract approval to manage buyer's tokens
      await ticket.connect(buyer).setApprovalForAll(auctions.address, true);

      // Create the auction
      const _startingPrice = ethers.utils.parseEther('0.02');
      const _duration = 7 * 24 * 60 * 60; // 1 week in seconds
      const _reservePrice = nftPrice;

      const tx = await auctions
        .connect(buyer)
        .createAuction(tokenId, _nftId, _startingPrice, _duration, _reservePrice);
      const receipt = await tx.wait();

      return receipt.events.find((event) => event.event === 'AuctionCreated').args.auctionId;
    }

    let auctionID;

    beforeEach(async function () {
      // Common setup for each test
      auctionID = await setupAuction();
    });

    describe('Deployment and Initial Settings', function () {
      it('should deploy the Auctions contract', async function () {
        // Test for successful deployment
        expect(auctions.address).to.not.equal(0x0);
        expect(auctions.address).to.not.equal(null);
        expect(auctions.address).to.not.equal(undefined);
        expect(auctions.address).to.not.equal('');
      });

      it('should have correct initial minimum bid increment', async function () {
        // Test for correct initial minBidIncrement
        const _minBidIncrement = await auctions.minBidIncrement();
        expect(_minBidIncrement.toString()).to.equal(initialMinBidIncrement.toString());
      });

      it('should have correct initial time extension threshold', async function () {
        // Test for correct initial timeExtensionThreshold
        const _timeExtensionThreshold = await auctions.timeExtensionThreshold();
        expect(_timeExtensionThreshold).to.equal(timeExtensionThreshold);
      });
    });

    describe('Auction Creation and Management', function () {
      // Handler to Buy a token and Create an Auction
      it('should correctly create an auction', async function () {
        expect(auctionID).to.be.equal(0);
      });

      it('should correctly cancel an auction', async function () {
        const cancel_tx = await auctions.connect(buyer).cancelAuction(auctionID);
        const cancel_receipt = await cancel_tx.wait();
        const auctionCancelledEvent = cancel_receipt.events.find(
          (event) => event.event === 'AuctionCancelled',
        );
        expect(auctionCancelledEvent).to.exist;
      });

      it('should correctly end an auction without a bid', async function () {
        // Buyer should not own the nft as it is auctioned
        const _nftId = 123;

        const initialNftBalance = await ticket.balanceOf(buyer.address, _nftId);
        expect(initialNftBalance).to.equal(0);

        // Fast forward time by one week (the duration of the auction)
        await network.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]); // 1 week in seconds
        await network.provider.send('evm_mine');

        // Now end the auction
        const tx = await auctions.connect(owner).endAuction(auctionID);
        const receipt = await tx.wait();
        const auctionEndedWithoutSaleEvent = receipt.events.find(
          (event) => event.event === 'AuctionEndedWithoutSale',
        );
        expect(auctionEndedWithoutSaleEvent).to.exist;

        // Buyer should have the nft returned
        const finalNftBalance = await ticket.balanceOf(buyer.address, _nftId);
        expect(finalNftBalance).to.equal(1);
      });

      it('should correctly handle bid placement', async function () {
        // Setup bid amount (should be higher than current highest bid and meet minimum increment requirements)
        const bidAmount = ethers.utils.parseEther('1.1'); // Assuming 1 MATIC is the minimum increment

        // Place a bid on the auction
        const tx = await auctions.connect(buyer2).placeBid(auctionID, { value: bidAmount });
        const receipt = await tx.wait();

        // Check for the 'BidPlaced' event
        const bidPlacedEvent = receipt.events.find((event) => event.event === 'BidPlaced');
        expect(bidPlacedEvent).to.exist;

        // Check if the highest bid and bidder are updated correctly
        const updatedAuction = await auctions.auctions(auctionID);
        expect(updatedAuction.highestBid).to.equal(bidAmount);
        expect(updatedAuction.highestBidder).to.equal(buyer2.address);
      });

      it('should correctly end an auction with a bid', async function () {
        // Get initial balance of buyer
        const initialBuyerBalance = await ethers.provider.getBalance(buyer.address);
        // Get initial nft has access of buyer2
        const _nftId = 123;
        const initialNftBalance = await ticket.balanceOf(buyer2.address, _nftId);
        expect(initialNftBalance).to.equal(0);

        // Place a bid on the auction, buyer2 will bid
        const additionalAmount = ethers.utils.parseEther('0.1'); // 0.1 MATIC in wei
        const _bidAmount = initialMinBidIncrement.add(additionalAmount);

        const bid_tx = await auctions.connect(buyer2).placeBid(auctionID, { value: _bidAmount });
        const bid_receipt = await bid_tx.wait();

        // Check for the 'BidPlaced' event
        const bidPlacedEvent = bid_receipt.events.find((event) => event.event === 'BidPlaced');
        expect(bidPlacedEvent).to.exist;

        // Fast forward time by one week (the duration of the auction)
        await network.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]); // 1 week in seconds
        await network.provider.send('evm_mine');

        // Now end the auction
        const end_tx = await auctions.connect(owner).endAuction(auctionID);
        const end_receipt = await end_tx.wait();
        const auctionEndedEvent = end_receipt.events.find(
          (event) => event.event === 'AuctionEnded',
        );
        expect(auctionEndedEvent).to.exist;

        // Ensure funds are transferred to buyer
        const finalBuyerBalance = await ethers.provider.getBalance(buyer.address);
        expect(finalBuyerBalance).to.be.above(initialBuyerBalance);

        // Ensure buyer2 now has access to the nft
        const finalNftBalance = await ticket.balanceOf(buyer2.address, _nftId);
        expect(finalNftBalance).to.equal(1);
      });

      it('should correctly handle automatic bid refund on outbid', async function () {
        // Initial setup: buyer2 places the first bid
        const firstBidAmount = initialMinBidIncrement.add(ethers.utils.parseEther('0.1')); // First bid by buyer2
        await auctions.connect(buyer2).placeBid(auctionID, { value: firstBidAmount });

        const initialBuyerBalance = await ethers.provider.getBalance(buyer.address);

        // Retrieve the current highest bid from the auction
        let auction = await auctions.auctions(auctionID);
        let currentHighestBid = auction.highestBid;

        // affiliate prepares to outbid by adding minimum increment to the current highest bid
        const outbidAmount = currentHighestBid.add(initialMinBidIncrement);
        const outbidTx = await auctions
          .connect(affiliate)
          .placeBid(auctionID, { value: outbidAmount });
        const outbidReceipt = await outbidTx.wait();

        // Check if affiliate's bid was successful
        auction = await auctions.auctions(auctionID);
        expect(auction.highestBidder).to.equal(affiliate.address);
        expect(auction.highestBid).to.equal(outbidAmount);

        // Check if buyer2 was refunded
        const finalBuyerBalance = await ethers.provider.getBalance(buyer.address);
        expect(initialBuyerBalance).to.equal(finalBuyerBalance);

        // Check for the 'BidRefunded' event
        const bidRefundedEvent = outbidReceipt.events.find(
          (event) => event.event === 'BidRefunded',
        );
        expect(bidRefundedEvent).to.exist;
        expect(bidRefundedEvent.args.auctionId).to.equal(auctionID);
        expect(bidRefundedEvent.args.bidder).to.equal(buyer2.address);
        expect(bidRefundedEvent.args.amount).to.equal(firstBidAmount);

        // Check for the 'BidOutbid' event
        const bidOutbidEvent = outbidReceipt.events.find((event) => event.event === 'BidOutbid');
        expect(bidOutbidEvent).to.exist;
        expect(bidOutbidEvent.args.auctionId).to.equal(auctionID);
        expect(bidOutbidEvent.args.outbidBidder).to.equal(buyer2.address);
        expect(bidOutbidEvent.args.amount).to.equal(firstBidAmount);
      });

      it('should correctly extend auction time on last-minute bids', async function () {
        // Setup auction and get its ID
        const auctionID = await setupAuction();

        // Get the current blockchain time
        let currentBlock = await ethers.provider.getBlock('latest');
        let currentTime = currentBlock.timestamp;

        // Get auction details before placing bid
        let auctionBeforeBid = await auctions.auctions(auctionID);
        const endTimeBeforeBid = auctionBeforeBid.endTime;

        // Calculate time to move just before the auction ends (e.g., 1 minute before the end)
        const timeBeforeEnd = endTimeBeforeBid - currentTime - 60; // 60 seconds before the end
        await network.provider.send('evm_increaseTime', [timeBeforeEnd]);
        await network.provider.send('evm_mine');

        // Place a bid in the last minute
        const bidAmount = ethers.utils.parseEther('1.1'); // Bid amount greater than minimum increment
        await auctions.connect(buyer2).placeBid(auctionID, { value: bidAmount });

        // Get the current time again after the bid is placed
        currentBlock = await ethers.provider.getBlock('latest');
        currentTime = currentBlock.timestamp;

        let auctionAfterBid = await auctions.auctions(auctionID);
        const endTimeAfterBid = auctionAfterBid.endTime;

        // Calculate the extension duration
        const extensionDuration = endTimeAfterBid - endTimeBeforeBid;

        // Assert that the extension is approximately the timeExtensionThreshold duration
        // Adding a small buffer (e.g., 60 seconds) to account for time taken by transactions and block mining
        const buffer = 60; // 60 seconds buffer
        expect(extensionDuration).to.be.closeTo(timeExtensionThreshold, buffer);

        // Optionally, log formatted dates for verification
        // const formattedEndTimeBeforeBid = new Date(endTimeBeforeBid * 1000).toISOString();
        // const formattedEndTimeAfterBid = new Date(endTimeAfterBid * 1000).toISOString();
        // console.log('Auction End Time Before Bid:', formattedEndTimeBeforeBid);
        // console.log('Auction End Time After Bid:', formattedEndTimeAfterBid);
      });

      it('should not be able to withdraw leading bid', async function () {
        // Setup auction and get its ID
        const auctionID = await setupAuction();

        // Buyer2 places a bid
        const buyer2BidAmount = initialMinBidIncrement.add(ethers.utils.parseEther('0.1'));
        await auctions.connect(buyer2).placeBid(auctionID, { value: buyer2BidAmount });

        // Simulate waiting for the bid lock period to pass
        await network.provider.send('evm_increaseTime', [bidLockPeriod]);
        await network.provider.send('evm_mine');

        // Attempt to withdraw the bid and expect it to fail
        try {
          await auctions.connect(buyer2).withdrawBid(auctionID);
          assert.fail('The transaction should have failed');
        } catch (error) {
          // Expected to throw an error
          expect(error.message).to.include('Cannot withdraw leading bid');
        }
      });

      it('should correctly update auction and bid history', async function () {
        // Setup initial bid amount by buyer2
        const initialBidAmount = ethers.utils.parseEther('1.0');
        await auctions.connect(buyer2).placeBid(auctionID, { value: initialBidAmount });

        // Setup new bid amount by buyer (higher than the initial bid)
        const newBidAmount = ethers.utils.parseEther('2.1');
        await auctions.connect(buyer).placeBid(auctionID, { value: newBidAmount });

        // Retrieve the updated auction details
        const updatedAuction = await auctions.auctions(auctionID);
        expect(updatedAuction.highestBid).to.equal(newBidAmount);
        expect(updatedAuction.highestBidder).to.equal(buyer.address);

        // Retrieve the bid history for the auction
        const bidHistory = await auctions.getAuctionBids(auctionID);

        // Check that the bid history contains both bids
        expect(bidHistory.length).to.equal(2);

        // Verify the details of the initial bid by buyer2
        expect(bidHistory[0].bidder).to.equal(buyer2.address);
        expect(bidHistory[0].amount).to.equal(initialBidAmount);

        // Verify the details of the new bid by buyer
        expect(bidHistory[1].bidder).to.equal(buyer.address);
        expect(bidHistory[1].amount).to.equal(newBidAmount);
      });
    });

    describe('Access Control Tests', function () {
      it('should restrict access to BOOTH_ROLE functions', async function () {
        // Test access control for BOOTH_ROLE functions
        const BOOTH_ROLE = await auctions.BOOTH_ROLE();

        let functionRequiringBoothRole = async () => {
          await auctions.connect(buyer).endAuction(auctionID);
        };

        // Expect the function to fail when called by an account without the BOOKING_ROLE
        await expect(functionRequiringBoothRole()).to.be.revertedWith(
          'AccessControl: account ' +
            buyer.address.toLowerCase() +
            ' is missing role ' +
            BOOTH_ROLE.toLowerCase(),
        );
      });
    });

    describe('Update Configuration Tests', function () {
      it('should correctly update minimum bid increment', async function () {
        const newMinBidIncrement = ethers.utils.parseEther('0.02'); // New value for minimum bid increment
        await auctions.setMinBidIncrement(newMinBidIncrement);
        const updatedMinBidIncrement = await auctions.minBidIncrement();
        expect(updatedMinBidIncrement).to.equal(newMinBidIncrement);
      });

      it('should correctly update time extension threshold', async function () {
        const newTimeExtensionThreshold = 600; // New value for time extension threshold in seconds (10 minutes)
        await auctions.setTimeExtensionThreshold(newTimeExtensionThreshold);
        const updatedTimeExtensionThreshold = await auctions.timeExtensionThreshold();
        expect(updatedTimeExtensionThreshold).to.equal(newTimeExtensionThreshold);
      });

      it('should correctly pause and unpause the contract', async function () {
        // Pause the contract
        await auctions.pause();
        let paused = await auctions.paused();
        expect(paused).to.be.true;

        // Unpause the contract
        await auctions.unpause();
        paused = await auctions.paused();
        expect(paused).to.be.false;
      });
    });
  });
}

const testAuctionUtilities = false;
if (testAuctionUtilities) {
  describe('AuctionUtils Contract Tests', function () {
    async function setupAuction(nftId) {
      // Common setup steps
      const _nftId = nftId;
      const _qty = 1;
      const _guy = buyer.address;
      const _value = nftPrice.mul(_qty);

      // Grant BUYER_ROLE and buy the NFT
      await booth.grantRole(await booth.BUYER_ROLE(), buyer.address);
      await booth.connect(buyer).buy(tokenId, _nftId, _qty, _guy, { value: _value });

      // Grant Auctions contract approval to manage buyer's tokens
      await ticket.connect(buyer).setApprovalForAll(auctions.address, true);

      // Create the auction
      const _startingPrice = ethers.utils.parseEther('0.02');
      const _duration = 7 * 24 * 60 * 60; // 1 week in seconds
      const _reservePrice = nftPrice;

      const tx = await auctions
        .connect(buyer)
        .createAuction(tokenId, _nftId, _startingPrice, _duration, _reservePrice);
      const receipt = await tx.wait();

      return receipt.events.find((event) => event.event === 'AuctionCreated').args.auctionId;
    }

    let auctionID;

    beforeEach(async function () {
      // Common setup for each test
      auctionID = await setupAuction(123);
    });

    describe('Deployment and Initial Settings', function () {
      it('should deploy the AuctionUtils contract', async function () {
        // Test for successful deployment
        expect(auction_utilities.address).to.not.equal(0x0);
        expect(auction_utilities.address).to.not.equal(null);
        expect(auction_utilities.address).to.not.equal(undefined);
        expect(auction_utilities.address).to.not.equal('');
      });
    });

    // Test for getRemainingTime
    describe('Get Remaining Time', function () {
      it('should return the correct remaining time for an ongoing auction', async function () {
        // Fetch the auction info to get its endTime
        const auctionInfo = await auctions.getAuctionInfo(auctionID);
        const endTime = auctionInfo.endTime;

        // Get the current block timestamp
        const currentBlock = await ethers.provider.getBlock('latest');
        const currentTime = currentBlock.timestamp;

        // Calculate expected remaining time
        const expectedRemainingTime = endTime - currentTime;

        // Get the remaining time from the contract
        const remainingTime = await auction_utilities.getRemainingTime(auctionID);

        // Check if the remaining time is as expected
        expect(remainingTime).to.be.closeTo(expectedRemainingTime, 5); // 5-second buffer for block time variations
      });

      it('should return 0 for an ended auction', async function () {
        // Fetch the auction info to get its endTime
        const auctionInfo = await auctions.getAuctionInfo(auctionID);
        const endTime = auctionInfo.endTime;

        // Get the current block timestamp
        const currentBlock = await ethers.provider.getBlock('latest');
        const currentTime = currentBlock.timestamp;

        // Calculate the time to increase to go past the auction's end time
        const timeToIncrease = endTime - currentTime + 1; // Plus 1 to ensure we're past the end time

        // Check if the time to increase is a valid number and greater than 0
        if (isNaN(timeToIncrease) || timeToIncrease <= 0) {
          throw new Error('Invalid time to increase for simulation');
        }

        // Increase the blockchain time
        await ethers.provider.send('evm_increaseTime', [timeToIncrease]);
        await ethers.provider.send('evm_mine');

        // Check the remaining time
        const remainingTime = await auction_utilities.getRemainingTime(auctionID);
        expect(remainingTime).to.equal(0);
      });
    });

    // Test for getUserActiveAuctions
    describe('Get User Active Auctions', function () {
      it('should return active auctions for a given user', async function () {
        // Create a few more auctions for buyer.address
        await setupAuction(2344);
        await setupAuction(4325);
        await setupAuction(578);

        // Get active auctions for the user
        const firstPage = await auction_utilities.getUserActiveAuctions(buyer.address, 1, 4);
        // console.log(firstPage[0])
        // console.log(firstPage[1])
        // Check the number of active auctions returned
        expect(firstPage[0].length).to.equal(4);
        expect(firstPage[1]).to.equal(4);
      });

      it('should handle pagination correctly', async function () {
        // Create a few more auctions for buyer.address
        await setupAuction(2344);
        await setupAuction(4325);
        await setupAuction(578);

        await setupAuction(756);
        await setupAuction(9785);
        await setupAuction(4564566);
        await setupAuction(5677);

        // Fetching first page (Page 1, 4 items per page)
        const firstPage = await auction_utilities.getUserActiveAuctions(buyer.address, 1, 4);
        // console.log("First Page: ", firstPage);
        expect(firstPage[0].length).to.equal(4); // Expect 4 auctions in the first page

        // Fetching second page (Page 2, 4 items per page)
        const secondPage = await auction_utilities.getUserActiveAuctions(buyer.address, 2, 4);
        // console.log("Second Page: ", secondPage);
        expect(secondPage[0].length).to.equal(4); // Expect 4 auctions in the second page
      });
    });

    // Test for getUserBiddingHistory
    describe('Get User Bidding History', function () {
      it('should return the correct bidding history for a user', async function () {
        // Initial setup: buyer2 places the first bid
        let bidAmount = initialMinBidIncrement.add(ethers.utils.parseEther('0.1')); // First bid by buyer2
        await auctions.connect(buyer2).placeBid(auctionID, { value: bidAmount });

        // Affiliate outbids buyer2
        bidAmount = bidAmount.add(initialMinBidIncrement);
        await auctions.connect(affiliate).placeBid(auctionID, { value: bidAmount });

        // Buyer2 outbids affiliate again
        bidAmount = bidAmount.add(initialMinBidIncrement);
        await auctions.connect(buyer2).placeBid(auctionID, { value: bidAmount });

        // Affiliate outbids buyer2 again
        bidAmount = bidAmount.add(initialMinBidIncrement);
        await auctions.connect(affiliate).placeBid(auctionID, { value: bidAmount });

        // Buyer2 places the final bid
        bidAmount = bidAmount.add(initialMinBidIncrement);
        await auctions.connect(buyer2).placeBid(auctionID, { value: bidAmount });
        // Get the bidding history of buyer2 for this auction
        const biddingHistory = await auction_utilities.getUserBiddingHistory(
          buyer2.address,
          auctionID,
        );
        // Assert that the cumulative bid amount matches the bidding history
        const expectedCumulativeBidAmount = ethers.utils.parseEther('9.3'); // 9.3 MATIC
        expect(biddingHistory.toString()).to.equal(expectedCumulativeBidAmount.toString());
      });
    });

    // Test for getAuctionBidHistory
    describe('Get Auction Bid History', function () {
      it('should return the bid history for a given auction', async function () {
        // Initial setup: buyer2 places the first bid
        let bidAmount = initialMinBidIncrement.add(ethers.utils.parseEther('0.1')); // First bid by buyer2
        await auctions.connect(buyer2).placeBid(auctionID, { value: bidAmount });

        // Affiliate outbids buyer2
        bidAmount = bidAmount.add(initialMinBidIncrement);
        await auctions.connect(affiliate).placeBid(auctionID, { value: bidAmount });

        // Buyer2 outbids affiliate again
        bidAmount = bidAmount.add(initialMinBidIncrement);
        await auctions.connect(buyer2).placeBid(auctionID, { value: bidAmount });

        // Affiliate outbids buyer2 again
        bidAmount = bidAmount.add(initialMinBidIncrement);
        await auctions.connect(affiliate).placeBid(auctionID, { value: bidAmount });

        // Buyer2 places the final bid
        bidAmount = bidAmount.add(initialMinBidIncrement);
        await auctions.connect(buyer2).placeBid(auctionID, { value: bidAmount });

        // Retrieve the bid history
        const bidHistory = await auction_utilities.getAuctionBidHistory(auctionID);

        // Expect the length of the bid history to match the number of bids placed
        expect(bidHistory.length).to.equal(5);

        // console.log(bidHistory)

        // Verify each bid in the bid history
        expect(bidHistory[0].bidder).to.equal(buyer2.address);
        expect(bidHistory[0].amount).to.equal(ethers.utils.parseEther('1.1'));
      });
    });

    // Test for getActiveAuctions
    describe('Get Active Auctions', function () {
      it('should return a list of active auctions', async function () {
        await setupAuction(2344);
        await setupAuction(4325);
        await setupAuction(578);

        // Get active auctions for the user
        const firstPage = await auction_utilities.getActiveAuctions(1, 4);
        // console.log(firstPage[0])
        // console.log(firstPage[1])
        // Check the number of active auctions returned
        expect(firstPage[0].length).to.equal(4);
        expect(firstPage[1]).to.equal(4);
      });

      it('should handle pagination correctly', async function () {
        await setupAuction(2344);
        await setupAuction(4325);
        await setupAuction(578);

        await setupAuction(456);
        await setupAuction(567);
        await setupAuction(678);
        await setupAuction(978);

        // Fetching first page (Page 1, 4 items per page)
        const firstPage = await auction_utilities.getActiveAuctions(1, 4);
        // console.log("First Page: ", firstPage);
        expect(firstPage[0].length).to.equal(4); // Expect 4 auctions in the first page

        // Fetching second page (Page 2, 4 items per page)
        const secondPage = await auction_utilities.getActiveAuctions(2, 4);
        // console.log("Second Page: ", secondPage);
        expect(secondPage[0].length).to.equal(4); // Expect 4 auctions in the second page
      });
    });

    // Test for getEndedAuctions
    describe('Get Ended Auctions', function () {
      it('should return a list of ended auctions', async function () {
        // Fast forward time by one week (the duration of the auction)
        await network.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]); // 1 week in seconds
        await network.provider.send('evm_mine');

        // Now end the auction
        await auctions.connect(owner).endAuction(auctionID);

        const auctionID2 = await setupAuction(2344);
        await network.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]); // 1 week in seconds
        await network.provider.send('evm_mine');

        await auctions.connect(owner).endAuction(auctionID2);

        // get ended auctions
        // Fetching first page (Page 1, 4 items per page)
        const firstPage = await auction_utilities.getEndedAuctions(1, 4);
        // console.log("First Page Details: ", firstPage[0]);
        // console.log("First Page Count: ", firstPage[1]);
        expect(firstPage[0].length).to.equal(2);
        expect(firstPage[1]).to.equal(2);
      });

      it('should handle pagination correctly', async function () {
        // Implement test logic
        // Fast forward time by one week (the duration of the auction)
        await network.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]); // 1 week in seconds
        await network.provider.send('evm_mine');
        await auctions.connect(owner).endAuction(auctionID);

        const auctionID2 = await setupAuction(2344);
        await network.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]); // 1 week in seconds
        await network.provider.send('evm_mine');
        await auctions.connect(owner).endAuction(auctionID2);

        const auctionID3 = await setupAuction(345);
        await network.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]); // 1 week in seconds
        await network.provider.send('evm_mine');
        await auctions.connect(owner).endAuction(auctionID3);

        const auctionID4 = await setupAuction(567);
        await network.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]); // 1 week in seconds
        await network.provider.send('evm_mine');
        await auctions.connect(owner).endAuction(auctionID4);

        const auctionID5 = await setupAuction(789);
        await network.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]); // 1 week in seconds
        await network.provider.send('evm_mine');
        await auctions.connect(owner).endAuction(auctionID5);

        const auctionID6 = await setupAuction(12334);
        await network.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]); // 1 week in seconds
        await network.provider.send('evm_mine');
        await auctions.connect(owner).endAuction(auctionID6);

        const auctionID7 = await setupAuction(234);
        await network.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]); // 1 week in seconds
        await network.provider.send('evm_mine');
        await auctions.connect(owner).endAuction(auctionID7);

        const auctionID8 = await setupAuction(23456);
        await network.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]); // 1 week in seconds
        await network.provider.send('evm_mine');
        await auctions.connect(owner).endAuction(auctionID8);

        // there are a totaal of 9 auctions
        // Fetching first page (Page 1, 4 items per page)
        const firstPage = await auction_utilities.getEndedAuctions(1, 4);
        // console.log("First Page: ", firstPage);
        expect(firstPage[0].length).to.equal(4); // Expect 4 auctions in the first page

        // Fetching second page (Page 2, 4 items per page)
        const secondPage = await auction_utilities.getEndedAuctions(2, 4);
        // console.log("Second Page: ", secondPage);
        expect(secondPage[0].length).to.equal(4); // Expect 4 auctions in the second page
      });
    });

    // Test for getAuctions
    describe('Get Auctions', function () {
      it('should return a list of auctions pagination', async function () {
        await setupAuction(2344);
        await setupAuction(4325);
        await setupAuction(578);
        await setupAuction(456);
        await setupAuction(567);
        await setupAuction(678);
        await setupAuction(978);

        // Fetching first page (Page 1, 4 items per page)
        const firstPage = await auction_utilities.getAuctions(1, 4);
        // console.log("First Page: ", firstPage);
        expect(firstPage[0].length).to.equal(4); // Expect 4 auctions in the first page

        // Fetching second page (Page 2, 4 items per page)
        const secondPage = await auction_utilities.getAuctions(2, 4);
        // console.log("Second Page: ", secondPage);
        expect(secondPage[0].length).to.equal(4); // Expect 4 auctions in the second page
      });

      it('should handle pagination correctly', async function () {
        await setupAuction(2344);
        await setupAuction(4325);
        await setupAuction(578);
        await setupAuction(456);
        await setupAuction(567);
        await setupAuction(678);
        await setupAuction(978);

        // Fetching first page (Page 1, 4 items per page)
        const firstPage = await auction_utilities.getAuctions(1, 4);
        // console.log("First Page: ", firstPage);
        expect(firstPage[0].length).to.equal(4); // Expect 4 auctions in the first page

        // Fetching second page (Page 2, 4 items per page)
        const secondPage = await auction_utilities.getAuctions(2, 4);
        // console.log("Second Page: ", secondPage);
        expect(secondPage[0].length).to.equal(4); // Expect 4 auctions in the second page
      });
    });

    // // Test for getAuctionsByNftId
    describe('Get Auctions By NFT ID', function () {
      it('should return auctions for a specific NFT ID', async function () {
        // Implement test logic
        await setupAuction(123);
        await setupAuction(123);
        await setupAuction(123);

        await setupAuction(123);
        await setupAuction(123);
        await setupAuction(123);
        await setupAuction(123);

        const firstPage = await auction_utilities.getAuctionsByNftId(123, 1, 8);

        expect(firstPage[0].length).to.equal(8);
        expect(firstPage[1]).to.equal(8);
      });

      it('should handle pagination correctly', async function () {
        // Implement test logic
        await setupAuction(123);
        await setupAuction(123);
        await setupAuction(123);

        await setupAuction(123);
        await setupAuction(123);
        await setupAuction(123);
        await setupAuction(123);

        const firstPage = await auction_utilities.getAuctionsByNftId(123, 1, 4);
        const secondPage = await auction_utilities.getAuctionsByNftId(123, 2, 4);

        // console.log(firstPage[0])
        // console.log(firstPage[1])

        expect(firstPage[0].length).to.equal(4);
        expect(secondPage[0].length).to.equal(4);

        expect(firstPage[1]).to.equal(8);
      });
    });

    // Test for getAuctionsWithoutBids
    describe('Get Auctions Without Bids', function () {
      it('should return auctions without any bids', async function () {
        await setupAuction(123);
        await setupAuction(123);
        await setupAuction(123);

        await setupAuction(123);
        await setupAuction(123);
        await setupAuction(123);
        await setupAuction(123);

        const firstPage = await auction_utilities.getAuctionsWithoutBids(1, 8);

        expect(firstPage[0].length).to.equal(8);
        expect(firstPage[1]).to.equal(8);
      });

      it('should handle pagination correctly', async function () {
        // Implement test logic
        // Implement test logic
        await setupAuction(123);
        await setupAuction(123);
        await setupAuction(123);

        await setupAuction(123);
        await setupAuction(123);
        await setupAuction(123);
        await setupAuction(123);

        const firstPage = await auction_utilities.getAuctionsWithoutBids(1, 4);
        const secondPage = await auction_utilities.getAuctionsWithoutBids(2, 4);

        // console.log(firstPage[0])
        // console.log(firstPage[1])

        expect(firstPage[0].length).to.equal(4);
        expect(secondPage[0].length).to.equal(4);

        expect(firstPage[1]).to.equal(8);
      });
    });

    // Test for getAuctionsCloseToEnding
    describe('Get Auctions Close To Ending', function () {
      it('should return auctions that are close to ending', async function () {
        // Implement test logic
        await setupAuction(2344);
        await setupAuction(345);
        await setupAuction(5466);

        await setupAuction(567);
        await setupAuction(678);
        await setupAuction(789);
        await setupAuction(23445);

        // Get the current blockchain time
        let currentBlock = await ethers.provider.getBlock('latest');
        let currentTime = currentBlock.timestamp;

        let auctionBeforeBid = await auctions.auctions(auctionID);
        const endTimeBeforeBid = auctionBeforeBid.endTime;

        // Calculate time to move just before the auction ends (e.g., 1 minute before the end)
        const timeBeforeEnd = endTimeBeforeBid - currentTime - 60; // 60 seconds before the end
        await network.provider.send('evm_increaseTime', [timeBeforeEnd]);
        await network.provider.send('evm_mine');

        const auctionsCloseToEnding = await auction_utilities.getAuctionsCloseToEnding(1, 8);

        expect(auctionsCloseToEnding[0].length).to.equal(8);
      });

      it('should handle pagination correctly', async function () {
        await setupAuction(2344);
        await setupAuction(345);
        await setupAuction(5466);

        await setupAuction(567);
        await setupAuction(678);
        await setupAuction(789);
        await setupAuction(23445);

        // Get the current blockchain time
        let currentBlock = await ethers.provider.getBlock('latest');
        let currentTime = currentBlock.timestamp;

        let auctionBeforeBid = await auctions.auctions(auctionID);
        const endTimeBeforeBid = auctionBeforeBid.endTime;

        // Calculate time to move just before the auction ends (e.g., 1 minute before the end)
        const timeBeforeEnd = endTimeBeforeBid - currentTime - 60; // 60 seconds before the end
        await network.provider.send('evm_increaseTime', [timeBeforeEnd]);
        await network.provider.send('evm_mine');

        const firstPage = await auction_utilities.getAuctionsCloseToEnding(1, 4);
        const secondPage = await auction_utilities.getAuctionsCloseToEnding(2, 4);

        expect(firstPage[0].length).to.equal(4);
        expect(secondPage[0].length).to.equal(4);
      });
    });
  });
}
