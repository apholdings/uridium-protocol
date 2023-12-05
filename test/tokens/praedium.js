const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Praedium Token Tests", function () { 
    let Praedium, praedium;
    let owner, investor, uridiumFoundation, icoAddress;

    const initialSupply = ethers.utils.parseEther("1005577");
    const earlyInvestorsAllocation = initialSupply.mul(8).div(100);
    const uridiumFoundationAllocation = initialSupply.mul(10).div(100);
    const publicIcoAllocation = initialSupply.mul(10).div(100);
    const praediumAllocation = initialSupply.mul(72).div(100);

    beforeEach(async function () {
        [owner, investor, uridiumFoundation, icoAddress] = await ethers.getSigners();

        // Deploy Praedium Contract
        Praedium = await ethers.getContractFactory("Token");
        praedium = await Praedium.deploy(initialSupply);
        await praedium.deployed();

        // Mint tokens for various allocations
        await praedium.mint(investor.address, earlyInvestorsAllocation);
        await praedium.mint(uridiumFoundation.address, uridiumFoundationAllocation);
        await praedium.mint(icoAddress.address, publicIcoAllocation);
        await praedium.mint(owner.address, praediumAllocation);
    });

    describe("Deployment", function () {
        it("Deploy Praedium contract", async function () {
            expect(praedium.address).to.not.equal(0x0);
            expect(praedium.address).to.not.equal(null);
            expect(praedium.address).to.not.equal(undefined);
            expect(praedium.address).to.not.equal("");
        });

         it("Should retrieve the Max Supply", async () => {
            const maxSupply = await praedium.maxSupply();
             const maxSupplyInEther = ethers.utils.formatEther(maxSupply);
            // console.log('Max supply in ether:', maxSupplyInEther);
        });

        it("Should allocate to early investors, advisors, and the founding team", async () => {
            const balance = await praedium.balanceOf(investor.address);
            expect(balance).to.equal(earlyInvestorsAllocation);
        });

        it("Should allocate to the Uridium Foundation", async () => {
            const balance = await praedium.balanceOf(uridiumFoundation.address); // Replace with the address of the Uridium Foundation
            expect(balance).to.equal(uridiumFoundationAllocation);
        });

        it("Should allocate to the public ICO", async () => {
            const balance = await praedium.balanceOf(icoAddress.address); // Replace with the address of the ICO allocation
            expect(balance).to.equal(publicIcoAllocation);
        });

        it("Should allocate to the Praedium contract", async () => {
            const balance = await praedium.balanceOf(owner.address); // Replace with the address of the Praedium contract
            expect(balance).to.equal(praediumAllocation);
        });
    });
    
    describe("Pausable", function () {
        it("Should pause the contract", async () => {
            // Attempt to pause the contract as the owner
            await praedium.connect(owner).stop();

            // Verify that the contract is paused
            expect(await praedium.paused()).to.equal(true);
        });

        it("Should unpause the contract", async () => {
            // Pause the contract first
            await praedium.connect(owner).stop();

            // Attempt to unpause the contract as the owner
            await praedium.connect(owner).start();

            // Verify that the contract is unpaused
            expect(await praedium.paused()).to.equal(false);
        });    
    });
    describe("Transactions", function () {
    it("Should fail if sender doesn't have enough tokens", async () => {
            // Attempt to transfer more tokens than the sender's balance
            const initialOwnerBalance = await praedium.balanceOf(owner.address);
            const transferAmount = initialOwnerBalance.add(ethers.utils.parseEther("1"));
            await expect(praedium.transfer(investor.address, transferAmount)).to.be.revertedWith("ERC20: transfer amount exceeds balance");
        });
        
        it("Should update balances after transfers", async () => {
            // Transfer tokens from investor to icoAddress
            const previousIcoAddressBalance = await praedium.balanceOf(icoAddress.address);
            await praedium.connect(investor).transfer(icoAddress.address, ethers.utils.parseEther("2"));
            const icoAddressBalance = await praedium.balanceOf(icoAddress.address);

            // Check balances
            expect(icoAddressBalance).to.equal(previousIcoAddressBalance.add(ethers.utils.parseEther("2")));
        });
        
        it("Should transfer from PDM contract to investor", async () => {
            // Transfer tokens from PDM contract to investor
            const previousInvestorAddressBalance = await praedium.balanceOf(investor.address);
            await praedium.connect(owner).transfer(investor.address, ethers.utils.parseEther("2")); // Assuming 2 tokens should be transferred
            const investorAddressBalance = await praedium.balanceOf(investor.address);

            // Check balances
            expect(investorAddressBalance).to.equal(previousInvestorAddressBalance.add(ethers.utils.parseEther("2")));
        });
    });
    describe("Allowance", function () {
        it("Should approve token transfer", async () => {
            const initialAllowance = await praedium.allowance(owner.address, investor.address);
            const amountToApprove = ethers.utils.parseEther("100"); // Approve 100 tokens
            await praedium.connect(owner).approve(investor.address, amountToApprove);

            const updatedAllowance = await praedium.allowance(owner.address, investor.address);
            expect(updatedAllowance).to.equal(amountToApprove);
        });
    });
    describe("Mint and Burn", function () {
        it("Should burn tokens from the sender's balance", async () => {
            const initialOwnerBalance = await praedium.balanceOf(owner.address);
            const burnAmount = ethers.utils.parseEther("50"); // Burn 50 tokens
            await praedium.connect(owner).burn(burnAmount);

            const finalOwnerBalance = await praedium.balanceOf(owner.address);
            expect(finalOwnerBalance).to.equal(initialOwnerBalance.sub(burnAmount));
        });
    });
    describe("Push / Pull / Move", function () {
        it("Should push tokens to an address", async () => {
            const initialOwnerBalance = await praedium.balanceOf(owner.address);
            const initialInvestorBalance = await praedium.balanceOf(investor.address);
            
            const pushAmount = ethers.utils.parseEther("50"); // Push 50 tokens to the user
            // Approve the transfer
            await praedium.connect(owner).approve(owner.address, pushAmount);
            // Perform the push
            await praedium.connect(owner).push(investor.address, pushAmount);

            // Check the final balances
            const finalOwnerBalance = await praedium.balanceOf(owner.address);
            expect(finalOwnerBalance).to.equal(initialOwnerBalance.sub(pushAmount));
            
            const finalInvestorBalance = await praedium.balanceOf(investor.address);
            expect(finalInvestorBalance).to.equal(initialInvestorBalance.add(pushAmount));
        });

        it("Should pull tokens from an address", async () => {
            // Initial balances
            const initialOwnerBalance = await praedium.balanceOf(owner.address);
            const initialInvestorBalance = await praedium.balanceOf(investor.address);
            // Define amounts
            const pullAmount = ethers.utils.parseEther("30"); // Push 50 tokens to the user
            // Approve the transfer
            await praedium.connect(investor).approve(owner.address, pullAmount);
            // Perform the pull
            await praedium.connect(owner).pull(investor.address, pullAmount);
            // Check the final balances
            const finalOwnerBalance = await praedium.balanceOf(owner.address);
            expect(finalOwnerBalance).to.equal(initialOwnerBalance.add(pullAmount));
            
            const finalInvestorBalance = await praedium.balanceOf(investor.address);
            expect(finalInvestorBalance).to.equal(initialInvestorBalance.sub(pullAmount));
        });

        it("Should move tokens from one address to another", async () => {
            // Initial balances
            const initialICOBalance = await praedium.balanceOf(icoAddress.address);
            const initialInvestorBalance = await praedium.balanceOf(investor.address);
            // Define amounts
            const moveAmount = ethers.utils.parseEther("30"); // Push 50 tokens to the user
            // Approve the transfer
            await praedium.connect(icoAddress).approve(owner.address, moveAmount);
            // Perform the move
            await praedium.connect(owner).move(icoAddress.address, investor.address, moveAmount);
            // Check the final balances
            const finalICOBalance = await praedium.balanceOf(icoAddress.address);
            expect(finalICOBalance).to.equal(initialICOBalance.sub(moveAmount));

            const finalInvestorBalance = await praedium.balanceOf(investor.address);
            expect(finalInvestorBalance).to.equal(initialInvestorBalance.add(moveAmount));
            
        });
    });
})