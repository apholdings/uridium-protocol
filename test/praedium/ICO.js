const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("ICO for Praedium Contract Tests", function () { 
    let Token, praediumToken;

    let ICOContract;
    let maxIcoSupply = ethers.utils.parseEther("100557");
    let totalSupply = ethers.utils.parseEther("1005577");
    let initialSupply = ethers.utils.parseEther("724015");

    let owner, addr1, addr2, pauser, minter;

    beforeEach(async function () {
        [owner, addr1, addr2, pauser, minter] = await ethers.getSigners();
        // Deploy Praedium token
        Token = await ethers.getContractFactory("Token");
        praediumToken = await Token.deploy(initialSupply,totalSupply);
        await praediumToken.deployed();
        await praediumToken.grantRole(await praediumToken.PAUSER_ROLE(), owner.address);
        await praediumToken.grantRole(await praediumToken.MINTER_ROLE(), owner.address);
        // Deploy ICO Contract
        ICOContract = await ethers.getContractFactory("ICO");
        ico = await ICOContract.deploy(praediumToken.address, maxIcoSupply);
        await ico.grantRole(await ico.PAUSER_ROLE(), owner.address);
        await ico.grantRole(await ico.MINTER_ROLE(), owner.address);

        // Send PDM tokens to ICO contract for distribution
        await praediumToken.mint(praediumToken.address, initialSupply);
        await praediumToken.mint(ico.address, maxIcoSupply);
    });

    describe("Deployment", function () {
        it("Deploy PDM contract", async function () {
            expect(await praediumToken.name()).to.equal("Praedium");
            expect(await praediumToken.symbol()).to.equal("PDM");
        });

        it("Deploy ICO contract", async function () {
            expect(ico.address).to.not.equal(0x0);
            expect(ico.address).to.not.equal(null);
            expect(ico.address).to.not.equal(undefined);
            expect(ico.address).to.not.equal("");
        });
        
        it("Verify ICO contract PDM balance is Equal to Max ICO Supply", async function () {
            const icoPDMBalance = await praediumToken.balanceOf(ico.address);
            expect(icoPDMBalance).to.equal(maxIcoSupply);
        });
    });

    describe("Ownership", function () {
        it("Set the right owner", async function () {
            expect(await ico.hasRole(await ico.DEFAULT_ADMIN_ROLE(), owner.address)).to.equal(true);
        });

        it("Grant the pauser role to the pauser", async function () {
            expect(await ico.hasRole(await ico.PAUSER_ROLE(), owner.address)).to.equal(true);
        });

        it("Grant the minter role to the minter", async function () {
            expect(await ico.hasRole(await ico.MINTER_ROLE(), owner.address)).to.equal(true);
        });
    });

    describe("AccessControl", function () {
        it("Should allow the owner to grant roles", async function () {
            const [owner, addr1, addr2] = await ethers.getSigners();
            await ico.connect(owner).grantRole(await ico.PAUSER_ROLE(), addr1.address);
            expect(await ico.hasRole(await ico.PAUSER_ROLE(), addr1.address)).to.equal(true);
        });

        it("Should allow the owner to revoke roles", async function () {
            const [owner, addr1, addr2] = await ethers.getSigners();
            await ico.connect(owner).grantRole(await ico.PAUSER_ROLE(), addr1.address);
            await ico.connect(owner).revokeRole(await ico.PAUSER_ROLE(), addr1.address);
            expect(await ico.hasRole(await ico.PAUSER_ROLE(), addr1.address)).to.equal(false);
        });
        
        it("Should not allow the non owner to grant roles", async function () {
            await expect(
                ico.connect(addr1).grantRole(
                await ico.PAUSER_ROLE(), 
                addr2.address
                )
            ).to.be.revertedWith(
                /^AccessControl: account (0x[0-9a-f]{40}) is missing role (0x[0-9a-f]{64})$/
            );
            
            expect(await ico.hasRole(await ico.PAUSER_ROLE(), addr2.address)).to.equal(false);
        });

        it("Should not allow non-owners to revoke roles", async function () {
            const [owner, addr1, addr2] = await ethers.getSigners();
            await ico.connect(owner).grantRole(await ico.PAUSER_ROLE(), addr1.address);
            await expect(
                ico.connect(addr2).revokeRole(
                await ico.PAUSER_ROLE(),
                addr1.address
                )
            ).to.be.revertedWith(
                /^AccessControl: account (0x[0-9a-f]{40}) is missing role (0x[0-9a-f]{64})$/
            );
            expect(await ico.hasRole(await ico.PAUSER_ROLE(), addr1.address)).to.equal(true);
        });
    });

    describe("Buy Tokens", function () { 
        it("Should buy tokens successfully during ICO period", async function () {
            // Set ICO period
            const now = Math.floor(Date.now() / 1000);
            await ico.setICOTime(now - 10000, now + 10000);
            
            const initialInvestorCount = await ico.totalInvestors();
            const initialInvestment = await ico.totalInvestment();
            const exchangeRate = await ico.tokenExchangeRate();

            let investmentAmount = ethers.utils.parseEther("0.1"); // 0.1 ETH
            const tokensToBuy = investmentAmount.mul(exchangeRate);

            const investor = addr1.address // Investor buying Token

            // Add Investor to Whitelist
            await ico.addToWhitelist(investor);

            // Investor1 Buys tokens
            const initialInvestorBalance = await praediumToken.balanceOf(investor);
            expect(initialInvestorBalance).to.equal(0);

            await ico.connect(addr1).buyTokens({ value: investmentAmount });

            // Verify tokens are transferred to investor
            const investorBalance = await praediumToken.balanceOf(investor);
            expect(investorBalance).to.equal(tokensToBuy);
            
            // // Verify total investment and investors have been updated
            const finalInvestorCount = await ico.totalInvestors();
            const finalInvestment = await ico.totalInvestment();
            expect(finalInvestorCount).to.equal(initialInvestorCount.toNumber() + 1);
            expect(finalInvestment).to.equal(initialInvestment + investmentAmount);
        });

        it("Should revert when buying tokens outside of ICO period", async function () {
            // Set ICO period to future time
            // Set ICO period
            const now = Math.floor(Date.now() + 1000);
            await ico.setICOTime(now - 10000, now + 20000);

            // Attempt to buy tokens
            await expect(
            ico.buyTokens({ value: 1 })
            ).to.be.revertedWith("ICO is not active.");
        });

        it("Should revert when the ICO token cap is reached", async function () {
            // Set ICO period
            const now = Math.floor(Date.now() / 1000);
            await ico.setICOTime(now - 10000, now + 10000);

            const maxIcoSupply = await praediumToken.balanceOf(ico.address);
            const exchangeRate = await ico.tokenExchangeRate();

            // Calculate the maximum amount of ETH that can be invested without reaching the ICO token cap
            const maxInvestment = maxIcoSupply.div(exchangeRate);

            // Investor tries to invest more than the maximum amount
            const investmentAmount = maxInvestment.add(ethers.utils.parseEther("1000"));

            // Add investor to whitelist
            await ico.addToWhitelist(addr1.address);

            // Investor tries to buy tokens with an amount that exceeds the maximum investment amount
            await expect(
                ico.connect(addr1).buyTokens({ value: investmentAmount })
            ).to.be.revertedWith("Maximum ICO token cap reached");
        });
    });

    describe("Add / Remove Investor", function () {
        it("Should add investor role", async function () {
            // Set ICO period
            const now = Math.floor(Date.now() / 1000);
            await ico.setICOTime(now - 10000, now + 10000);
            let investmentAmount = ethers.utils.parseEther('0.1'); // Invest 1 ETH
            const investor = addr1.address // Investor buying Token
            // Add Investor to Whitelist
            await ico.addToWhitelist(investor);
            // Investor1 Buys tokens
            const initialInvestorBalance = await praediumToken.balanceOf(investor);
            expect(initialInvestorBalance).to.equal(0);

            await ico.connect(addr1).buyTokens({ value: investmentAmount });
            // Check if investor exists and has INVESTOR_ROLE
            expect(await ico.hasRole(await ico.INVESTOR_ROLE(), investor)).to.equal(true);
        });

        it("Should remove investor role", async function () {
            // Set ICO period
            const now = Math.floor(Date.now() / 1000);
            await ico.setICOTime(now - 10000, now + 10000);
            let investmentAmount = ethers.utils.parseEther('0.1'); // Invest 1 ETH
            const investor = addr1.address // Investor buying Token
            // Add Investor to Whitelist
            await ico.addToWhitelist(investor);
            // Investor1 Buys tokens
            const initialInvestorBalance = await praediumToken.balanceOf(investor);
            expect(initialInvestorBalance).to.equal(0);

            await ico.connect(addr1).buyTokens({ value: investmentAmount });
            // Check if investor exists and has INVESTOR_ROLE
            expect(await ico.hasRole(await ico.INVESTOR_ROLE(), investor)).to.equal(true);

            // Remove investor and check if they no longer have INVESTOR_ROLE
            await ico.removeInvestor(investor);
            expect(await ico.hasRole(await ico.INVESTOR_ROLE(), investor)).to.equal(false);
        });
    });

    describe("Set ICO Time", function () {
        it("Should update the ICO time correctly", async function () {
            const now = Math.floor(Date.now() / 1000);
            const startTime = now + 86400; // Start time in 24 hours from now
            const endTime = now + 14 * 86400; // End time in 2 weeks from now

            // Set the ICO time
            await ico.setICOTime(startTime, endTime);

            // Check if the ICO time was set correctly
            const actualStartTime = await ico.startTime();
            const actualEndTime = await ico.endTime();

            expect(actualStartTime).to.equal(startTime);
            expect(actualEndTime).to.equal(endTime);
        });
    });
    
    describe("Update Exchange Rate", function () {
        it("Should update the exchange rate successfully", async function () {
            const newExchangeRate = 200;
            await ico.editExchangeRate(newExchangeRate);
            const updatedExchangeRate = await ico.tokenExchangeRate();
            expect(updatedExchangeRate).to.equal(newExchangeRate);
        });
    });
});