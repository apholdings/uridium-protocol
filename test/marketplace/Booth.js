const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Booth Tests", function () { 
    let Ticket, ticket, Affiliates, affiliates, Booth, booth;
    let owner, seller, buyer, buyer2, royaltyReceiver, affiliate, affiliate2, affiliate3;
    const nftPrice = ethers.utils.parseEther("0.01");
    const uri = "https://boomslag.com/api/courses/nft/";
    const initialStock = 30;
    const tokenId = 123;
    const royaltyPercentage = 500; // 5% represented in basis points (100 basis points = 1%)
    
    // Create an array of referralRewardBasisPoints
    const maxDepth = 5; // MLM Max number of Hierarchy
    // const referralRewardBasisPointsArray = Array(maxDepth).fill(referralRewardBasisPoints); // This gives the same percentage to all memebrs
    const referralRewardBasisPointsArray = [150, 300, 450, 500, 600]; // 8% for A1, 12% for A2, This represents 20% of 100% that is the course price
    
    beforeEach(async function () {
        [owner, seller, buyer, buyer2, royaltyReceiver,affiliate, affiliate2,affiliate3] = await ethers.getSigners();

        // Deploy Affiliates Contract
        Affiliates = await ethers.getContractFactory("Affiliates");
        affiliates = await Affiliates.deploy(referralRewardBasisPointsArray, maxDepth);
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
            await booth.connect(buyer).buy(tokenId, nftId, qty, guy,{ value: nftPrice });
        });

        it("Buy NFT with affiliate", async function () {
            const nftId = 1;
            const qty = 1;
            const guy = buyer.address

            await booth.connect(buyer).affiliateBuy(tokenId, nftId, qty, guy, { value: nftPrice.mul(qty) });
        });

        it("Buy NFT with Discount", async function () {
            const nftId = 1;
            const qty = 1;
            const guy = buyer.address

            await booth.connect(buyer).discountBuy(tokenId, nftId, qty, guy, { value: ethers.utils.parseEther("0.005") });
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
            await booth.connect(affiliate).joinAffiliateProgram(tokenId, owner.address);
            expect(await booth.verifyAffiliate(tokenId, affiliate.address)).to.be.true;
        });

        it("Join affiliate program and buy", async function () {
            const nftId = 1;
            const qty = 1;

            // Affiliate2 joins affiliate program under Affiliate and buys the NFT
            await booth.connect(affiliate2).joinAffiliateProgramAndBuy(tokenId, nftId, qty, affiliate.address, { value: nftPrice.mul(qty) });

            // Check if Affiliate2 is an affiliate for the course
            expect(await booth.verifyAffiliate(tokenId, affiliate2.address)).to.be.true;

            // Check if Affiliate2 is added under Affiliate
            expect(await affiliates.referrers(affiliate2.address)).to.equal(affiliate.address);
        });

        it("Affiliate rewards distribution", async function () {
            const nftId = 1;
            const qty = 1;

            // Affiliate1 generates an affiliate link and becomes a referrer of their own group
            await booth.connect(affiliate).joinAffiliateProgram(tokenId, affiliate.address);

            // User2 (affiliate2) buys through Affiliate1's link
            await booth.connect(affiliate2).joinAffiliateProgramAndBuy(tokenId, nftId, qty, affiliate.address, { value: nftPrice.mul(qty) });

            
            // Log the initial and updated balances of Affiliate1 after User2's purchase
            const initialAffiliate1Balance = await ethers.provider.getBalance(affiliate.address);
            // console.log("Initial Affiliate1 Balance:", initialAffiliate1Balance.toString());
            const affiliate1Reward = nftPrice.mul(150).div(10000);
            // Log rewards and purchase price
            // console.log("Purchase Price:", nftPrice.mul(qty).toString());
            
            const expectedAffiliate1Balance = initialAffiliate1Balance.add(affiliate1Reward);
            // console.log("Updated Affiliate1 Balance after User2's purchase:", (await ethers.provider.getBalance(affiliate.address)).toString());
            // console.log("Expected Affiliate1 Balance after User2's purchase:", expectedAffiliate1Balance.toString());
            
            
            // User3 (affiliate3) buys through Affiliate2's link
            await booth.connect(affiliate3).joinAffiliateProgramAndBuy(tokenId, nftId, qty, affiliate2.address, { value: nftPrice.mul(qty) });

            // Log the initial and updated balances of Affiliate2 after User3's purchase
            const initialAffiliate2Balance = await ethers.provider.getBalance(affiliate2.address);
            // console.log("Initial Affiliate2 Balance:", initialAffiliate2Balance.toString());
            const affiliate2Reward = nftPrice.mul(300).div(10000);
            // console.log("Affiliate2 Reward:", affiliate2Reward.toString());

            const expectedAffiliate2Balance = initialAffiliate2Balance.add(affiliate2Reward);
            // console.log("Updated Affiliate2 Balance after User3's purchase:", expectedAffiliate2Balance);

            // Log the updated balance of Affiliate1 after User3's purchase
            const additionalAffiliate1Reward = nftPrice.mul(150).div(10000);
            const finalExpectedAffiliate1Balance = expectedAffiliate1Balance.add(additionalAffiliate1Reward);
            // console.log("Updated Affiliate1 Balance after User3's purchase:", finalExpectedAffiliate1Balance);
        });
    });
});