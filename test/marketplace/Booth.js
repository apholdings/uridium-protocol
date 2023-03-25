const { expect, assert } = require("chai");
const { ethers } = require("hardhat");

describe("Booth Tests", function () { 
    let Ticket, ticket, Affiliates, affiliates, Booth, booth;
    let owner, seller, buyer, buyer2, royaltyReceiver, affiliate, affiliate2, affiliate3, affiliate4, affiliate5;
    const nftPrice = ethers.utils.parseEther("0.01");
    const uri = "https://boomslag.com/api/courses/nft/";
    const initialStock = 30;
    const tokenId = 123;
    const royaltyPercentage = 500; // 5% represented in basis points (100 basis points = 1%)

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
        [800,   1000,   1200,   1400,   1600],
        [600,   800,    1000,   1200,   1400],
        [400,   600,    800,    1000,   1200],
        [200,   400,    600,    800,    1000],
        [100,   200,    400,    600,     800]
    ]; // Represented in basis points

    // Define the rank criteria
    const rankCriteriasArray = [
        {requiredDirectReferrals: 5, requiredSalesVolume: ethers.utils.parseEther("1")},
        {requiredDirectReferrals: 10, requiredSalesVolume: ethers.utils.parseEther("5")},
        {requiredDirectReferrals: 20, requiredSalesVolume: ethers.utils.parseEther("10")},
        {requiredDirectReferrals: 50, requiredSalesVolume: ethers.utils.parseEther("20")},
        {requiredDirectReferrals: 100, requiredSalesVolume: ethers.utils.parseEther("50")}
    ];

    beforeEach(async function () {
        [owner, seller, buyer, buyer2, royaltyReceiver, affiliate, affiliate2, affiliate3, affiliate4, affiliate5] = await ethers.getSigners();

        // Deploy Affiliates Contract and set ranks
        Affiliates = await ethers.getContractFactory("Affiliates");
        affiliates = await Affiliates.deploy(referralRewardBasisPointsArray, rankCriteriasArray, maxReferralDepth);
        await affiliates.deployed();
        // Deploy Ticket Contract
        Ticket = await ethers.getContractFactory("Ticket");
        ticket = await Ticket.deploy(
            tokenId,
            nftPrice,
            initialStock,
            royaltyReceiver.address,
            royaltyPercentage,
            [owner.address, seller.address],
            [10, 90],
            uri,
        ); // Payees, Shares
        await ticket.deployed();
            
        // Deploy Booth Contract
        Booth = await ethers.getContractFactory("Booth");
        booth = await Booth.deploy(affiliates.address);
        await booth.deployed();
        
        // Register the objectId and its corresponding ticket contract
        await booth.registerObject(tokenId, ticket.address);
        // // Set up affiliate
        // await affiliates.setReferrer(owner.address, affiliate.address);
        
        await affiliates.grantRole(await affiliates.BOOTH_ROLE(), booth.address);
        await ticket.grantRole(await ticket.BOOTH_ROLE(), booth.address);
    });

    describe("Deployment", function () {
        it("Deploy Ticket contract", async function () {
            expect(ticket.address).to.not.equal(0x0);
            expect(ticket.address).to.not.equal(null);
            expect(ticket.address).to.not.equal(undefined);
            expect(ticket.address).to.not.equal("");
        });
        it("Deploy Affiliates contract", async function () {
            expect(affiliates.address).to.not.equal(0x0);
            expect(affiliates.address).to.not.equal(null);
            expect(affiliates.address).to.not.equal(undefined);
            expect(affiliates.address).to.not.equal("");
        });
        it("Deploy Booth contract", async function () {
            expect(booth.address).to.not.equal(0x0);
            expect(booth.address).to.not.equal(null);
            expect(booth.address).to.not.equal(undefined);
            expect(booth.address).to.not.equal("");
        });
    });

    describe("Transactions", function () { 
        it("Buy NFT using Booth", async function () {
            const nftId = 1;
            const qty = 1;
            const guy = buyer.address
            await booth.connect(buyer).buy(tokenId, nftId, qty, guy,{ value: nftPrice.mul(qty) });
        });

        it("Buy NFT with Discount", async function () {
            const nftId = 1;
            const qty = 1;
            const guy = buyer.address
            await booth.connect(buyer).buy(tokenId, nftId, qty, guy, { value: ethers.utils.parseEther("0.005") });
        });
    });

    describe("Ownership", function () {
        it("Verify ownership of NFT after buying through Booth", async function () {
            const nftId = 1;
            const qty = 1;
            const guy = buyer.address

            // Check buyer's initial NFT balance
            let initialBuyerNFTBalance = await ticket.balanceOf(guy, nftId);
            expect(initialBuyerNFTBalance).to.equal(0);
            
            // Check buyer's initial ETH balance
            const initialBuyerEthBalance = await ethers.provider.getBalance(guy);

            // Buy NFT
            await booth.connect(buyer).buy(tokenId, nftId, qty, guy, { value: nftPrice.mul(qty) });

            // Verify Ownership
            const hasAccess = await booth.hasAccess(tokenId, guy);
            expect(hasAccess).to.equal(true);

            let buyerNFTBalance = await ticket.balanceOf(guy, nftId);
             expect(buyerNFTBalance).to.equal(1);
        });
    });

    describe("Affiliate System", function () {
        it("Join affiliate program without buying", async function () {
            await booth.grantRole(await booth.BUYER_ROLE(), affiliate.address);
            await booth.connect(affiliate).joinAffiliateProgram(tokenId, owner.address);
            expect(await booth.verifyAffiliate(tokenId, affiliate.address)).to.be.true;
        });

        it("Join affiliate program and buy", async function () {
            const nftId = 1;
            const qty = 1;
            await booth.grantRole(await booth.BUYER_ROLE(), affiliate2.address);
            // Affiliate2 joins affiliate program under Affiliate and buys the NFT
            await booth.connect(affiliate2).joinAffiliateProgramAndBuy(tokenId, nftId, qty, affiliate.address, { value: nftPrice.mul(qty) });
            // Check if Affiliate2 is an affiliate for the course
            expect(await booth.verifyAffiliate(tokenId, affiliate2.address)).to.be.true;
            // Check if Affiliate2 is added under Affiliate
            expect(await affiliates.referrers(affiliate2.address)).to.equal(affiliate.address);
        });

        describe("Referrals Test Suite", function () {
            it("Test referral system", async function () { 
                // User 1 refers User 2
                await affiliates.setReferrer(affiliate2.address, affiliate.address);

                // Check if the referrer for User 2 is set correctly
                const affiliate2Referrer = await affiliates.getReferrer(affiliate2.address);
                assert.equal(affiliate2Referrer, affiliate.address, "Referrer for User 2 is incorrect");
            });
            it("Test setReferrer and getReferrer", async function () { 
                // User 1 refers User 2
                await affiliates.setReferrer(affiliate2.address, affiliate.address);
                // User 1 refers User 3
                await affiliates.setReferrer(affiliate3.address, affiliate.address);
                
                // Check if the referrer for User 2 is set correctly
                const affiliate2Referrer = await affiliates.getReferrer(affiliate2.address);
                assert.equal(affiliate2Referrer, affiliate.address, "Referrer for User 2 is incorrect");

                // Check if the referrer for User 3 is set correctly
                const affiliate3Referrer = await affiliates.getReferrer(affiliate3.address);
                assert.equal(affiliate3Referrer, affiliate.address, "Referrer for User 3 is incorrect");

                // Check if the directReferrals count is updated correctly
                const directReferralsCount = await affiliates.directReferrals(affiliate.address);
                assert.equal(directReferralsCount.toString(), "2", "Direct referrals count for User 1 is incorrect");
            });
            it("Test setReferrerRank", async function () { 
                // Set rank for User 1
                const newRank = 1;
                await affiliates.setReferrerRank(affiliate.address, newRank);
                // Check if the referrer rank for User 1 is set correctly
                const affiliateRank = await affiliates.referrerRanks(affiliate.address);
                assert.equal(affiliateRank.toString(), newRank.toString(), "Rank for User 1 is incorrect");
            });
            it("Test getReferrerRank", async function () { 
                // Set rank for User 1
                const newRank = 1;
                await affiliates.setReferrerRank(affiliate.address, newRank);
                // Check if the referrer rank for User 1 is set correctly
                const affiliateRank = await affiliates.referrerRanks(affiliate.address);
                assert.equal(affiliateRank.toString(), newRank.toString(), "Rank for User 1 is incorrect");

                const getReferrerRank = await affiliates.getReferrerRank(affiliate.address);
                expect(getReferrerRank).to.equal(newRank)
            });
            it("Test referral depth calculation", async function () {
                // Set up the referral structure
                // affiliate -> affiliate2 -> affiliate3 -> affiliate4 -> affiliate5
                await affiliates.setReferrer(affiliate2.address, affiliate.address);
                await affiliates.setReferrer(affiliate3.address, affiliate2.address);
                await affiliates.setReferrer(affiliate4.address, affiliate3.address);
                await affiliates.setReferrer(affiliate5.address, affiliate4.address);

                // Get the referral depth for affiliate5
                const depth = await affiliates.getReferralDepth(affiliate5.address);
                assert.equal(depth.toString(), "4", "Referral depth for affiliate5 is incorrect");
            });
            it("Test referral reward calculations with hierarchy of 5", async function () {
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

                let rewards = [
                    reward,
                    reward2,
                    reward3,
                    reward4,
                    reward5,
                ]

                // console.log(rewards)
            });
            it("Test handleAffiliateProgram for referral hierarchy of 5", async function () { 
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
                const purchasePrice = ethers.utils.parseEther("0.01");
                const nftId = 1;
                const qty = 1;
                const guy = affiliate5.address;

                const initialBalances = [
                    await ethers.provider.getBalance(affiliate.address),
                    await ethers.provider.getBalance(affiliate2.address),
                    await ethers.provider.getBalance(affiliate3.address),
                    await ethers.provider.getBalance(affiliate4.address),
                    await ethers.provider.getBalance(affiliate5.address)
                ];
                // console.log('Initial Balances: ', initialBalances)
                // Purchase the NFT from the booth
                await booth.grantRole(await booth.BUYER_ROLE(), affiliate5.address);
                await booth.connect(affiliate5).affiliateBuy(tokenId, nftId, qty, guy, { value: purchasePrice });
                
                const finalBalances = [
                    await ethers.provider.getBalance(affiliate.address),
                    await ethers.provider.getBalance(affiliate2.address),
                    await ethers.provider.getBalance(affiliate3.address),
                    await ethers.provider.getBalance(affiliate4.address),
                    await ethers.provider.getBalance(affiliate5.address)
                ];
                // console.log('Final Balances: ', finalBalances)
                expect(finalBalances[0]).to.be.above(initialBalances[0]);
                expect(finalBalances[1]).to.be.above(initialBalances[1]);
                expect(finalBalances[2]).to.be.above(initialBalances[2]);
                expect(finalBalances[3]).to.be.above(initialBalances[3]);
                // expect(finalBalances[4]).to.be.equal(initialBalances[4]);
            });
        });
    });
});
