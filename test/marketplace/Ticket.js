const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Ticket Tests", function () { 
    let Ticket, ticket;
    let owner, seller, buyer, buyer2
    const nftPrice = ethers.utils.parseEther("0.01");
    const uri = "https://boomslag.com/api/courses/nft/";

    beforeEach(async function () {
        [owner, seller, buyer, buyer2] = await ethers.getSigners();

        // Deploy Ticket Contract
        Ticket = await ethers.getContractFactory("Ticket");
        ticket = await Ticket.deploy(nftPrice,[owner.address,seller.address],[10,90],uri); // Payees, Shares
        await ticket.deployed();

        await ticket.grantRole(await ticket.PAUSER_ROLE(), owner.address);
        await ticket.grantRole(await ticket.MINTER_ROLE(), owner.address);
    });

    describe("Deployment", function () {
        it("Deploy Ticket contract", async function () {
            expect(ticket.address).to.not.equal(0x0);
            expect(ticket.address).to.not.equal(null);
            expect(ticket.address).to.not.equal(undefined);
            expect(ticket.address).to.not.equal("");
        });
    });

    describe("Create NFTs", function () { 
        it("Buy NFT using Ticket contract", async function () { 
            const tokenId = 1
            const nftId = 1
            const qty = 1
            const guy = buyer.address
            // Buy a new NFT
            await ticket.connect(seller).buy(tokenId, nftId, qty, guy,{ value: nftPrice })
        });

        it("Split payment among payees (TEST ON MUMBAI NOT HERE)", async function () { 

            const PaymentSplitter = await ethers.getContractFactory("PaymentSplitter");
            const ticketAsPaymentSplitter = PaymentSplitter.attach(ticket.address);

            const tokenId = 1;
            const nftId = 1;
            const qty = 1;
            const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
            const initialSellerBalance = await ethers.provider.getBalance(seller.address);

            const guy = buyer.address

            // // console.log('Initial Owner Balance',initialOwnerBalance)
            // // console.log('Initial Seller Balance',initialSellerBalance)

            // // Buy a new NFT
            await ticket.connect(buyer).buy(tokenId, nftId, qty, guy,{ value: nftPrice });

            // To test this use mumbai testnet, not hrdhat
            // ticket.release(owner.address)
            // ticket.connect(seller).release(seller.address)
        });
        
        it("Get Purchased Token Uri", async function () { 
            const tokenId = 1;
            const nftId = 1;
            const qty = 1;
            const guy = buyer.address
            // // Buy a new NFT
            await ticket.connect(buyer).buy(tokenId, nftId, qty, guy, { value: nftPrice });
            const uri = await ticket.uri(tokenId)
            // console.log(uri)
        });

        it("Verify ownership of NFT", async function () { 
            const nftId = 1;
            const qty = 1;
            const ticketId = 1;
            const guy = owner.address
            await ticket.buy(ticketId, nftId, qty, guy,{value: nftPrice});
            const hasAccess = await ticket.hasAccess(ticketId, owner.address);
            expect(hasAccess).to.equal(true);
        });

        it("Two Users Buy NFT", async function () { 
            const nftId = 1;
            const qty = 1;
            const ticketId = 1;
            const guy = buyer.address
            const guy2 = buyer2.address

            // Buy a new NFT Addr2
            await ticket.connect(buyer).buy(ticketId, nftId, qty, guy, { value: nftPrice });
            await ticket.connect(buyer2).buy(ticketId, nftId, qty, guy2, { value: nftPrice });

            // Verify that buyer now owns the NFT
            const buyer1Access = await ticket.hasAccess(ticketId, buyer.address);
            expect(buyer1Access).to.equal(true);

            const buyer2Access = await ticket.hasAccess(ticketId, buyer2.address);
            expect(buyer2Access).to.equal(true);
        });

        it("Transfer ownership of NFT from addr2 to addr3", async function () {

            const ticketId = 1;
            const nftId = 1;
            const qty = 1;
            const amount = 1;
            const guy = buyer.address

            // Buy a new NFT
            await ticket.connect(buyer).buy(ticketId, nftId, qty, guy, { value: nftPrice });

            // Verify that buyer (BUYER) now owns the NFT
            const buyer1Access = await ticket.hasAccess(ticketId, buyer.address);
            expect(buyer1Access).to.equal(true);

            let balance = await ticket.balanceOf(buyer.address, ticketId);
            expect(balance).to.equal(1);
            
            // Transfer ownership of NFT from addr2 to addr3
            await ticket.connect(buyer).safeTransferFrom(buyer.address, buyer2.address, nftId, amount, "0x");
            
            let buyerFinalbalance = await ticket.balanceOf(buyer.address, ticketId);
            expect(buyerFinalbalance).to.equal(0);
            
            let buyer2Balance = await ticket.balanceOf(buyer2.address, ticketId);
            expect(buyer2Balance).to.equal(1);
        });

    });
});