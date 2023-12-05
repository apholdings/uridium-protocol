const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Uridium Token Tests", function () {
    let Uridium;
    let uridium;
    let owner, user, user2, user3;

    beforeEach(async function () {
        [owner, user, user2, user3] = await ethers.getSigners();

        // Deploy Uridium Contract
        Uridium = await ethers.getContractFactory("Uridium");
        uridium = await Uridium.deploy();
        await uridium.deployed();

        
    });

    describe("Deployment", function () {
        it("Deploy Uridium contract", async function () {
            expect(uridium.address).to.not.equal(0x0);
            expect(uridium.address).to.not.equal(null);
            expect(uridium.address).to.not.equal(undefined);
            expect(uridium.address).to.not.equal("");
        });

        it("Should retrieve the initial supply", async () => {
            const totalSupply = await uridium.totalSupply();
            expect(totalSupply).to.equal(0);
        });
    });

    describe("Pausable", function () {
        it("Should pause the contract", async () => {
            // Attempt to pause the contract as the owner
            await uridium.connect(owner).stop();

            // Verify that the contract is paused
            expect(await uridium.paused()).to.equal(true);
        });

        it("Should unpause the contract", async () => {
            // Pause the contract first
            await uridium.connect(owner).stop();

            // Attempt to unpause the contract as the owner
            await uridium.connect(owner).start();

            // Verify that the contract is unpaused
            expect(await uridium.paused()).to.equal(false);
        });    
    });

    describe("Mint and Burn", function () {
        it("Should mint tokens to an address", async () => {
            const initialUserBalance = await uridium.balanceOf(user.address);
            await uridium.mint(user.address, 100);
            const finalUserBalance = await uridium.balanceOf(user.address);
            expect(finalUserBalance).to.equal(initialUserBalance.add(100));
        });

        it("Should burn tokens from the sender's balance", async () => {

            await uridium.mint(user.address, ethers.utils.parseEther("100"));

            const initialOwnerBalance = await uridium.balanceOf(user.address);
            const burnAmount = ethers.utils.parseEther("50"); // Burn 50 tokens
            await uridium.connect(user).burn(burnAmount);

            const finalOwnerBalance = await uridium.balanceOf(user.address);
            expect(finalOwnerBalance).to.equal(initialOwnerBalance.sub(burnAmount));
        });
    });

    describe("Push / Pull / Move", function () {

        

        it("Should push tokens to an address", async () => {

            await uridium.mint(user.address, ethers.utils.parseEther("1000"));
            await uridium.mint(owner.address, ethers.utils.parseEther("1000"));
            
            const initialOwnerBalance = await uridium.balanceOf(owner.address);
            const initialuserBalance = await uridium.balanceOf(user.address);
            
            const pushAmount = ethers.utils.parseEther("50"); // Push 50 tokens to the user
            // Approve the transfer
            await uridium.connect(owner).approve(owner.address, pushAmount);
            // Perform the push
            await uridium.connect(owner).push(user.address, pushAmount);

            // Check the final balances
            const finalOwnerBalance = await uridium.balanceOf(owner.address);
            expect(finalOwnerBalance).to.equal(initialOwnerBalance.sub(pushAmount));
            
            const finaluserBalance = await uridium.balanceOf(user.address);
            expect(finaluserBalance).to.equal(initialuserBalance.add(pushAmount));
        });

        it("Should pull tokens from an address", async () => {

            await uridium.mint(user.address, ethers.utils.parseEther("1000"));
            await uridium.mint(owner.address, ethers.utils.parseEther("1000"));
            
            // Initial balances
            const initialOwnerBalance = await uridium.balanceOf(owner.address);
            const initialuserBalance = await uridium.balanceOf(user.address);
            // Define amounts
            const pullAmount = ethers.utils.parseEther("30"); // Push 50 tokens to the user
            // Approve the transfer
            await uridium.connect(user).approve(owner.address, pullAmount);
            // Perform the pull
            await uridium.connect(owner).pull(user.address, pullAmount);
            // Check the final balances
            const finalOwnerBalance = await uridium.balanceOf(owner.address);
            expect(finalOwnerBalance).to.equal(initialOwnerBalance.add(pullAmount));
            
            const finaluserBalance = await uridium.balanceOf(user.address);
            expect(finaluserBalance).to.equal(initialuserBalance.sub(pullAmount));
        });

        it("Should move tokens from one address to another", async () => {

            await uridium.mint(user.address, ethers.utils.parseEther("1000"));
            await uridium.mint(user2.address, ethers.utils.parseEther("1000"));
            // Initial balances
            const initialICOBalance = await uridium.balanceOf(user2.address);
            const initialuserBalance = await uridium.balanceOf(user.address);
            // Define amounts
            const moveAmount = ethers.utils.parseEther("30"); // Push 50 tokens to the user
            // Approve the transfer
            await uridium.connect(user2).approve(owner.address, moveAmount);
            // Perform the move
            await uridium.connect(owner).move(user2.address, user.address, moveAmount);
            // Check the final balances
            const finalICOBalance = await uridium.balanceOf(user2.address);
            expect(finalICOBalance).to.equal(initialICOBalance.sub(moveAmount));

            const finaluserBalance = await uridium.balanceOf(user.address);
            expect(finaluserBalance).to.equal(initialuserBalance.add(moveAmount));
            
        });
    });
});

describe("DSNote Tests", function () {
    // Write tests for the DSNote contract if necessary
});