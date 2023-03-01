const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PraediumToken Contract Tests", function () {
    let Token;
    let MaliciousContract;
    let malicious;
    let praediumToken;
    let owner;
    let addr1;
    let addr2;
    let initialSupply = 724015;
    let maxSupply = 1005577;

    beforeEach(async function () {
        [owner, addr1, addr2, pauser, minter] = await ethers.getSigners();

        Token = await ethers.getContractFactory("Token");
        praediumToken = await Token.deploy(initialSupply,maxSupply);
        await praediumToken.deployed();
        
        await praediumToken.grantRole(await praediumToken.PAUSER_ROLE(), owner.address);
        await praediumToken.grantRole(await praediumToken.MINTER_ROLE(), owner.address);
        
        // Mint GALR and send some to ADress1
        await praediumToken.mint(praediumToken.address, initialSupply)
        await praediumToken.mint(addr1.address, 1000)
        
        
        MaliciousContract = await ethers.getContractFactory("MCT");
        malicious = await MaliciousContract.deploy(praediumToken.address);
        
        // Approve the malicious contract to transfer 100 tokens
        await praediumToken.mint(malicious.address, 1000)
        await praediumToken.approve(malicious.address, 1000);
    });
  
    describe("Deployment", function () {
        it("should return the correct name", async function () {
          expect(await praediumToken.name()).to.equal("Praedium");
        });
      
        it("should return the correct symbol", async function () {
          expect(await praediumToken.symbol()).to.equal("PDM");
        });

        it("Should have InitialSupply of tokens", async function () {
          expect(await praediumToken.balanceOf(praediumToken.address)).to.equal(initialSupply);
        });
    });
  
    describe("Ownership", function () {
        it("Should set the right owner", async function () {
            expect(await praediumToken.hasRole(await praediumToken.DEFAULT_ADMIN_ROLE(), owner.address)).to.equal(true);
        });

        it("Should grant the pauser role to the pauser", async function () {
            expect(await praediumToken.hasRole(await praediumToken.PAUSER_ROLE(), owner.address)).to.equal(true);
        });

        it("Should grant the minter role to the minter", async function () {
            expect(await praediumToken.hasRole(await praediumToken.MINTER_ROLE(), owner.address)).to.equal(true);
        });
    });

    describe("AccessControl", function () {
        it("Should allow the owner to grant roles", async function () {
            const [owner, addr1, addr2] = await ethers.getSigners();
            await praediumToken.connect(owner).grantRole(await praediumToken.PAUSER_ROLE(), addr1.address);
            expect(await praediumToken.hasRole(await praediumToken.PAUSER_ROLE(), addr1.address)).to.equal(true);
        });

        it("Should allow the owner to revoke roles", async function () {
            const [owner, addr1, addr2] = await ethers.getSigners();
            await praediumToken.connect(owner).grantRole(await praediumToken.PAUSER_ROLE(), addr1.address);
            await praediumToken.connect(owner).revokeRole(await praediumToken.PAUSER_ROLE(), addr1.address);
            expect(await praediumToken.hasRole(await praediumToken.PAUSER_ROLE(), addr1.address)).to.equal(false);
        });
        
        it("Should not allow the non owner to grant roles", async function () {
            await expect(
                praediumToken.connect(addr1).grantRole(
                await praediumToken.PAUSER_ROLE(), 
                addr2.address
                )
            ).to.be.revertedWith(
                /^AccessControl: account (0x[0-9a-f]{40}) is missing role (0x[0-9a-f]{64})$/
            );
            
            expect(await praediumToken.hasRole(await praediumToken.PAUSER_ROLE(), addr2.address)).to.equal(false);
        });

        it("Should not allow non-owners to revoke roles", async function () {
            const [owner, addr1, addr2] = await ethers.getSigners();
            await praediumToken.connect(owner).grantRole(await praediumToken.PAUSER_ROLE(), addr1.address);
            await expect(
                praediumToken.connect(addr2).revokeRole(
                await praediumToken.PAUSER_ROLE(),
                addr1.address
                )
            ).to.be.revertedWith(
                /^AccessControl: account (0x[0-9a-f]{40}) is missing role (0x[0-9a-f]{64})$/
            );
            expect(await praediumToken.hasRole(await praediumToken.PAUSER_ROLE(), addr1.address)).to.equal(true);
        });
    });

    describe("MaxSupply", function () {
        it("should have a max supply of 1005577 tokens", async function () {
            const maxSupply = await praediumToken.maxSupply();
            expect(maxSupply.toString()).to.equal(maxSupply);
        });

        it("Should fail if minting more than max supply", async function () {
            const maxSupply = await praediumToken.maxSupply();
            const initialSupply = await praediumToken.totalSupply();
            const amount = maxSupply.sub(initialSupply);

            // Try to mint more tokens than the max supply
            await expect(
                praediumToken.mint(owner.address, amount.add(1))
            ).to.be.revertedWith("Exceeds max supply");

            // Total supply should not have changed
            expect(await praediumToken.totalSupply()).to.equal(initialSupply);
        });

        it("Should prevent transferring tokens to the zero address after max supply is reached", async function () {            
            // Try to transfer 1 token to the zero address
            await expect(
                praediumToken.transfer("0x0000000000000000000000000000000000000000", 1)
            ).to.be.revertedWith("ERC20: transfer to the zero address");
        });
    });

    describe("Transactions", function () {
        it("Should transfer tokens between accounts", async function () {
            // Get Address1 Initial Balance
            const addr1InitialBalance = await praediumToken.balanceOf(addr1.address);
            expect(addr1InitialBalance).to.equal(1000);
            
            // // Transfer 50 tokens from addr1 to addr2
            await praediumToken.connect(addr1).transfer(addr2.address,100 );
            const addr2Balance = await praediumToken.balanceOf(addr2.address);
            expect(addr2Balance).to.equal(100);
        });
        it("Should fail if sender doesn't have enough tokens", async function () {
            const initialAddr1Balance = await praediumToken.balanceOf(addr1.address);
            // Try to send 1 token from addr1 (0 tokens) to addr1 (1000 tokens).
            // 'require' will evaluate false and revert the transaction.
            await expect(
                praediumToken.connect(owner).transfer(addr1.address, 1)
            ).to.be.revertedWith("ERC20: transfer amount exceeds balance");

            // addr1 balance should not change.
            expect(await praediumToken.balanceOf(addr1.address)).to.equal(initialAddr1Balance);
        });

        it("Should update balances after transfers", async function () {
            const initialOwnerBalance = await praediumToken.balanceOf(owner.address);

            // Transfer 100 tokens from PDM to addr1
            await praediumToken.connect(addr1).transfer(owner.address, 100);
            
            // Transfer 50 tokens from owner to addr2
            await praediumToken.connect(owner).transfer(addr2.address, 50);

            // // Check balances
            const finalOwnerBalance = await praediumToken.balanceOf(owner.address);
            expect(finalOwnerBalance).to.equal(initialOwnerBalance.add(50));

            const addr1Balance = await praediumToken.balanceOf(addr1.address);
            expect(addr1Balance).to.equal(900);

            const addr2Balance = await praediumToken.balanceOf(addr2.address);
            expect(addr2Balance).to.equal(50);
        });
    });
});