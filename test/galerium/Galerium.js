const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("Galerium Contract Tests", function () {
    let Token;
    let MaliciousContract;
    let malicious;
    let galerium;
    let owner;
    let addr1;
    let addr2;

    beforeEach(async function () {
        Token = await ethers.getContractFactory("Galerium");
        galerium = await Token.deploy();
        await galerium.deployed();
        
        [owner, addr1, addr2] = await ethers.getSigners();
        [owner, pauser, minter] = await ethers.getSigners();
        
        await galerium.grantRole(await galerium.PAUSER_ROLE(), owner.address);
        await galerium.grantRole(await galerium.MINTER_ROLE(), owner.address);
        
        MaliciousContract = await ethers.getContractFactory("MCT");
        malicious = await MaliciousContract.deploy(galerium.address);
        // Approve the malicious contract to transfer 100 tokens
        await galerium.approve(malicious.address, 100);

        // Mint GALR and send some to ADress1
        await galerium.mint(galerium.address, 1000)
        await galerium.mint(addr1.address, 1000)
    });

    describe("Deployment", function () {
        it("should return the correct name", async function () {
          expect(await galerium.name()).to.equal("Galerium");
        });
      
        it("should return the correct symbol", async function () {
          expect(await galerium.symbol()).to.equal("GALR");
        });
    });

    describe("Ownership", function () {
        it("Should set the right owner", async function () {
            expect(await galerium.hasRole(await galerium.DEFAULT_ADMIN_ROLE(), owner.address)).to.equal(true);
        });

        it("Should grant the pauser role to the pauser", async function () {
            expect(await galerium.hasRole(await galerium.PAUSER_ROLE(), owner.address)).to.equal(true);
        });

        it("Should grant the minter role to the minter", async function () {
            expect(await galerium.hasRole(await galerium.MINTER_ROLE(), owner.address)).to.equal(true);
        });
    });

    describe("AccessControl", function () {
        it("Should allow the owner to grant roles", async function () {
            const [owner, addr1, addr2] = await ethers.getSigners();
            await galerium.connect(owner).grantRole(await galerium.PAUSER_ROLE(), addr1.address);
            expect(await galerium.hasRole(await galerium.PAUSER_ROLE(), addr1.address)).to.equal(true);
        });

        it("Should allow the owner to revoke roles", async function () {
            const [owner, addr1, addr2] = await ethers.getSigners();
            await galerium.connect(owner).grantRole(await galerium.PAUSER_ROLE(), addr1.address);
            await galerium.connect(owner).revokeRole(await galerium.PAUSER_ROLE(), addr1.address);
            expect(await galerium.hasRole(await galerium.PAUSER_ROLE(), addr1.address)).to.equal(false);
        });
        
        it("Should not allow the non owner to grant roles", async function () {
            await expect(
                galerium.connect(addr1).grantRole(
                await galerium.PAUSER_ROLE(), 
                addr2.address
                )
            ).to.be.revertedWith(
                /^AccessControl: account (0x[0-9a-f]{40}) is missing role (0x[0-9a-f]{64})$/
            );
            
            expect(await galerium.hasRole(await galerium.PAUSER_ROLE(), addr2.address)).to.equal(false);
        });

        it("Should not allow non-owners to revoke roles", async function () {
            const [owner, addr1, addr2] = await ethers.getSigners();
            await galerium.connect(owner).grantRole(await galerium.PAUSER_ROLE(), addr1.address);
            await expect(
                galerium.connect(addr2).revokeRole(
                await galerium.PAUSER_ROLE(),
                addr1.address
                )
            ).to.be.revertedWith(
                /^AccessControl: account (0x[0-9a-f]{40}) is missing role (0x[0-9a-f]{64})$/
            );
            expect(await galerium.hasRole(await galerium.PAUSER_ROLE(), addr1.address)).to.equal(true);
        });
    });

    describe("Transactions", function () { 
        it("Should transfer tokens between accounts", async function () {
            // Get Address1 Initial Balance
            const addr1InitialBalance = await galerium.balanceOf(addr1.address);
            expect(addr1InitialBalance).to.equal(1000);
            
            // // Transfer 50 tokens from addr1 to addr2
            await galerium.connect(addr1).transfer(addr2.address,100 );
            const addr2Balance = await galerium.balanceOf(addr2.address);
            expect(addr2Balance).to.equal(100);
        });

        it("Should fail if sender doesn't have enough tokens", async function () {
            const initialAddr1Balance = await galerium.balanceOf(addr1.address);
            // Try to send 1 token from addr1 (0 tokens) to addr1 (1000 tokens).
            // 'require' will evaluate false and revert the transaction.
            await expect(
                galerium.connect(owner).transfer(addr1.address, 1)
            ).to.be.revertedWith("ERC20: transfer amount exceeds balance");

            // addr1 balance should not change.
            expect(await galerium.balanceOf(addr1.address)).to.equal(initialAddr1Balance);
        });
    });

    describe("Minting and Burning", function () { 
        it("Should allow a minter to mint tokens", async function () {
            // Mint 100 tokens to addr1
            await galerium.mint(addr2.address, 100);

            // Check addr1's balance
            const addr2Balance = await galerium.balanceOf(addr2.address);
            expect(addr2Balance).to.equal(100);
        });
    });
 });