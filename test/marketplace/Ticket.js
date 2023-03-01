const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Ticket ERC1155 Test Methods", function () { 
    let Ticket, ticket;
    const nftPrice = ethers.utils.parseEther("0.01");

    beforeEach(async function () {
        [owner, addr1, addr2, addr3, pauser, minter] = await ethers.getSigners();

        // Deploy Ticket Contract
        Ticket = await ethers.getContractFactory("Ticket");
        ticket = await Ticket.deploy(nftPrice,[owner.address,addr1.address],[10,90]); // Payees, Shares
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
            // Buy a new NFT
            await ticket.connect(addr1).buy(0, 1, { value: nftPrice })
        });
        it("Verify that payment is split correctly among payees", async function () { 
            it("should split the payment between owner and addr1 correctly", async function () { 
                const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
                const initialCreatorBalance = await ethers.provider.getBalance(addr1.address);
                const initialBuyerBalance = await ethers.provider.getBalance(addr2.address);

                // Buy a new NFT
                await ticket.connect(addr2).buy(0, 1, { value: nftPrice });

                const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
                const finalCreatorBalance = await ethers.provider.getBalance(addr1.address);
                const finalBuyerBalance = await ethers.provider.getBalance(addr2.address);

                // Check that the payment was split correctly
                expect(finalOwnerBalance.sub(initialOwnerBalance)).to.equal(nftPrice.div(10));
                expect(finalCreatorBalance.sub(initialCreatorBalance)).to.equal(nftPrice.mul(9).div(10));
                expect(finalBuyerBalance.sub(initialBuyerBalance)).to.be.below(nftPrice);
            });
        });
        it("Verify Ownership of NFT", async function () { 
            // Buy a new NFT
            await ticket.connect(addr2).buy(0, 1, { value: nftPrice });

            // Verify that buyer now owns the NFT
            const balance = await ticket.balanceOf(addr2.address, 0);
            expect(balance).to.equal(1);
        });
        it("Two Users Buy NFT", async function () { 
            // Buy a new NFT Addr2
            await ticket.connect(addr2).buy(0, 1, { value: nftPrice });
            await ticket.connect(addr3).buy(0, 1, { value: nftPrice });

            // Verify that buyer now owns the NFT
            const addr2balance = await ticket.balanceOf(addr2.address, 0);
            expect(addr2balance).to.equal(1);
            const addr3balance = await ticket.balanceOf(addr3.address, 0);
            expect(addr3balance).to.equal(1);
        });
        it("should transfer ownership of NFT from addr2 to addr3", async function () {
            // Buy a new NFT
            await ticket.connect(addr2).buy(0, 1, { value: nftPrice });

            // Verify that buyer (addr2) now owns the NFT
            let balance = await ticket.balanceOf(addr2.address, 0);
            expect(balance).to.equal(1);

            // Transfer ownership of NFT from addr2 to addr3
            await ticket.connect(addr2).safeTransferFrom(addr2.address, addr3.address, 0, 1, "0x");

            // Verify that addr3 now owns the NFT
            balance = await ticket.balanceOf(addr3.address, 0);
            expect(balance).to.equal(1);

            // Verify that addr2 no longer owns the NFT
            balance = await ticket.balanceOf(addr2.address, 0);
            expect(balance).to.equal(0);
        });
    });
});