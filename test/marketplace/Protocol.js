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
  AffiliateUtils,
  affiliate_utils,
  BoothUtils,
  booth_utils,
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
  affiliate10,
  affiliate9;

const nftPrice = ethers.utils.parseEther('0.01');
const uri = 'https://api.boomslag.com/api/courses/nft/';
const initialStock = 30;
const tokenId = 123;
const royaltyPercentage = 500; // 5% represented in basis points (100 basis points = 1%)
const commissionPercent = 25; // up to 100% (Not represented in basis points)
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
  [1000, 1050, 1100, 1150, 1200], // Level 1: Bronze 10%, Silver 10.5%, Gold 11%, Platinum 11.5%, Diamond 12%
  [800, 850, 900, 950, 1000], // Level 2: Bronze 8%, Silver 8.5%, Gold 9%, Platinum 9.5%, Diamond 10%
  [600, 650, 700, 750, 800], // Level 3: Bronze 6%, Silver 6.5%, Gold 7%, Platinum 7.5%, Diamond 8%
  [400, 450, 500, 550, 600], // Level 4: Bronze 4%, Silver 4.5%, Gold 5%, Platinum 5.5%, Diamond 6%
  [200, 250, 300, 350, 400], // Level 5: Bronze 2%, Silver 2.5%, Gold 3%, Platinum 3.5%, Diamond 4%
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
    affiliate10,
  ] = await ethers.getSigners();

  // Deploy ticket_registry Contract
  TicketRegistry = await ethers.getContractFactory('TicketRegistry');
  ticket_registry = await TicketRegistry.deploy();
  await ticket_registry.deployed();

  // Deploy Affiliates Contract and set ranks
  Affiliates = await ethers.getContractFactory('Affiliates');
  affiliates = await Affiliates.deploy(
    referralRewardBasisPointsArray,
    rankCriteriasArray,
    maxReferralDepth,
    ticket_registry.address,
  );
  await affiliates.deployed();
  // Deploy AffiliateUtils Contract
  AffiliateUtils = await ethers.getContractFactory('AffiliateUtils');
  affiliate_utils = await AffiliateUtils.deploy(affiliates.address);
  await affiliate_utils.deployed();

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
    ticket_registry.address,
  ); // Payees, Shares
  await ticket.deployed();

  // Deploy Auctions Contract
  Auctions = await ethers.getContractFactory('Auctions');
  auctions = await Auctions.deploy(
    ticket.address,
    ticket_registry.address,
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
  booth = await Booth.deploy(affiliates.address, commissionPercent, ticket_registry.address);
  await booth.deployed();
  BoothUtils = await ethers.getContractFactory('BoothUtils');
  booth_utils = await BoothUtils.deploy(booth.address);
  await booth_utils.deployed();

  // Register the objectId and its corresponding ticket contract IMPORTANT STEP!
  await ticket_registry.registerObject(tokenId, ticket.address);

  // Grant BOOTH Role to the Booth contract
  const BOOTH_ROLE = await affiliates.BOOTH_ROLE();
  await affiliates.grantRole(BOOTH_ROLE, booth.address);
  await affiliates.grantRole(BOOTH_ROLE, owner.address);

  await auctions.grantRole(await auctions.BOOTH_ROLE(), booth.address);

  await ticket.grantRole(await ticket.BOOTH_ROLE(), booth.address);
  await ticket_registry.grantRole(await ticket_registry.BOOTH_ROLE(), booth.address);
});

