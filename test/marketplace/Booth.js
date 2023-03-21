const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Booth and Affiliate Tests", function () { 
    let Affiliates, Ticket, Booth, affiliates, ticket, booth;
    let owner, seller, buyer, buyer2, affiliate;
    const nftPrice = ethers.utils.parseEther("0.01");
    const uri = "https://boomslag.com/api/courses/nft/tokenid";
    const objectId = 1;
    const referralRewardBasisPoints = 1000; // 10%

    beforeEach(async function () {
        [owner, seller, buyer, buyer2, affiliate] = await ethers.getSigners();

        // Deploy Affiliates Contract
        Affiliates = await ethers.getContractFactory("Affiliates");
        affiliates = await Affiliates.deploy(referralRewardBasisPoints);
        await affiliates.deployed();

        // Deploy Ticket Contract
        Ticket = await ethers.getContractFactory("Ticket");
        ticket = await Ticket.deploy(nftPrice, [owner.address, seller.address], [10, 90], uri);
        await ticket.deployed();

        // Deploy Booth Contract
        Booth = await ethers.getContractFactory("Booth");
        booth = await Booth.deploy(affiliates.address);
        await booth.deployed();

        // Register the objectId and its corresponding ticket contract
        await booth.registerObject(objectId, ticket.address);

        await ticket.grantRole(await ticket.DISCOUNT_BUYER_ROLE(), booth.address);
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
            await booth.connect(buyer).buy(objectId, nftId, qty, guy,{ value: nftPrice });
        });

        it("Buy NFT with affiliate", async function () {
            const nftId = 1;
            const qty = 1;
            const guy = buyer.address
            const _affiliate = affiliate.address

            await booth.connect(buyer).affiliateBuy(objectId, nftId, qty, guy, _affiliate, { value: nftPrice.mul(qty) });
        });
        
        it("Buy NFT with Discount", async function () {
            const nftId = 1;
            const qty = 1;
            const guy = buyer.address

            await booth.connect(buyer).discountBuy(objectId, nftId, qty, guy, { value: ethers.utils.parseEther("0.005") });
        });

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
            await booth.connect(buyer).buy(objectId, nftId, qty, guy, { value: nftPrice.mul(qty) });

            // Verify Ownership
            const hasAccess = await booth.hasAccess(objectId, guy);
            expect(hasAccess).to.equal(true);

            let buyerNFTBalance = await ticket.balanceOf(guy, nftId);
             expect(buyerNFTBalance).to.equal(1);
        });

        it("Verify affiliate and seller commissions after buying through Booth with affiliateBuy", async function () {
            const nftId = 1;
            const qty = 1;
            const buyerAddress = buyer.address;
            const affiliateAddress = affiliate.address;

            // Record initial ETH balances for affiliate and seller
            const initialAffiliateEthBalance = await ethers.provider.getBalance(affiliateAddress);
            
            // Buy NFT through affiliateBuy
            await booth.connect(buyer).affiliateBuy(objectId, nftId, qty, buyerAddress, affiliateAddress, { value: nftPrice.mul(qty) });

            // Calculate expected commission for the affiliate
            const expectedAffiliateCommission = nftPrice.mul(qty).mul(referralRewardBasisPoints).div(10000);

            // Record final ETH balances for affiliate and seller
            const finalAffiliateEthBalance = await ethers.provider.getBalance(affiliateAddress);

            // Verify that the affiliate and seller received the correct commission
            expect(finalAffiliateEthBalance.sub(initialAffiliateEthBalance)).to.be.closeTo(expectedAffiliateCommission, ethers.utils.parseEther("0.0001"));
        });
    });
});