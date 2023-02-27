const { expect } = require("chai");
const { ethers } = require("hardhat");

const toWei = (num) => ethers.utils.parseEther(num.toString())
const fromWei = (num) => ethers.utils.formatEther(num)

describe("Ticketing Booth Tests", function () { 
    let Ticket, ticket, Booth, booth;
    const nftPrice = ethers.utils.parseEther("0.01");
    let feePercent = ethers.utils.parseEther("0.0001");


    beforeEach(async function () {
        [owner, addr1, addr2, addr3, pauser, minter] = await ethers.getSigners();

        // Deploy Ticket Contract
        Ticket = await ethers.getContractFactory("Ticket");
        ticket = await Ticket.deploy(nftPrice,[owner.address,addr1.address],[10,90]); // Payees, Shares
        await ticket.deployed();

        await ticket.grantRole(await ticket.PAUSER_ROLE(), owner.address);
        await ticket.grantRole(await ticket.MINTER_ROLE(), owner.address);

        Booth = await ethers.getContractFactory("Booth");
        booth = await Booth.deploy(feePercent);
    });

    describe("Deployment", function () {

        it("Deploy Ticket contract", async function () {
            expect(ticket.address).to.not.equal(0x0);
            expect(ticket.address).to.not.equal(null);
            expect(ticket.address).to.not.equal(undefined);
            expect(ticket.address).to.not.equal("");
        });

        it("Deploy Booth contract", async function () {
            expect(booth.address).to.not.equal(0x0);
            expect(booth.address).to.not.equal(null);
            expect(booth.address).to.not.equal(undefined);
            expect(booth.address).to.not.equal("");
        });

        it("Should track feeAccount and feePercent of the marketplace", async function () {
            expect(await booth.feeAccount()).to.equal(owner.address);
            expect(await booth.feePercent()).to.equal(feePercent);
        });
    });

    describe("Minting NFTs", function () { 
        it("User1 Deploys NFT and User2 and User3 Buys NFT", async function () {
            // Buy a new NFT Addr2
            await ticket.connect(addr2).buy(0, 1, { value: nftPrice });
            await ticket.connect(addr3).buy(0, 1, { value: nftPrice });

            // Verify that buyer now owns the NFT
            const addr2balance = await ticket.balanceOf(addr2.address, 0);
            expect(addr2balance).to.equal(1);
            const addr3balance = await ticket.balanceOf(addr3.address, 0);
            expect(addr3balance).to.equal(1);
        });
    });

    describe("Making marketplace items", function () { 
        beforeEach(async function () {
            // addr2 buys an nft
            await ticket.connect(addr2).buy(0, 1, { value: nftPrice });
            // addr1 approves marketplace to spend nft
            await ticket.connect(addr2).setApprovalForAll(booth.address, true)
        })

        it("Should track newly created item, transfer NFT from seller to marketplace and emit Offered event", async function () {
            // Verify that buyer owns the NFT
            const addr2balance = await ticket.balanceOf(addr2.address, 0);
            expect(addr2balance).to.equal(1);

            // Transfer ownership of NFT from addr2 to addr3
            const amount = 1;
            const tokenId = 0;
            const price = toWei(1);
            // await booth.connect(addr2).sell(ticket.address, tokenId, price, amount);

            // addr2 offers their nft at a price of 1 ether
            await expect(booth.connect(addr2).sell(ticket.address, tokenId, price, amount))
                .to.emit(booth, "Offered").withArgs(
                    1,
                    ticket.address,
                    tokenId,
                    price,
                    amount,
                    addr2.address
                )
            // Owner of NFT should now be the booth
            balance = await ticket.balanceOf(booth.address, tokenId);
            expect(balance).to.equal(1);

            // Item count should now equal 1
            expect(await booth.itemCount()).to.equal(1)

            // Get item from items mapping then check fields to ensure they are correct
            const item = await booth.items(1)
            expect(item.itemId).to.equal(1)
            expect(item.ticket).to.equal(ticket.address)
            expect(item.tokenId).to.equal(tokenId)
            expect(item.price).to.equal(price)
            expect(item.sold).to.equal(false)
        });

        it("Should fail if price is set to zero", async function () {

            const amount = 1;
            const tokenId = 0;
            const price = toWei(0);

            await expect(
                booth.connect(addr2).sell(ticket.address, tokenId, price, amount)
            ).to.be.revertedWith("Price must be greater than zero");
        });

    });
    describe("Purchasing marketplace items", function () { 
        const amount = 1;
        const tokenId = 0;
        let price = 0.1 * 1000000;
        let fee = (feePercent/100)*price
        let totalPriceInWei

        beforeEach(async function () {
            // addr2 buys an nft
            await ticket.connect(addr2).buy(0, 1, { value: nftPrice });
            // addr2 approves marketplace to spend nft
            await ticket.connect(addr2).setApprovalForAll(booth.address, true)
            // addr2 makes their nft a marketplace item.
            await booth.connect(addr2).sell(ticket.address, tokenId, price, amount)
        })

        it("Should update item as sold, pay seller, transfer NFT to buyer, charge fees and emit a Bought event", async function () { 
            const sellerInitalEthBal = await addr2.getBalance()
            const feeAccountInitialEthBal = await owner.getBalance()

            // Owner of NFT should now be the booth
            balance = await ticket.balanceOf(booth.address, tokenId);
            expect(balance).to.equal(1);

            // fetch items total price (market fees + item price)
            totalPriceInWei = await booth.getTotalPrice(1);

            await booth.connect(addr3).buy(1, { value: totalPriceInWei })
            
            // Item should be marked as sold
            expect((await booth.items(1)).sold).to.equal(true)

            // Owner of NFT should now be Addr3
            balance = await ticket.balanceOf(addr3.address, tokenId);
            expect(balance).to.equal(1);
            
            const sellerFinalEthBal = await addr2.getBalance()
            const feeAccountFinalEthBal = await owner.getBalance()

            // Seller should receive payment for the price of the NFT sold.
            expect(sellerFinalEthBal).to.be.above(sellerInitalEthBal)
            expect(feeAccountFinalEthBal).to.be.above(feeAccountInitialEthBal)
        });

        it("Should fail for invalid item ids, sold items and when not enough ether is paid", async function () {
            // fails for invalid item ids
            await expect(
                booth.connect(addr3).buy(2, {value: totalPriceInWei})
            ).to.be.revertedWith("item doesn't exist");
            await expect(
                booth.connect(addr3).buy(0, {value: totalPriceInWei})
            ).to.be.revertedWith("item doesn't exist");

            // Fails when not enough ether is paid with the transaction.
            // In this instance, fails when buyer only sends enough ether to cover the price of the nft
            // not the additional market fee.
            await expect(
                booth.connect(addr3).buy(1, {value: 100})
            ).to.be.revertedWith("not enough ether to cover item price and market fee"); 
            
            // addr3 purchases item 1
            await booth.connect(addr3).buy(1, {value: totalPriceInWei})
            // addr3 tries purchasing item 1 after its been sold 
            await expect(
                booth.connect(addr1).buy(1, {value: totalPriceInWei})
            ).to.be.revertedWith("item already sold");
        });
    });
});