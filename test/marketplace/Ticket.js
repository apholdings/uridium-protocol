const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Ticket Tests", function () {
  let Ticket, ticket;
  let owner, seller, buyer, buyer2, royaltyReceiver;
  const nftPrice = ethers.utils.parseEther("0.01");
  const uri = "https://boomslag.com/api/courses/nft/";
  const royaltyPercentage = 500; // 5% represented in basis points (100 basis points = 1%)
  const initialStock = 30;
  const tokenId = 123;

  beforeEach(async function () {
    [owner, seller, buyer, buyer2, royaltyReceiver] = await ethers.getSigners();

    // Deploy Ticket Contract
    Ticket = await ethers.getContractFactory("Ticket");
    ticket = await Ticket.deploy(
      tokenId,
      nftPrice,
      initialStock,
      royaltyReceiver.address,
      royaltyPercentage,
      [owner.address, seller.address],
      [10, 90],
      uri
    );
    await ticket.deployed();
  });

  describe("Deployment", function () {
    it("Deploy Ticket contract", async function () {
      expect(ticket.address).to.not.equal(0x0);
      expect(ticket.address).to.not.equal(null);
      expect(ticket.address).to.not.equal(undefined);
      expect(ticket.address).to.not.equal("");
    });
  });

  it("Check max supply", async function () {
    expect(await ticket.stock(tokenId)).to.equal(initialStock);
  });

  it("Change price", async function () {
    const newPrice = ethers.utils.parseEther("0.02");
    await ticket.connect(owner).updatePrice(newPrice);
    expect(await ticket.price()).to.equal(newPrice);
  });

  it("Verify URI", async function () {
    const nftId = 1;
    const qty = 1;
    const guy = buyer.address
    
    await ticket.connect(buyer).mint(tokenId, nftId, qty, guy, { value: nftPrice });
    console.log('NFT Metadata URI: ',await ticket.uri(nftId))
    expect(await ticket.uri(nftId)).to.equal(uri + nftId + ".json");
  });

  it("Mint directly using the ticket", async function () {
    const nftId = 1;
    const qty = 1;
    const guy = buyer.address
    
    await ticket.connect(buyer).mint(tokenId, nftId, qty, guy, { value: nftPrice });
    expect(await ticket.balanceOf(buyer.address, nftId)).to.equal(1);
  });
  
  it("Test hasAccess method", async function () {
    const nftId = 1;
    const qty = 1;
    const guy = buyer.address
    await ticket.connect(buyer).mint(tokenId, nftId, qty, guy, { value: nftPrice });
    // await ticket.connect(buyer).mint(tokenId, 2, qty, guy, { value: nftPrice });
    expect(await ticket.hasAccess(tokenId, buyer.address)).to.equal(true);
    expect(await ticket.hasAccess(tokenId, buyer2.address)).to.equal(false);
    console.log(await ticket.getNftId(tokenId,guy))
  });
  
  describe("Royalties", function () {
    beforeEach(async function () {
      const nftId = 1;
      const qty = 1;
      const guy = buyer.address
      // Mint a ticket for the buyer
      await ticket.connect(buyer).mint(tokenId, nftId, qty, guy, { value: nftPrice });
    });

    it("Check royalty receiver", async function () {
      const [receiver,] = await ticket.royaltyInfo(tokenId, nftPrice);
      expect(receiver).to.equal(royaltyReceiver.address);
    });

    it("Check royalty percentage", async function () {
      const [, royaltyAmount] = await ticket.royaltyInfo(tokenId, nftPrice);
      const expectedRoyaltyAmount = nftPrice.mul(royaltyPercentage).div(10000);
      expect(royaltyAmount).to.equal(expectedRoyaltyAmount);
    });
  });
});