const testTicket = true;
if (testTicket) {
  describe('Ticket Contract', function () {
    async function mintNft(_tokenId, _nftId, _qty, _guy) {
      const tx = await ticket
        .connect(buyer)
        .mint(_tokenId, _nftId, _qty, _guy, { value: nftPrice });
      const tx_receipt = await tx.wait();
      return { tx_receipt };
    }

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

      it('should check max supply', async function () {
        expect(await ticket.stock(tokenId)).to.equal(initialStock);
      });

      it('should verify URI', async function () {
        // Test URI verification
        const nftId = 56756645556;
        const qty = 1;
        const guy = buyer.address;
        await ticket.connect(buyer).mint(tokenId, nftId, qty, guy, { value: nftPrice });
        // console.log('NFT Metadata URI: ', await ticket.uri(nftId));
        expect(await ticket.uri(nftId)).to.equal(uri + nftId + '.json');
      });

      it('should mint directly using the ticket and update the registry', async function () {
        const nftId = 547588675;
        const qty = 1;
        const guy = buyer.address;

        // Check TokenID is registered in ticket_registry
        expect(await ticket_registry.isObjectRegistered(tokenId)).to.be.true;

        const tx = await ticket.connect(buyer).mint(tokenId, nftId, qty, guy, { value: nftPrice });
        const receipt = await tx.wait();
        const mintEvent = receipt.events.find((event) => event.event === 'Mint');
        expect(mintEvent).to.exist;

        expect(await ticket_registry.doesUserOwnNFT(buyer.address, tokenId)).to.be.true;

        // // Simulate listening for the Mint event and updating the TicketRegistry
        // // Ensure the test account has the BOOTH_ROLE in the TicketRegistry
        // await ticket_registry
        //   .connect(owner)
        //   .updateOwnershipOnMint(
        //     mintEvent.args.guy,
        //     mintEvent.args.tokenId,
        //     mintEvent.args.nftId,
        //     mintEvent.args.qty,
        //     mintEvent.args.price,
        //     mintEvent.args.uri,
        //   );
        //////////////////////////////// This method is not necessary because we already call it within the tickes mint

        // // Verify the update in the registry
        const [ownedNFTs, totalNFTs] = await ticket_registry.getOwnedNFTs(guy, tokenId, 1, 10);
        // console.log('Owned NFTs: ', ownedNFTs);
        // console.log('totalNFTs: ', totalNFTs);

        const nftDetails = ownedNFTs[0];

        expect(nftDetails.nftId).to.equal(nftId);

        // expect(nftDetails[0].toNumber()).to.equal(1)
        expect(totalNFTs.toNumber()).to.equal(1);
      });

      it('should verify buyer has access', async function () {
        const nftId = 876745463;
        const qty = 1;
        const guy = buyer.address;
        const tx = await ticket.connect(buyer).mint(tokenId, nftId, qty, guy, { value: nftPrice });
        const receipt = await tx.wait();
        const mintEvent = receipt.events.find((event) => event.event === 'Mint');
        expect(mintEvent).to.exist;

        expect(await ticket_registry.doesUserOwnNFT(buyer.address, tokenId)).to.be.true;

        // await ticket_registry
        //   .connect(owner)
        //   .updateOwnershipOnMint(
        //     mintEvent.args.guy,
        //     mintEvent.args.tokenId,
        //     mintEvent.args.nftId,
        //     mintEvent.args.qty,
        //     mintEvent.args.price,
        //     mintEvent.args.uri,
        //   );
      });

      it("should verify buyer doesn't have access after transfer", async function () {
        const nftId = 456465467;
        const qty = 1;
        const guy = buyer.address;
        const tx = await ticket.connect(buyer).mint(tokenId, nftId, qty, guy, { value: nftPrice });
        const receipt = await tx.wait();
        const mintEvent = receipt.events.find((event) => event.event === 'Mint');
        expect(mintEvent).to.exist;
        expect(await ticket_registry.doesUserOwnNFT(buyer.address, tokenId)).to.be.true;

        // await ticket_registry
        //   .connect(owner)
        //   .updateOwnershipOnMint(
        //     mintEvent.args.guy,
        //     mintEvent.args.tokenId,
        //     mintEvent.args.nftId,
        //     mintEvent.args.qty,
        //     mintEvent.args.price,
        //     mintEvent.args.uri,
        //   );

        // Get the owned NFT ID for that TokenID by the User
        const ownedNFTId = await ticket_registry.getFirstOwnedNftIdForTokenId(
          buyer.address,
          tokenId,
        );

        // Transfer NFT from buyer to buyer2
        const tx_transfer = await ticket
          .connect(buyer)
          .safeTransferFrom(buyer.address, buyer2.address, ownedNFTId.toNumber(), qty, '0x');
        const receipt_transfer = await tx_transfer.wait();
        const transferEvent = receipt_transfer.events.find((event) => event.event === 'Transfer');
        expect(transferEvent).to.exist;

        // // Update ownership in the registry
        // await ticket_registry.connect(owner).updateOwnershipOnTransfer(
        //   buyer.address, // from
        //   buyer2.address, // to
        //   transferEvent.args.tokenId.toNumber(), // tokenId
        //   transferEvent.args.nftId.toNumber(), // nftId
        //   transferEvent.args.qty.toNumber(), // qty
        //   nftPrice, // price
        //   transferEvent.args.uri, // uri
        // );

        // Verify that buyer no longer owns the NFT
        expect(await ticket_registry.doesUserOwnNFT(buyer.address, tokenId)).to.be.false;

        // Verify that buyer2 now owns the NFT
        expect(await ticket_registry.doesUserOwnNFT(buyer2.address, tokenId)).to.be.true;
      });

      it('should not allow specialUpdateOnMint being called from seller or elsewhere', async function () {
        const nftId = 456465467;
        const qty = 1;
        const guy = buyer.address;
        const _uri = `https://api.boomslag.com/api/courses/nft/${nftId}`;

        let transactionFailed = false;

        try {
          // Attempt to call specialUpdateOnMint directly, which should fail
          await ticket_registry
            .connect(seller)
            .specialUpdateOnMint(guy, tokenId, nftId, qty, nftPrice, _uri);
        } catch (error) {
          // Check if the error is the expected revert
          transactionFailed = error.message.includes('Can only be called during minting');
        }

        // Assert that the transaction failed with the expected revert message
        expect(transactionFailed).to.be.true;
      });

      it('should not allow specialUpdateOnTransfer being called from seller or elsewhere', async function () {
        const nftId = 5344356364;
        const qty = 1;
        const guy = buyer.address;
        const guy2 = buyer2.address;
        const _uri = `https://api.boomslag.com/api/courses/nft/${nftId}`;

        const tx = await ticket.connect(buyer).mint(tokenId, nftId, qty, guy, { value: nftPrice });
        const receipt = await tx.wait();
        const mintEvent = receipt.events.find((event) => event.event === 'Mint');
        expect(mintEvent).to.exist;
        expect(await ticket_registry.doesUserOwnNFT(buyer.address, tokenId)).to.be.true;

        // Buyer has purchased the nft now the seller will try to call specialUpdateOnTransfer
        try {
          await ticket_registry
            .connect(seller)
            .specialUpdateOnTransfer(guy, guy2, tokenId, nftId, qty, nftPrice, _uri);
        } catch (error) {
          // Check if the error is the expected revert
          transactionFailed = error.message.includes('Unauthorized caller');
        }
      });

      // It should not allow mint of a tokenId that doesnt exist
      it('should not allow mint of a tokenId that doesnt exist', async function () {
        await expect(mintNft(531, 12345, 1, buyer.address)).to.be.revertedWith('NFT Out of Stock');
      });

      // // It should not allow minting of duplicate nftIds
      // it('should not allow minting of duplicate nftIds', async function () {
      //   await mintNft(tokenId, 12345, 1, buyer.address);
      //   // const [ownedNFTs, totalNFTs] = await ticket_registry.getOwnedNFTs(
      //   //   buyer.address,
      //   //   tokenId,
      //   //   1,
      //   //   10,
      //   // );
      //   // console.log('Owned NFTs: ', ownedNFTs);
      //   // console.log('totalNFTs: ', totalNFTs);

      //   // await mintNft(tokenId, 12345, 1, buyer2.address);
      //   // const [ownedNFTs2, totalNFTs2] = await ticket_registry.getOwnedNFTs(
      //   //   buyer2.address,
      //   //   tokenId,
      //   //   1,
      //   //   10,
      //   // );
      //   // console.log('Owned NFTs2: ', ownedNFTs2);
      //   // console.log('totalNFTs2: ', totalNFTs2);
      // });
    });

    describe('Ticket Contract Royalties', function () {
      beforeEach(async function () {
        const nftId = 1;
        const qty = 1;
        const guy = buyer.address;
        await ticket.connect(buyer).mint(tokenId, nftId, qty, guy, { value: nftPrice });
      });

      it('should check royalty receiver', async function () {
        const [receiver, royaltyAmount] = await ticket.royaltyInfo(tokenId, nftPrice);
        expect(receiver).to.equal(royaltyReceiver.address);
        // console.log(royaltyAmount);
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
      await booth.authorizeBuyer(buyer.address);
      const tx = await ticket.connect(buyer).mint(tokenId, _nftId, _qty, _guy, { value: _value });
      const receipt = await tx.wait();
      const mintEvent = receipt.events.find((event) => event.event === 'Mint');
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
          ticket_registry.address,
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
          ticket_registry.address,
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

      it('should list user owned nfts', async function () {
        const guy = buyer.address;
        const nftIDs = [123, 321, 231, 213];
        const boughtNFTs = [];

        for (let i = 0; i < nftIDs.length; i++) {
          const nftID = await buyNFT(nftIDs[i], guy);
          boughtNFTs.push(nftID);
          expect(await ticket.balanceOf(buyer.address, nftID)).to.equal(1);
        }

        const [ownedNFTs, totalNFTs] = await ticket_registry.getOwnedNFTs(guy, tokenId, 1, 12);

        expect(ownedNFTs.length).to.be.equal(boughtNFTs.length);
        expect(totalNFTs).to.be.equal(boughtNFTs.length);
      });
    });

    describe('Access Control Tests', function () {
      it('should restrict registration function to only users with BOOTH_ROLE', async function () {
        // Test restriction of registration function

        const BOOTH_ROLE = await ticket_registry.BOOTH_ROLE();

        let functionRequiringTicketRegistryRole = async () => {
          await ticket_registry.connect(buyer).registerObject(tokenId, ticket.address);
        };

        // Expect the function to fail when called by an account without the BOOTH_ROLE
        await expect(functionRequiringTicketRegistryRole()).to.be.revertedWith(
          'AccessControl: account ' +
            buyer.address.toLowerCase() +
            ' is missing role ' +
            BOOTH_ROLE.toLowerCase(),
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
          ticket_registry.address,
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

const testBooth = true;
if (testBooth) {
  describe('Booth Contract', function () {
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

      it('should correctly get platform commission percent in basis points', async function () {
        const _commission = await booth.getCommissionPercent();
        expect(_commission).to.equal(commissionPercent);
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

      it('should correctly revoke buyer authorization', async function () {
        // Select a buyer to revoke authorization (e.g., buyer2)
        const buyerToRevoke = buyer2.address;
        // First, ensure the buyer is authorized
        await booth.connect(owner).authorizeBuyer(buyerToRevoke);
        // Now, revoke the buyer's authorization
        await booth.connect(owner).revokeBuyer(buyerToRevoke);
        // Check if the buyer no longer has the BUYER_ROLE
        const isBuyerAuthorized = await booth.hasRole(await booth.BUYER_ROLE(), buyerToRevoke);
        // Assert that the buyer's authorization is revoked
        expect(isBuyerAuthorized).to.equal(false, 'Buyer authorization was not revoked correctly');
      });

      it('should correctly handle NFT purchases', async function () {
        const nftId = 534662344;
        const guy = buyer.address;
        const initialBalance = await ethers.provider.getBalance(guy);

        await booth.authorizeBuyer(guy);

        const tx = await booth.connect(buyer).buy(tokenId, nftId, 1, guy, {
          value: nftPrice.mul(1),
        });

        const receipt = await tx.wait();
        const purchaseMadeEvent = receipt.events.find((event) => event.event === 'PurchaseMade');
        expect(purchaseMadeEvent).to.exist;

        await booth.revokeBuyer(guy);

        const user_owns_nft = await ticket_registry.doesUserOwnNFT(guy, tokenId);
        // console.log(user_owns_nft)
        expect(user_owns_nft).to.be.true;
        const finalBalance = await ethers.provider.getBalance(guy);
        expect(initialBalance).to.be.above(finalBalance);
      });

      it('should correctly handle NFT purchases with discount', async function () {
        const nftId = 1;
        const qty = 1;
        const guy = buyer.address;
        await booth.authorizeBuyer(guy);
        await booth
          .connect(buyer)
          .buy(tokenId, nftId, qty, guy, { value: ethers.utils.parseEther('0.005') });
        await booth.revokeBuyer(guy);
      });

      it('should store purchase details accurately', async function () {
        // Define the parameters for the buy function
        let _nftId = 1;
        let _qty = 1;
        let _guy = buyer.address; // Assuming accounts[1] is the buyer
        let _value = nftPrice.mul(_qty);

        const [receiver, royaltyAmount] = await ticket.royaltyInfo(tokenId, nftPrice);

        const _finalValue = _value.sub(royaltyAmount);

        // Get the initial balance of the buyer
        const initialBalance = await ethers.provider.getBalance(_guy);

        // Call the buy function
        await booth.authorizeBuyer(_guy);
        await booth.connect(buyer).buy(tokenId, _nftId, _qty, _guy, { value: nftPrice.mul(_qty) });

        // Get the final balance of the buyer
        const finalBalance = await ethers.provider.getBalance(_guy);

        // Check if the buyer's balance has decreased correctly
        expect(initialBalance).to.be.above(finalBalance);

        // Get Purchase Details for this transaction
        const purchase = await booth.getLatestPurchaseForUserAndToken(_guy, tokenId);
        // Check if the purchase details are correct
        expect(purchase.tokenId).to.equal(tokenId);
        expect(purchase.nftId).to.equal(_nftId);
        expect(purchase.qty).to.equal(_qty);
        expect(purchase.price).to.equal(_finalValue);
        expect(purchase.timestamp).to.be.at.least(1); // Checking if the timestamp is a valid value
      });

      it('should correctly verify ticket access', async function () {
        // Test verifying ticket access
        const nftId = 1;
        const qty = 1;
        const guy = buyer.address;

        // console.log('Initial Stock',currentStock)
        await booth.authorizeBuyer(guy);
        await booth.connect(buyer).buy(tokenId, nftId, qty, guy, { value: nftPrice.mul(qty) });
        await booth.revokeBuyer(guy);

        // Now, test if the buyer has access to the NFT
        expect(await ticket_registry.doesUserOwnNFT(guy, tokenId)).to.be.true;
      });

      it('should correctly get total purchases for user', async function () {
        const nftId = 534662344;
        const guy = buyer.address;

        await booth.authorizeBuyer(guy);
        await booth.connect(buyer).buy(tokenId, nftId, 1, guy, {
          value: nftPrice.mul(1),
        });

        const _totalPurchases = await booth.getTotalPurchasesForUser(guy);
        expect(_totalPurchases).to.equal(1);
      });

      it('should correctly get purchase for user at index', async function () {
        const nftId = 534662344;
        const guy = buyer.address;
        const qty = 1;

        const [receiver, royaltyAmount] = await ticket.royaltyInfo(tokenId, nftPrice);

        const _finalValue = nftPrice.mul(qty).sub(royaltyAmount);

        await booth.authorizeBuyer(guy);
        const tx = await booth.connect(buyer).buy(tokenId, nftId, qty, guy, {
          value: nftPrice.mul(qty),
        });

        // Wait for the transaction to be mined
        await tx.wait();

        // Fetch the purchase details for the first (and only) purchase
        const purchase = await booth.getPurchaseForUserAtIndex(guy, 0);

        // Assert the purchase details
        expect(purchase.tokenId).to.equal(tokenId);
        expect(purchase.nftId).to.equal(nftId);
        expect(purchase.qty).to.equal(qty);
        expect(purchase.price).to.equal(_finalValue);
        // You can also assert the timestamp is greater than 0 to ensure it's set
        expect(purchase.timestamp).to.be.at.least(1);
      });

      it('should return the correct total number of purchases for a token', async function () {
        const nftId = 534662344; // Example tokenId
        const buyerAddress = buyer.address; // Assuming 'buyer' is an account in your test environment
        const qty = 1;

        // Optional: Make a purchase to ensure there's at least one
        await booth.authorizeBuyer(buyerAddress);
        await booth.connect(buyer).buy(tokenId, nftId, qty, buyerAddress, {
          value: nftPrice.mul(qty),
        });

        // Call the function to get total purchases for the token
        const totalPurchases = await booth.getTotalPurchasesForToken(tokenId);

        // Assert the total purchases
        // The expected number depends on the initial state of your contract and any interactions made during the test
        expect(totalPurchases).to.equal(1); // Adjust this number based on your contract's state and test setup
      });

      it('should return the correct total number of purchases for a token', async function () {
        const nftId = 534662344; // Example tokenId
        const buyerAddress = buyer.address; // Assuming 'buyer' is an account in your test environment
        const qty = 1;

        // Optional: Make a purchase to ensure there's at least one
        await booth.authorizeBuyer(buyerAddress);
        await booth.connect(buyer).buy(tokenId, nftId, qty, buyerAddress, {
          value: nftPrice.mul(qty),
        });

        // Call the function to get total purchases for the token
        const latestPurchase = await booth.getLatestPurchaseForUserAndToken(buyerAddress, tokenId);
        expect(latestPurchase.tokenId).to.equal(tokenId);
      });
    });

    describe('Access Control Tests', function () {
      it('should restrict access to BOOTH_ROLE functions', async function () {
        // Define a function that requires the BOOTH_ROLE

        const BOOTH_ROLE = await booth.BOOTH_ROLE();

        let functionRequiringBoothRole = async () => {
          await booth.connect(buyer).setCommissionPercent(900);
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

      it('should emit BuyerAuthorized event correctly', async function () {
        // Select a buyer to authorize (e.g., buyer2)
        const buyerToAuthorize = buyer2.address;

        // Authorize the buyer using the Booth contract and expect the BuyerAuthorized event
        await expect(booth.connect(owner).authorizeBuyer(buyerToAuthorize))
          .to.emit(booth, 'BuyerAuthorized')
          .withArgs(buyerToAuthorize);
      });

      it('should emit PurchaseMade event correctly', async function () {
        const nftId = 1;
        const qty = 1;
        const guy = buyer.address;

        const [receiver, royaltyAmount] = await ticket.royaltyInfo(tokenId, nftPrice);
        const _value = nftPrice.mul(qty);
        const _finalValue = _value.sub(royaltyAmount);

        // Grant BUYER_ROLE to the buyer
        await booth.authorizeBuyer(guy);

        // Get the current block for the timestamp
        const block = await ethers.provider.getBlock('latest');
        const timestamp = block.timestamp;

        // Buy the NFT and expect the PurchaseMade event
        const tx = await booth.connect(buyer).buy(tokenId, nftId, qty, guy, { value: _value });

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
          .withArgs(tokenId, nftId, qty, guy, _finalValue, nftUri, txBlock.timestamp);
      });
    });
  });
}

const testBoothUtils = true;
if (testBoothUtils) {
  describe('Booth Utils Contract', function () {
    describe('Deployment and Initial Settings', function () {
      it('should deploy the AffiliateUtils contract', async function () {
        expect(booth_utils.address).to.not.equal(0x0);
        expect(booth_utils.address).to.not.equal(null);
        expect(booth_utils.address).to.not.equal(undefined);
        expect(booth_utils.address).to.not.equal('');
      });
    });

    describe('Functional Tests', function () {
      const buyNFT = async (_nftId, _guy, _signer) => {
        const initialBalance = await ethers.provider.getBalance(_guy);

        await booth.authorizeBuyer(_guy);
        const tx = await booth.connect(_signer).buy(tokenId, _nftId, 1, _guy, {
          value: nftPrice.mul(1),
        });

        const receipt = await tx.wait();
        const purchaseMadeEvent = receipt.events.find((event) => event.event === 'PurchaseMade');
        expect(purchaseMadeEvent).to.exist;

        const user_owns_nft = await ticket_registry.doesUserOwnNFT(_guy, tokenId);
        // console.log(user_owns_nft)
        expect(user_owns_nft).to.be.true;
        const finalBalance = await ethers.provider.getBalance(_guy);
        expect(initialBalance).to.be.above(finalBalance);
      };

      it('should get transaction history for user', async function () {
        await buyNFT(423567 /** nftId */, buyer.address, buyer);
        await buyNFT(657898 /** nftId */, buyer.address, buyer);
        await buyNFT(234567 /** nftId */, buyer.address, buyer);

        const { results, count } = await booth_utils.getUserTransactionHistory(
          buyer.address,
          1,
          12,
        );

        // Process results to a more readable format
        const processedResults = results.map((purchase) => ({
          tokenId: purchase.tokenId.toString(),
          nftId: purchase.nftId.toString(),
          qty: purchase.qty.toString(),
          price: ethers.utils.formatEther(purchase.price), // Convert to Ether for readability
          timestamp: new Date(purchase.timestamp.toNumber() * 1000).toISOString(), // Convert to human-readable date
        }));

        // Log the processed results
        // console.log(processedResults);
        expect(processedResults.length).to.equal(3);
        // console.log(count);
        expect(count).to.equal(3);
      });
      it('should get total purchases for nft', async function () {
        await buyNFT(423567 /** nftId */, buyer.address, buyer);
        await buyNFT(345564 /** nftId */, affiliate.address, affiliate);
        await buyNFT(576766 /** nftId */, affiliate2.address, affiliate2);
        await buyNFT(465447 /** nftId */, affiliate3.address, affiliate3);
        await buyNFT(768676 /** nftId */, affiliate4.address, affiliate4);
        const totalPurchases = await booth_utils.getTotalPurchasesForNFT(tokenId);
        expect(totalPurchases).to.equal(5);
      });
      it('should get user purchases for nft', async function () {
        await buyNFT(423567 /** nftId */, buyer.address, buyer);
        await buyNFT(345564 /** nftId */, buyer.address, buyer);
        await buyNFT(576766 /** nftId */, buyer.address, buyer);
        await buyNFT(465447 /** nftId */, buyer.address, buyer);
        await buyNFT(768676 /** nftId */, buyer.address, buyer);
        const { results, count } = await booth_utils.getUserPurchasesForNFT(
          buyer.address,
          tokenId,
          1,
          12,
        );
        // expect(purchases.length).to.equal(5);
        // Process results to a more readable format

        const processedResults = results.map((purchase) => ({
          tokenId: purchase.tokenId.toString(),
          nftId: purchase.nftId.toString(),
          qty: purchase.qty.toString(),
          price: ethers.utils.formatEther(purchase.price), // Convert to Ether for readability
          timestamp: new Date(purchase.timestamp.toNumber() * 1000).toISOString(), // Convert to human-readable date
        }));
        expect(processedResults.length).to.equal(5);
        expect(count).to.equal(5);
      });
      it('should get purchases for nft', async function () {
        await buyNFT(423567 /** nftId */, buyer.address, buyer);
        await buyNFT(345564 /** nftId */, buyer.address, buyer);
        await buyNFT(576766 /** nftId */, buyer.address, buyer);
        await buyNFT(465447 /** nftId */, buyer.address, buyer);
        await buyNFT(768676 /** nftId */, buyer.address, buyer);
        const { results, count } = await booth_utils.getPurchasesByTokenId(tokenId, 1, 12);
        // expect(purchases.length).to.equal(5);
        // Process results to a more readable format

        const processedResults = results.map((purchase) => ({
          tokenId: purchase.tokenId.toString(),
          nftId: purchase.nftId.toString(),
          qty: purchase.qty.toString(),
          price: ethers.utils.formatEther(purchase.price), // Convert to Ether for readability
          timestamp: new Date(purchase.timestamp.toNumber() * 1000).toISOString(), // Convert to human-readable date
        }));
        expect(processedResults.length).to.equal(5);
        expect(count).to.equal(5);
      });
    });
  });
}

const testAffiliates = true;
if (testAffiliates) {
  describe('Affiliates Contract', function () {
    async function deployTicketNFT(_id, stock, use_stock, limited_edition, seller_address) {
      // Seller will deploy a nft
      const price = ethers.utils.parseEther('0.01');
      const id = _id;
      Ticket = await ethers.getContractFactory('Ticket', seller);
      ticketContract = await Ticket.deploy(
        id, // tokenId
        price, // price
        stock, // initialStock
        use_stock, // useStock
        limited_edition, // limited Edition
        seller_address, // Royalty address, same as seller
        500, // royalty percentage represented in basis points
        [owner.address, seller_address], // Payees
        [10, 90], // Payees distribution commission
        uri, // nft uri
        ticket_registry.address,
      );
      await ticketContract.deployed();
      // Register nft in booth and registry
      await ticket_registry.registerObject(id, ticket.address);
      await ticketContract.grantRole(await ticketContract.BOOTH_ROLE(), booth.address);
      // Enroll initial affiliate
      await affiliates.enrollInitialAffiliateForNFT(id, seller_address);

      return { ticketContract, id };
    }

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
      it('should enroll an affiliate for a specific NFT', async function () {
        const { nft, id } = await deployTicketNFT(
          573874501, // id
          100, // stock
          true, // use stock
          true, // limited edition
          seller.address, // seller address
        );

        // Check that Seller has been enrolled as the initial affiliate
        const sellerAffiliateData = await affiliates.getAffiliateNFTData(id, seller.address);
        expect(sellerAffiliateData.isAffiliated).to.be.true;
        expect(sellerAffiliateData.referrer).to.equal(seller.address);
      });

      it('should handle initial affiliate correctly', async function () {
        // Enroll a new affiliate for the NFT
        await affiliates.enrollInitialAffiliateForNFT(tokenId, affiliate.address);
        const data = await affiliates.getAffiliateNFTData(tokenId, affiliate.address);
        expect(data.isAffiliated).to.be.true;
      });

      it('should handle referrals correctly', async function () {
        // Enroll a new affiliate for the NFT
        await affiliates.enrollInitialAffiliateForNFT(tokenId, affiliate.address);
        const data = await affiliates.getAffiliateNFTData(tokenId, affiliate.address);
        // Check that affiliate.address has been enrolled as an affiliate
        expect(data.isAffiliated).to.be.true;

        await affiliates.enrollAffiliateForNFT(tokenId, affiliate2.address, affiliate.address);

        // Check that affiliate.address is the referrer of affiliate2.address
        const affiliateReferrer = await affiliates.getAffiliateReferrer(affiliate2.address);
        expect(affiliateReferrer).to.equal(affiliate.address);
      });

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
          .setReferralRewardBasisPoints(levelToUpdate, rankToUpdate, newRewardBasisPoints);
        // Check that the reward was updated
        const updatedReward = await affiliates.referralRewardBasisPoints(
          levelToUpdate,
          rankToUpdate,
        );
        expect(updatedReward).to.equal(newRewardBasisPoints);
      });

      it('should correctly set and update rank criteria', async function () {
        // Example new rank criteria
        const newRankCriteria = {
          requiredDirectReferrals: 15, // New required number of direct referrals
          requiredSalesVolume: ethers.utils.parseEther('7.5'), // New required sales volume
        };
        const rankToUpdate = 1; // Example rank to update

        // Update the rank criteria for a specific rank
        await affiliates.connect(owner).setRankCriteria(rankToUpdate, newRankCriteria);

        // Check that the rank criteria were updated
        const updatedCriteria = await affiliates.getRankCriteria(rankToUpdate);

        expect(updatedCriteria.requiredDirectReferrals).to.equal(
          newRankCriteria.requiredDirectReferrals,
        );
        expect(updatedCriteria.requiredSalesVolume).to.equal(newRankCriteria.requiredSalesVolume);
      });

      it('should correctly assign and manage referrer ranks', async function () {
        await affiliates.enrollInitialAffiliateForNFT(tokenId, seller.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate.address, seller.address);
        // Assign a rank to a referrer
        const initialRank = 0; // Example initial rank
        await affiliates.setReferrerRank(affiliate.address, initialRank, tokenId);
        // Check the assigned rank
        let currentRank = await affiliates.getAffiliateRank(affiliate.address);
        expect(currentRank).to.equal(initialRank);
      });

      it('should increase commission for rank ups', async function () {
        await affiliates.enrollInitialAffiliateForNFT(tokenId, affiliate.address);

        // // Assign a rank to a referrer
        const initialRank = 0; // Example initial rank
        let currentRank = await affiliates.getAffiliateRank(affiliate.address);
        expect(currentRank).to.equal(initialRank);

        // Calculate commission for rank 0
        const commission = nftPrice.mul(commissionPercent).div(10000);
        const remainingPurchasePrice = nftPrice.sub(commission);
        const calculatedReward = await affiliates.calculateReward(
          tokenId,
          affiliate.address,
          remainingPurchasePrice,
        );

        let rank2 = initialRank + 1;
        await affiliates.setReferrerRank(affiliate.address, rank2, tokenId);
        const calculatedReward2 = await affiliates.calculateReward(
          tokenId,
          affiliate.address,
          remainingPurchasePrice,
        );

        let rank3 = rank2 + 1;
        await affiliates.setReferrerRank(affiliate.address, rank3, tokenId);
        const calculatedReward3 = await affiliates.calculateReward(
          tokenId,
          affiliate.address,
          remainingPurchasePrice,
        );

        let rank4 = rank3 + 1;
        await affiliates.setReferrerRank(affiliate.address, rank4, tokenId);
        const calculatedReward4 = await affiliates.calculateReward(
          tokenId,
          affiliate.address,
          remainingPurchasePrice,
        );

        let rank5 = rank4 + 1;
        await affiliates.setReferrerRank(affiliate.address, rank5, tokenId);
        const calculatedReward5 = await affiliates.calculateReward(
          tokenId,
          affiliate.address,
          remainingPurchasePrice,
        );

        expect(calculatedReward).to.be.below(calculatedReward2);
        expect(calculatedReward2).to.be.below(calculatedReward3);
        expect(calculatedReward3).to.be.below(calculatedReward4);
        expect(calculatedReward4).to.be.below(calculatedReward5);
        await expect(affiliates.setReferrerRank(affiliate.address, 6, tokenId)).to.be.revertedWith(
          'Invalid rank',
        );
      });

      it('should not allow rank assignment for non-enrolled referrer', async function () {
        const nonEnrolledAffiliate = ethers.Wallet.createRandom().address;
        const rankToAssign = 0;
        await expect(
          affiliates.setReferrerRank(nonEnrolledAffiliate, rankToAssign, tokenId),
        ).to.be.revertedWith('Referrer not enrolled for NFT');
      });

      it('should update sales volume correctly', async function () {
        // Set a referrer
        await affiliates.enrollInitialAffiliateForNFT(tokenId, seller.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate.address, seller.address);
        // Simulate a sale and update the sales volume
        const saleAmount = ethers.utils.parseEther('1'); // Example sale amount
        await affiliates.connect(owner).updateSalesVolume(affiliate.address, saleAmount);
        // Check the updated sales volume
        const affiliateSalesVolume = await affiliates.getAffiliateSalesVolume(affiliate.address);
        expect(affiliateSalesVolume).to.equal(saleAmount);
        // Optionally, simulate additional sales and check cumulative sales volume
        const additionalSaleAmount = ethers.utils.parseEther('2'); // Example additional sale amount
        await affiliates.connect(owner).updateSalesVolume(affiliate.address, additionalSaleAmount);
        const totalSalesVolume = await affiliates.getAffiliateSalesVolume(affiliate.address);
        expect(totalSalesVolume).to.equal(saleAmount.add(additionalSaleAmount));
      });

      it('should not update sales volume for non existing affiliate', async function () {
        // Simulate a sale and update the sales volume
        const saleAmount = ethers.utils.parseEther('1'); // Example sale amount
        // Expect the function call to be reverted
        await expect(
          affiliates.connect(owner).updateSalesVolume(affiliate.address, saleAmount),
        ).to.be.revertedWith('Affiliate does not exist');
      });

      it('should check if an affiliate is eligible for rankup', async function () {
        // become affiliate for nft
        await affiliates.enrollInitialAffiliateForNFT(tokenId, seller.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate.address, seller.address);
        // Affiliate is ccurrently rank 0, he will Enrol 10 more affiliates to reach rank 1
        // Create an array to store the new affiliates
        let newAffiliates = [];
        // Generate 10 random accounts
        for (let i = 0; i < 10; i++) {
          // Create a new random account
          const randomWallet = ethers.Wallet.createRandom();
          // Add the new account to the list of affiliates
          newAffiliates.push(randomWallet.address);
        }
        for (let newAffiliate of newAffiliates) {
          await affiliates.enrollAffiliateForNFT(tokenId, newAffiliate, affiliate.address);
        }
        // Update Sales volume to meet required criteri for rankup
        const saleAmount = ethers.utils.parseEther('5');
        await affiliates.connect(owner).updateSalesVolume(affiliate.address, saleAmount);
        // Check eligibility for rank up
        const eligibility = await affiliates.checkEligibilityForRankUp(affiliate.address);
        expect(eligibility.eligible).to.be.true;
      });

      it('should handle rank up based on criteria', async function () {
        // become affiliate for nft
        await affiliates.enrollInitialAffiliateForNFT(tokenId, seller.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate.address, seller.address);
        // Affiliate is ccurrently rank 0, he will Enrol 10 more affiliates to reach rank 1
        // Create an array to store the new affiliates
        let newAffiliates = [];
        // Generate 10 random accounts
        for (let i = 0; i < 10; i++) {
          // Create a new random account
          const randomWallet = ethers.Wallet.createRandom();
          // Add the new account to the list of affiliates
          newAffiliates.push(randomWallet.address);
        }
        for (let newAffiliate of newAffiliates) {
          await affiliates.enrollAffiliateForNFT(tokenId, newAffiliate, affiliate.address);
        }
        // Update Sales volume to meet required criteri for rankup
        const saleAmount = ethers.utils.parseEther('5');
        await affiliates.connect(owner).updateSalesVolume(affiliate.address, saleAmount);
        // Check eligibility for rank up
        const eligibility = await affiliates.checkEligibilityForRankUp(affiliate.address);
        expect(eligibility.eligible).to.be.true;
        // Rankup
        await affiliates.rankUp(affiliate.address);
        // Affiliate rank it should be 1
        let currentRank = await affiliates.getAffiliateRank(affiliate.address);
        expect(currentRank).to.equal(1);
      });

      it('should correctly handle affiliate program commissions', async function () {
        nftId = 4534655445;
        // Set up the referral structure
        await affiliates.enrollInitialAffiliateForNFT(tokenId, seller.address); // Affiliate 1 referred by Seller
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate.address, seller.address); // Affiliate 1 referred by Seller
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate2.address, affiliate.address); // Affiliate 2 referred by Affiliate 1
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate3.address, affiliate2.address); // Affiliate 3 referred by Affiliate 2
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate4.address, affiliate3.address); // Affiliate 4 referred by Affiliate 3
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate5.address, affiliate4.address); // Affiliate 5 referred by Affiliate 4

        // Setup up referrer ranks
        await affiliates.setReferrerRank(affiliate.address, 1, tokenId); // Set rank for Affiliate 1
        await affiliates.setReferrerRank(affiliate2.address, 1, tokenId); // Set rank for Affiliate 2
        // Continue for other affiliates as needed

        // Record initial balances for affiliates and buyer (affiliate5)
        let initialBalances = [];
        for (let aff of [affiliate, affiliate2, affiliate3, affiliate4, affiliate5]) {
          let balance = await ethers.provider.getBalance(aff.address);
          initialBalances.push(balance);
        }

        // Affiliate 5 makes a purchase
        await booth.authorizeBuyer(affiliate5.address);
        await booth
          .connect(affiliate5)
          .affiliateBuy(tokenId, nftId, 1, affiliate5.address, affiliate4.address, {
            value: nftPrice,
          });

        // Record final balances
        let finalBalances = [];
        for (let aff of [affiliate, affiliate2, affiliate3, affiliate4, affiliate5]) {
          let balance = await ethers.provider.getBalance(aff.address);
          finalBalances.push(balance);
        }

        // Compare initial and final balances for affiliates
        for (let i = 0; i < finalBalances.length - 1; i++) {
          expect(finalBalances[i]).to.be.above(
            initialBalances[i],
            `Final balance of affiliate at index ${i} should be higher than its initial balance`,
          );
        }

        // For Affiliate 5, check if the balance decreased due to the purchase
        expect(finalBalances[4]).to.be.below(
          initialBalances[4],
          'Affiliate 5 final balance should be lower than its initial balance due to the purchase',
        );
      });

      it('should correctly set and retrieve referrers', async function () {
        // Set up the referral structure
        await affiliates.enrollInitialAffiliateForNFT(tokenId, seller.address); // Affiliate 1 referred by Seller
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate.address, seller.address); // Affiliate 1 referred by Seller
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate2.address, affiliate.address); // Affiliate 2 referred by Affiliate 1
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate3.address, affiliate2.address); // Affiliate 3 referred by Affiliate 2
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate4.address, affiliate3.address); // Affiliate 4 referred by Affiliate 3
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate5.address, affiliate4.address); // Affiliate 5 referred by Affiliate 4

        // Retrieve and check referrers
        const nftDataOfAffiliate1 = await affiliates.getAffiliateNFTData(
          tokenId,
          affiliate.address,
        );
        expect(nftDataOfAffiliate1.referrer).to.equal(seller.address);

        const nftDataOfAffiliate2 = await affiliates.getAffiliateNFTData(
          tokenId,
          affiliate2.address,
        );
        expect(nftDataOfAffiliate2.referrer).to.equal(affiliate.address);

        const nftDataOfAffiliate3 = await affiliates.getAffiliateNFTData(
          tokenId,
          affiliate3.address,
        );
        expect(nftDataOfAffiliate3.referrer).to.equal(affiliate2.address);

        const nftDataOfAffiliate4 = await affiliates.getAffiliateNFTData(
          tokenId,
          affiliate4.address,
        );
        expect(nftDataOfAffiliate4.referrer).to.equal(affiliate3.address);

        const nftDataOfAffiliate5 = await affiliates.getAffiliateNFTData(
          tokenId,
          affiliate5.address,
        );
        expect(nftDataOfAffiliate5.referrer).to.equal(affiliate4.address);
      });

      it('should correctly calculate rewards', async function () {
        const nftId = 98732465;
        // Set up the referral structure
        await affiliates.enrollInitialAffiliateForNFT(tokenId, seller.address);

        await affiliates.enrollAffiliateForNFT(tokenId, affiliate.address, seller.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate2.address, affiliate.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate3.address, affiliate2.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate4.address, affiliate3.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate5.address, affiliate4.address);

        const commission = nftPrice.mul(commissionPercent).div(100);

        const [receiver, royaltyAmount] = await ticket.royaltyInfo(tokenId, nftPrice);

        await booth.authorizeBuyer(affiliate5.address);
        await booth
          .connect(affiliate5)
          .affiliateBuy(tokenId, nftId, 1, affiliate5.address, affiliate4.address, {
            value: nftPrice,
          });

        // Verify rewards for each affiliate
        for (const aff of [affiliate, affiliate2, affiliate3, affiliate4]) {
          const affiliateLevel = await affiliates.getAffiliateLevel(tokenId, aff.address);
          const affiliateRank = await affiliates.getAffiliateRank(aff.address);
          const referralRewardBasisPoint =
            await affiliates.getReferralRewardBasisPointsForLevelAndRank(
              affiliateLevel,
              affiliateRank,
            );
          const expectedReward = commission.mul(referralRewardBasisPoint).div(10000);
          const actualReward = await affiliates.getAffiliateTotalRewards(tokenId, aff.address);
          expect(actualReward).to.be.closeTo(
            expectedReward,
            royaltyAmount,
            `Reward mismatch for affiliate at level ${affiliateLevel} and rank ${affiliateRank}`,
          );
        }
      });

      it('should correctly calculate referral level', async function () {
        // Set up the referral structure
        await affiliates.enrollInitialAffiliateForNFT(tokenId, seller.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate.address, seller.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate2.address, affiliate.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate3.address, affiliate2.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate4.address, affiliate3.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate5.address, affiliate4.address);

        const affiliate1Level = await affiliates.getAffiliateLevel(tokenId, affiliate.address);
        const affiliate2Level = await affiliates.getAffiliateLevel(tokenId, affiliate2.address);
        const affiliate3Level = await affiliates.getAffiliateLevel(tokenId, affiliate3.address);
        const affiliate4Level = await affiliates.getAffiliateLevel(tokenId, affiliate4.address);
        const affiliate5Level = await affiliates.getAffiliateLevel(tokenId, affiliate5.address);

        expect(affiliate1Level).to.equal(1);
        expect(affiliate2Level).to.equal(2);
        expect(affiliate3Level).to.equal(3);
        expect(affiliate4Level).to.equal(4);
        // Max depth is reached aand the next one should be 0
        expect(affiliate5Level).to.equal(0);
      });

      it('should correctly retrieve affiliate nft information', async function () {
        // Join affiliate program
        await affiliates.enrollInitialAffiliateForNFT(tokenId, seller.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate.address, seller.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate2.address, affiliate.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate3.address, affiliate.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate4.address, affiliate.address);

        // Get affiliate info for that nft
        const affiliateInfo = await affiliates.getAffiliateNFTData(tokenId, affiliate.address);
        // Check referred users
        expect(affiliateInfo.referredUsers.length).to.equal(3);
      });

      it('should update and verify affiliate direct referrals', async function () {
        // Join affiliate program
        await affiliates.enrollInitialAffiliateForNFT(tokenId, seller.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate.address, seller.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate2.address, affiliate.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate3.address, affiliate.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate4.address, affiliate.address);

        // Get affiliate info for that nft
        const affiliateDirectReferrals = await affiliates.getAffiliateDirectReferrals(
          affiliate.address,
        );
        // Set rank for affiliate
        expect(affiliateDirectReferrals).to.equal(3);
      });

      it('should correctly calculate referral rewards in a complete hierarchy', async function () {
        // Set up the referral structure
        const nftId = 573874501;

        // Set up the referral structure
        await affiliates.enrollInitialAffiliateForNFT(tokenId, seller.address);
        // affiliate -> affiliate2 -> affiliate3 -> affiliate4 -> affiliate5
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate.address, seller.address); // Affiliate 1 referred by Seller
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate2.address, affiliate.address); // Affiliate 2 referred by Affiliate 1
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate3.address, affiliate2.address); // Affiliate 3 referred by Affiliate 2
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate4.address, affiliate3.address); // Affiliate 4 referred by Affiliate 3
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate5.address, affiliate4.address); // Affiliate 5 referred by Affiliate 4

        // // Set up the referrer ranks
        await affiliates.setReferrerRank(affiliate.address, 0, tokenId);
        await affiliates.setReferrerRank(affiliate2.address, 1, tokenId);
        await affiliates.setReferrerRank(affiliate3.address, 2, tokenId);
        await affiliates.setReferrerRank(affiliate4.address, 3, tokenId);
        await affiliates.setReferrerRank(affiliate5.address, 4, tokenId);

        // BigNumber for purchase price
        const commission = nftPrice.mul(commissionPercent).div(100);

        // Make the purchase by Affiliate 5
        await booth.authorizeBuyer(affiliate5.address);
        await booth
          .connect(affiliate5)
          .affiliateBuy(tokenId, nftId, 1, affiliate5.address, affiliate4.address, {
            value: nftPrice,
          });

        const [receiver, royaltyAmount] = await ticket.royaltyInfo(tokenId, nftPrice);

        for (const aff of [affiliate, affiliate2, affiliate3, affiliate4]) {
          const affiliateLevel = await affiliates.getAffiliateLevel(tokenId, aff.address);
          const affiliateRank = await affiliates.getAffiliateRank(aff.address);
          const referralRewardBasisPoint =
            await affiliates.getReferralRewardBasisPointsForLevelAndRank(
              affiliateLevel,
              affiliateRank,
            );
          const expectedReward = commission.mul(referralRewardBasisPoint).div(10000);
          const actualReward = await affiliates.getAffiliateTotalRewards(tokenId, aff.address);
          expect(actualReward).to.be.closeTo(
            expectedReward,
            royaltyAmount,
            `Reward mismatch for affiliate at level ${affiliateLevel} and rank ${affiliateRank}`,
          );
        }
      });

      it('should start a new hierarchy after max depth is reached', async function () {
        const nftId = 543266543;

        // Set up the initial referral structure
        await affiliates.enrollInitialAffiliateForNFT(tokenId, affiliate.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate2.address, affiliate.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate3.address, affiliate2.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate4.address, affiliate3.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate5.address, affiliate4.address); // This should reach maxDepth

        // BigNumber for purchase price
        // Calculate commission using BigNumber operations
        const commission = nftPrice.mul(commissionPercent).div(100);

        await booth.authorizeBuyer(buyer.address);
        await booth
          .connect(buyer)
          .affiliateBuy(tokenId, nftId, 1, buyer.address, affiliate5.address, {
            value: nftPrice,
          });

        const [receiver, royaltyAmount] = await ticket.royaltyInfo(tokenId, nftPrice);

        for (const aff of [affiliate, affiliate2, affiliate3, affiliate4]) {
          const affiliateLevel = await affiliates.getAffiliateLevel(tokenId, aff.address);
          const affiliateRank = await affiliates.getAffiliateRank(aff.address);
          const referralRewardBasisPoint =
            await affiliates.getReferralRewardBasisPointsForLevelAndRank(
              affiliateLevel,
              affiliateRank,
            );
          const expectedReward = commission.mul(referralRewardBasisPoint).div(10000);
          const actualReward = await affiliates.getAffiliateTotalRewards(tokenId, aff.address);
          expect(actualReward).to.be.closeTo(
            expectedReward,
            royaltyAmount,
            `Reward mismatch for affiliate at level ${affiliateLevel} and rank ${affiliateRank}`,
          );
        }

        // Now we test affilite 4 inviting new members and we needd to verify this rewards are distributed correctly as well
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate6.address, affiliate5.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate7.address, affiliate6.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate8.address, affiliate7.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate9.address, affiliate8.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate10.address, affiliate9.address);

        await booth.authorizeBuyer(buyer.address);
        await booth
          .connect(buyer)
          .affiliateBuy(tokenId, nftId, 1, buyer.address, affiliate10.address, {
            value: nftPrice,
          });

        for (const aff of [affiliate5, affiliate6, affiliate7, affiliate8, affiliate9]) {
          const affiliateLevel = await affiliates.getAffiliateLevel(tokenId, aff.address);
          const affiliateRank = await affiliates.getAffiliateRank(aff.address);
          const referralRewardBasisPoint =
            await affiliates.getReferralRewardBasisPointsForLevelAndRank(
              affiliateLevel,
              affiliateRank,
            );
          const expectedReward = commission.mul(referralRewardBasisPoint).div(10000);
          const actualReward = await affiliates.getAffiliateTotalRewards(tokenId, aff.address);
          expect(actualReward).to.be.closeTo(
            expectedReward,
            royaltyAmount,
            `Reward mismatch for affiliate at level ${affiliateLevel} and rank ${affiliateRank}`,
          );
        }
      });

      it('should correctly return the referral reward basis points', async function () {
        const rewardBasisPoints = await affiliates.getReferralRewardBasisPoints();

        // Expected values
        const expectedValues = referralRewardBasisPointsArray;

        // Iterate through each level and rank, and compare the values
        for (let level = 0; level < expectedValues.length; level++) {
          for (let rank = 0; rank < expectedValues[level].length; rank++) {
            const expectedValue = expectedValues[level][rank];
            const actualValue = rewardBasisPoints[level][rank].toNumber();

            expect(actualValue).to.equal(
              expectedValue,
              `Mismatch at level ${level + 1}, rank ${rank + 1}`,
            );
          }
        }
      });

      it('should correctly return the maximum referral depth', async function () {
        const initialMaxDepth = maxReferralDepth;

        const _maxDepth = await affiliates.getMaxDepth();

        expect(initialMaxDepth).to.equal(_maxDepth);
      });

      it('should correctly return referral reward basis points for a given level and rank', async function () {
        const _result = await affiliates.getReferralRewardBasisPointsForLevelAndRank(
          0 /** uint256 level */,
          0 /** uint256 rank */,
        );
        expect(_result).to.equal(1000);
      });

      it('should correctly return the rank criteria for a given rank', async function () {
        const rank = 1; // The rank for which criteria are being tested
        const _result = await affiliates.getRankCriteria(rank);

        // Expected values for rank 1
        const expectedDirectReferrals = 10; // Expected number of direct referrals
        const expectedSalesVolume = ethers.utils.parseEther('5'); // Expected sales volume (5 ETH in wei)

        // Check if the returned values match the expected values
        expect(_result.requiredDirectReferrals.toNumber()).to.equal(
          expectedDirectReferrals,
          `Mismatch in required direct referrals for rank ${rank}`,
        );
        expect(_result.requiredSalesVolume.toString()).to.equal(
          expectedSalesVolume.toString(),
          `Mismatch in required sales volume for rank ${rank}`,
        );
      });

      it('should correctly return the total number of affiliates for a given NFT', async function () {
        // Set up the initial referral structure
        await affiliates.enrollInitialAffiliateForNFT(tokenId, seller.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate.address, seller.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate2.address, affiliate.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate3.address, affiliate2.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate4.address, affiliate3.address);

        const totalNFTAffiliates = await affiliates.getTotalNFTAffiliates(tokenId);
        expect(totalNFTAffiliates).to.equal(5);
      });

      it('should verify is affiliate for specific tokenID', async function () {
        // Set up the initial referral structure
        await affiliates.enrollInitialAffiliateForNFT(tokenId, seller.address);
        await affiliates.enrollAffiliateForNFT(tokenId, affiliate.address, seller.address);
        const verifyIsAffiliate = await affiliates.isAffiliateForNFT(tokenId, affiliate.address);
        expect(verifyIsAffiliate).to.be.true;
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
          affiliates.enrollInitialAffiliateForNFT(999, owner.address),
        ).to.be.revertedWith('Object is not registered');
      });

      it('should avoid joining the affiliate program twice for the same object', async function () {
        await affiliates.enrollInitialAffiliateForNFT(tokenId, seller.address);
        await affiliates.enrollAffiliateForNFT(tokenId, owner.address, seller.address);
        await expect(
          affiliates.enrollAffiliateForNFT(tokenId, owner.address, seller.address),
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
            .setReferralRewardBasisPoints(levelToUpdate, rankToUpdate, newRewardBasisPoints),
        ).to.be.revertedWith(
          'AccessControl: account ' +
            nonBoothAccount.address.toLowerCase() +
            ' is missing role ' +
            BOOTH_ROLE.toLowerCase(),
        );
      });
    });

    describe('Event Emission Tests', function () {
      it('should emit ReferralRewardUpdated event correctly', async function () {
        const level = 0;
        const rank = 0;
        const newRewardBasisPoints = 1500; // New reward basis points

        await expect(
          affiliates.connect(owner).setReferralRewardBasisPoints(level, rank, newRewardBasisPoints),
        )
          .to.emit(affiliates, 'ReferralRewardUpdated')
          .withArgs(level, rank, newRewardBasisPoints);
      });

      it('should emit RankUp event correctly', async function () {
        const { nft, id } = await deployTicketNFT(
          573874501, // id
          100, // stock
          true, // use stock
          true, // limited edition
          seller.address, // seller address
        );

        // become affiliate for nft
        await affiliates.enrollAffiliateForNFT(id, affiliate.address, seller.address);
        // Affiliate is ccurrently rank 0, he will Enrol 10 more affiliates to reach rank 1
        // Create an array to store the new affiliates
        let newAffiliates = [];
        let initialRank = 0;

        // Generate 10 random accounts
        for (let i = 0; i < 10; i++) {
          // Create a new random account
          const randomWallet = ethers.Wallet.createRandom();
          // Add the new account to the list of affiliates
          newAffiliates.push(randomWallet.address);
        }

        for (let newAffiliate of newAffiliates) {
          await affiliates.enrollAffiliateForNFT(id, newAffiliate, affiliate.address);
        }
        // Update Sales volume to meet required criteri for rankup
        const saleAmount = ethers.utils.parseEther('5');
        await affiliates.connect(owner).updateSalesVolume(affiliate.address, saleAmount);
        // Check eligibility for rank up
        const eligibility = await affiliates.checkEligibilityForRankUp(affiliate.address);
        expect(eligibility.eligible).to.be.true;

        // Perform the rank up and expect the RankUp event to be emitted
        await expect(affiliates.rankUp(affiliate.address))
          .to.emit(affiliates, 'RankUp')
          .withArgs(affiliate.address, initialRank + 1);

        // Verify that the rank has been updated
        const newRank = await affiliates.getAffiliateRank(affiliate.address);
        expect(newRank).to.equal(initialRank + 1);
      });

      it('should emit SalesVolumeUpdated event correctly', async function () {
        const { nft, id } = await deployTicketNFT(
          573874501, // id
          100, // stock
          true, // use stock
          true, // limited edition
          seller.address, // seller address
        );

        // become affiliate for nft
        await affiliates.enrollAffiliateForNFT(id, affiliate.address, seller.address);

        const amount = ethers.utils.parseEther('1');

        await expect(affiliates.connect(owner).updateSalesVolume(affiliate.address, amount))
          .to.emit(affiliates, 'SalesVolumeUpdated')
          .withArgs(affiliate.address, amount);
      });
    });
  });
}

