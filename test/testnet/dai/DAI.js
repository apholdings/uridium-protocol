const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DAI Stablecoin Tests", function () {
  let DAI, dai;
  let owner, seller, buyer;

  beforeEach(async function () {
    [owner, seller, buyer] = await ethers.getSigners();

    // Deploy DAI Contract
    DAI = await ethers.getContractFactory("DAI");
    dai = await DAI.deploy();
      await dai.deployed();
      
  });

  describe("Deployment", function () {
    it("Deploy DAI contract", async function () {
      expect(dai.address).to.not.equal(0x0);
      expect(dai.address).to.not.equal(null);
      expect(dai.address).to.not.equal(undefined);
      expect(dai.address).to.not.equal("");
    });
  });

    describe("Minting", function () {
            it("Should allow the owner to mint tokens", async function () {
                const initialSupply = await dai.totalSupply();
                await dai.mint(owner.address, ethers.utils.parseEther("1000"));
                const finalSupply = await dai.totalSupply();
                expect(finalSupply.sub(initialSupply)).to.equal(ethers.utils.parseEther("1000"));
            });

            it("Should not allow other accounts to mint tokens", async function () {
                const minterRole = await dai.MINTER_ROLE();
                await expect(dai.connect(seller).mint(seller.address, ethers.utils.parseEther("1000")))
                .to.be.revertedWith(`AccessControl: account ${seller.address.toLowerCase()} is missing role ${minterRole}`);
            });
    });
    
    describe("Pausing", function () {
        it("Should allow the owner to pause the contract", async function () {
            await dai.pause();
            expect(await dai.paused()).to.equal(true);
        });

        it("Should allow the owner to unpause the contract", async function () {
            await dai.pause();
            await dai.unpause();
            expect(await dai.paused()).to.equal(false);
        });

        it("Should not allow other accounts to pause the contract", async function () {
            const pauserRole = await dai.PAUSER_ROLE();
            await expect(dai.connect(seller).pause())
                .to.be.revertedWith(`AccessControl: account ${seller.address.toLowerCase()} is missing role ${pauserRole}`);
        });
    });

    describe("Transfers", function () {
        beforeEach(async function () {
            await dai.mint(seller.address, ethers.utils.parseEther("1000"));
        });

        it("Should allow transfers when not paused", async function () {
            await dai.connect(seller).transfer(buyer.address, ethers.utils.parseEther("100"));
            const buyerBalance = await dai.balanceOf(buyer.address);
            expect(buyerBalance).to.equal(ethers.utils.parseEther("100"));
        });

        it("Should not allow transfers when paused", async function () {
            await dai.pause();
            await expect(dai.connect(seller).transfer(buyer.address, ethers.utils.parseEther("100")))
            .to.be.revertedWith("Pausable: paused");
        });
    });
});