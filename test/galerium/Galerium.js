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

 });