const testAffiliateUtils = true;
if (testAffiliateUtils) {
  describe('AffiliateUtils Contract', function () {
    describe('Deployment and Initial Settings', function () {
      it('should deploy the AffiliateUtils contract', async function () {
        expect(affiliate_utils.address).to.not.equal(0x0);
        expect(affiliate_utils.address).to.not.equal(null);
        expect(affiliate_utils.address).to.not.equal(undefined);
        expect(affiliate_utils.address).to.not.equal('');
      });
      // it('should set initial settings correctly', async function () {
      //   // Test initial settings like maxPageSize, admin role, etc.
      // });
    });

    describe('Functional Tests', function () {
      async function deployTicketNFT(_id, stock, use_stock, limited_edition, seller_address) {
        // Seller will deploy a nft
        const price = ethers.utils.parseEther('0.01');
        const id = _id;
        Ticket = await ethers.getContractFactory('Ticket', seller);
        ticketContract = await Ticket.deploy(
          id, // tokenId
          price, // price
          stock, // initialStock
          use_stock, // useStock
          limited_edition, // limited Edition
          seller_address, // Royalty address, same as seller
          500, // royalty percentage represented in basis points
          [owner.address, seller_address], // Payees
          [10, 90], // Payees distribution commission
          uri, // nft uri
          ticket_registry.address,
        );
        await ticketContract.deployed();
        // Register nft in booth and registry
        await ticket_registry.registerObject(id, ticket.address);
        await ticketContract.grantRole(await ticketContract.BOOTH_ROLE(), booth.address);
        // Enroll initial affiliate
        await affiliates.enrollInitialAffiliateForNFT(id, seller_address);

        return { ticketContract, id };
      }

      describe('Getter Functions', function () {
        it('should correctly return affiliate information', async function () {
          // Test getAffiliateInformation function

          const { nft, id } = await deployTicketNFT(
            573874501, // id
            100, // stock
            true, // use stock
            true, // limited edition
            seller.address, // seller address
          );

          await affiliates.enrollAffiliateForNFT(id, affiliate.address, seller.address);

          const affiliateInformation = await affiliate_utils.getAffiliateInformation(
            affiliate.address,
          );

          expect(affiliateInformation.referrer).to.equal(seller.address);
        });

        it('should correctly return nft affiliate information', async function () {
          const { nft, id } = await deployTicketNFT(
            573874501, // id
            100, // stock
            true, // use stock
            true, // limited edition
            seller.address, // seller address
          );

          await affiliates.enrollAffiliateForNFT(id, affiliate.address, seller.address);

          const affiliateInformation = await affiliate_utils.getNFTAffiliateInformation(
            id,
            affiliate.address,
          );

          expect(affiliateInformation.referrer).to.equal(seller.address);
        });

        it('should correctly return a list of affiliates', async function () {
          const { nft, id } = await deployTicketNFT(
            573874501, // id
            100, // stock
            true, // use stock
            true, // limited edition
            seller.address, // seller address
          );

          await affiliates.enrollAffiliateForNFT(id, affiliate.address, seller.address);
          await affiliates.enrollAffiliateForNFT(id, affiliate2.address, affiliate.address);
          await affiliates.enrollAffiliateForNFT(id, affiliate3.address, affiliate2.address);
          await affiliates.enrollAffiliateForNFT(id, affiliate4.address, affiliate3.address);
          await affiliates.enrollAffiliateForNFT(id, affiliate5.address, affiliate4.address);
          await affiliates.enrollAffiliateForNFT(id, affiliate6.address, affiliate5.address);
          await affiliates.enrollAffiliateForNFT(id, affiliate7.address, affiliate6.address);
          await affiliates.enrollAffiliateForNFT(id, affiliate8.address, affiliate7.address);
          await affiliates.enrollAffiliateForNFT(id, affiliate9.address, affiliate8.address);

          const [list, totalCount] = await affiliate_utils.getAffiliates(1, 6);

          // Now you can use 'affiliates' and 'totalCount' directly
          expect(list.length).to.equal(6);
          expect(totalCount).to.equal(10);
        });

        it('should correctly return all rank criterias', async function () {
          // Test getAffiliateReferralsChain function
          const criterias = await affiliate_utils.getAllRankCriterias();
          // Loop through each criteria and compare
          rankCriteriasArray.forEach((expectedCriteria, index) => {
            const actualCriteria = criterias[index];

            // Compare each field
            expect(
              actualCriteria.requiredDirectReferrals.eq(expectedCriteria.requiredDirectReferrals),
            ).to.be.true;
            expect(actualCriteria.requiredSalesVolume.eq(expectedCriteria.requiredSalesVolume)).to
              .be.true;
          });
        });

        it('should get nft affiliates for referrer', async function () {
          const { nft, id } = await deployTicketNFT(
            573874501, // id
            100, // stock
            true, // use stock
            true, // limited edition
            seller.address, // seller address
          );

          await affiliates.enrollAffiliateForNFT(id, affiliate.address, seller.address);
          await affiliates.enrollAffiliateForNFT(id, affiliate2.address, affiliate.address);
          await affiliates.enrollAffiliateForNFT(id, affiliate3.address, affiliate.address);
          await affiliates.enrollAffiliateForNFT(id, affiliate4.address, affiliate.address);
          await affiliates.enrollAffiliateForNFT(id, affiliate5.address, affiliate.address);
          await affiliates.enrollAffiliateForNFT(id, affiliate6.address, affiliate.address);
          await affiliates.enrollAffiliateForNFT(id, affiliate7.address, affiliate.address);
          await affiliates.enrollAffiliateForNFT(id, affiliate8.address, affiliate.address);
          await affiliates.enrollAffiliateForNFT(id, affiliate9.address, affiliate.address);

          const [affiliateInfo, count] = await affiliate_utils.getNftAffiliatesForReferrer(
            id,
            affiliate.address,
            1,
            12,
          );
          expect(count).to.equal(8);
          expect(affiliateInfo.length).to.equal(8);
        });

        it('should correctly return nft affiliate referrals chain', async function () {
          const { nft, id } = await deployTicketNFT(
            573874501, // id
            100, // stock
            true, // use stock
            true, // limited edition
            seller.address, // seller address
          );

          await affiliates.enrollAffiliateForNFT(id, affiliate.address, seller.address);
          await affiliates.enrollAffiliateForNFT(id, affiliate2.address, affiliate.address);
          await affiliates.enrollAffiliateForNFT(id, affiliate3.address, affiliate.address);
          await affiliates.enrollAffiliateForNFT(id, affiliate4.address, affiliate.address);
          await affiliates.enrollAffiliateForNFT(id, affiliate5.address, affiliate.address);
          await affiliates.enrollAffiliateForNFT(id, affiliate6.address, affiliate.address);
          await affiliates.enrollAffiliateForNFT(id, affiliate7.address, affiliate.address);
          await affiliates.enrollAffiliateForNFT(id, affiliate8.address, affiliate.address);
          await affiliates.enrollAffiliateForNFT(id, affiliate9.address, affiliate.address);

          const referralChain = await affiliate_utils.getNFTAffiliateReferralsChain(
            id,
            affiliate.address,
          );
        });
      });
    });
  });
}

