const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Auctions Tests", function () { 
    let Ticket, ticket, Auctions, auctions;
    let owner, seller, buyer, buyer2, royaltyReceiver, buyer3;
    const nftPrice = ethers.utils.parseEther("0.01");
    const uri = "https://boomslag.com/api/courses/nft/";
    const initialStock = 30;
    const tokenId = 123;
    const nftId = 1;
    const royaltyPercentage = 500; // 5% represented in basis points (100 basis points = 1%)
    const startingPrice = ethers.utils.parseEther("0.5");
    const auctionDuration = 86400; // 24 hours in seconds
    const useStock = true;
    const limitedEdition = false;

    beforeEach(async function () {
        [owner, seller, buyer, buyer2, buyer3, royaltyReceiver] = await ethers.getSigners();
        
        // Deploy Ticket Contract
        Ticket = await ethers.getContractFactory("Ticket");
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
            
        // Deploy Booth Contract
        Auctions = await ethers.getContractFactory("Auctions");
        auctions = await Auctions.deploy(ticket.address);
        await auctions.deployed();

        // Approve the auction contract to manage the NFT on behalf of the seller
        await ticket.connect(buyer).setApprovalForAll(auctions.address, true);
    });
        
    describe("Deployment", function () {
        it("Deploy Ticket contract", async function () {
            expect(ticket.address).to.not.equal(0x0);
            expect(ticket.address).to.not.equal(null);
            expect(ticket.address).to.not.equal(undefined);
            expect(ticket.address).to.not.equal("");
        });
        it("Deploy Auctions contract", async function () {
            expect(auctions.address).to.not.equal(0x0);
            expect(auctions.address).to.not.equal(null);
            expect(auctions.address).to.not.equal(undefined);
            expect(auctions.address).to.not.equal("");
        });
    });

    describe("Auction functionality", function () { 
        it("Create a new auction", async function () {
            await ticket.connect(buyer).mint(tokenId, nftId, 1, buyer.address, { value: nftPrice });
            let buyerBalance = await ticket.balanceOf(buyer.address, nftId)
            expect(buyerBalance).to.equal(1);

            const auctionCountBefore = await auctions.nextAuctionId();

            await auctions.connect(buyer).createAuction(tokenId, nftId, startingPrice, auctionDuration);
            const auctionCountAfter = await auctions.nextAuctionId();

            expect(auctionCountAfter).to.equal(auctionCountBefore.add(1));
        });

        it("Place a bid on the auction", async function () {
            await ticket.connect(buyer).mint(tokenId, nftId, 1, buyer.address, { value: nftPrice });
            let buyerBalance = await ticket.balanceOf(buyer.address, nftId)
            expect(buyerBalance).to.equal(1);

            await auctions.connect(buyer).createAuction(tokenId, nftId, startingPrice, auctionDuration);
            const auctionId = await auctions.nextAuctionId() - 1;

            const buyerBidAmount = ethers.utils.parseEther("1");
            await auctions.connect(buyer2).placeBid(auctionId, { value: buyerBidAmount });

            const auction = await auctions.auctions(auctionId);
            expect(auction.highestBid).to.equal(buyerBidAmount);
            expect(auction.highestBidder).to.equal(buyer2.address);
        });
    });

    describe("Auction functionality edge cases", function () {

        it("End an auction successfully", async function () {
            // Mint NFT to the buyer's address because they bought the course.
            await ticket.connect(buyer).mint(tokenId, nftId, 1, buyer.address, { value: nftPrice });

            // Let the buyer create the auction
            await auctions.connect(buyer).createAuction(tokenId, nftId, startingPrice, auctionDuration);
            const auctionId = await auctions.nextAuctionId() - 1;

            const buyerBidAmount = ethers.utils.parseEther("1");
            await auctions.connect(buyer2).placeBid(auctionId, { value: buyerBidAmount });

            await ethers.provider.send("evm_increaseTime", [auctionDuration]);
            await ethers.provider.send("evm_mine");

            await auctions.endAuction(auctionId);

            // Fetch the updated auction details
            const updatedAuction = await auctions.auctions(auctionId);
            expect(updatedAuction.ended).to.equal(true);
        });

        it("Withdraw the highest bid when outbid", async function () {
            // Mint NFT to the buyer's address because they bought the course.
            await ticket.connect(buyer).mint(tokenId, nftId, 1, buyer.address, { value: nftPrice });

            // Let the buyer create the auction
            await auctions.connect(buyer).createAuction(tokenId, nftId, startingPrice, auctionDuration);
            const auctionId = await auctions.nextAuctionId() - 1;

            const buyerBidAmount = ethers.utils.parseEther("1");
            await auctions.connect(buyer2).placeBid(auctionId, { value: buyerBidAmount });

            // Record buyer2's balance before the next bid
            const buyer2BalanceBefore = await ethers.provider.getBalance(buyer2.address);

            // Place a new bid by buyer3 which is higher than the previous bid
            const buyer3NewBidAmount = ethers.utils.parseEther("2");
            const tx = await auctions.connect(buyer3).placeBid(auctionId, { value: buyer3NewBidAmount });

            // Check for the BidRefunded event
            const receipt = await tx.wait();
            const bidRefundedEvent = receipt.events.find((event) => event.event === "BidRefunded");
            expect(bidRefundedEvent).to.exist;

            // Check if the bid has been withdrawn and the buyer2 balance is updated
            const buyer2BalanceAfterRefund = await ethers.provider.getBalance(buyer2.address);
            expect(buyer2BalanceAfterRefund.sub(buyer2BalanceBefore)).to.equal(buyerBidAmount);
        });

        it("Fail to end an auction before its duration", async function () {
            // Mint NFT to the buyer's address because they bought the course.
            await ticket.connect(buyer).mint(tokenId, nftId, 1, buyer.address, { value: nftPrice });

            // Let the buyer create the auction
            await auctions.connect(buyer).createAuction(tokenId, nftId, startingPrice, auctionDuration);
            const auctionId = await auctions.nextAuctionId() - 1;

            // Attempt to end the auction before its duration, expecting it to fail
            await expect(auctions.endAuction(auctionId)).to.be.revertedWith("Auction is still ongoing");
        });

        it("Fail to create an auction without owning the ticket", async function () {
            // Attempt to create an auction without owning the ticket, expecting it to fail
            await expect(auctions.connect(buyer).createAuction(tokenId, nftId, startingPrice, auctionDuration)).to.be.revertedWith("Seller must own the ticket");
        });
    });

});