const testAuctions = true;
if (testAuctions) {
  describe('Auctions Contract', function () {
    async function setupAuction() {
      // Common setup steps
      const _nftId = 123;
      const _qty = 1;
      const _guy = buyer.address;
      const _value = nftPrice.mul(_qty);

      // Grant BUYER_ROLE and buy the NFT
      await booth.authorizeBuyer(buyer.address);
      await booth.connect(buyer).buy(tokenId, _nftId, _qty, _guy, { value: _value });

      // Grant Auctions contract approval to manage buyer's tokens
      await ticket.connect(buyer).setApprovalForAll(auctions.address, true);

      // Create the auction
      const _startingPrice = ethers.utils.parseEther('0.02');
      const _duration = 7 * 24 * 60 * 60; // 1 week in seconds
      const _reservePrice = nftPrice;

      const tx = await auctions
        .connect(buyer)
        .createAuction(ticket.address, tokenId, _nftId, _startingPrice, _duration, _reservePrice);
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

        // Expect the function to fail when called by an account without the BOOTH_ROLE
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

const testAuctionUtilities = true;
if (testAuctionUtilities) {
  describe('AuctionUtils Contract Tests', function () {
    async function setupAuction(nftId) {
      // Common setup steps
      const _nftId = nftId;
      const _qty = 1;
      const _guy = buyer.address;
      const _value = nftPrice.mul(_qty);

      // Grant BUYER_ROLE and buy the NFT
      await booth.authorizeBuyer(buyer.address);
      await booth.connect(buyer).buy(tokenId, _nftId, _qty, _guy, { value: _value });

      // Grant Auctions contract approval to manage buyer's tokens
      await ticket.connect(buyer).setApprovalForAll(auctions.address, true);

      // Create the auction
      const _startingPrice = ethers.utils.parseEther('0.02');
      const _duration = 7 * 24 * 60 * 60; // 1 week in seconds
      const _reservePrice = nftPrice;

      const tx = await auctions
        .connect(buyer)
        .createAuction(ticket.address, tokenId, _nftId, _startingPrice, _duration, _reservePrice);
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

    // // Test for getAuctionsByTokenId
    describe('Get Auctions By Token ID', function () {
      it('should return auctions for a specific Token ID', async function () {
        // Implement test logic
        await setupAuction(123);
        await setupAuction(123);
        await setupAuction(123);

        await setupAuction(123);
        await setupAuction(123);
        await setupAuction(123);
        await setupAuction(123);

        const firstPage = await auction_utilities.getAuctionsByTokenId(tokenId, 1, 8);

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

        const firstPage = await auction_utilities.getAuctionsByTokenId(tokenId, 1, 4);
        const secondPage = await auction_utilities.getAuctionsByTokenId(tokenId, 2, 4);

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
