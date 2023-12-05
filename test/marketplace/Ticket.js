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
  const useStock = false;
  const limitedEdition = false;

  beforeEach(async function () {
    [owner, seller, buyer, buyer2, royaltyReceiver] = await ethers.getSigners();

    // Deploy Ticket Contract
    Ticket = await ethers.getContractFactory("Ticket");
    ticket = await Ticket.deploy(
      tokenId,
      nftPrice,
      initialStock,
      useStock,
      limitedEdition,
      royaltyReceiver.address,
      royaltyPercentage,
      [owner.address, seller.address],
      [10, 90],
      uri
    );
    await ticket.deployed();
  });

  describe("Deployment", function () {
    it("should deploy Ticket contract", async function () {
      expect(ticket.address).to.not.equal(0x0);
      expect(ticket.address).to.not.equal(null);
      expect(ticket.address).to.not.equal(undefined);
      expect(ticket.address).to.not.equal("");
    });
  });

  describe("Basic Functions", function () {
    it("should check max supply", async function () {
      expect(await ticket.stock(tokenId)).to.equal(initialStock);
    });

    it("should change price", async function () {
      const newPrice = ethers.utils.parseEther("0.02");
      await ticket.connect(owner).updatePrice(newPrice);
      expect(await ticket.price()).to.equal(newPrice);
    });

    it("should verify URI", async function () {
      const nftId = 1;
      const qty = 1;
      const guy = buyer.address;
      await ticket.connect(buyer).mint(tokenId, nftId, qty, guy, { value: nftPrice });
      // console.log('NFT Metadata URI: ', await ticket.uri(nftId));
      expect(await ticket.uri(nftId)).to.equal(uri + nftId + ".json");
    });

    it("should mint directly using the ticket", async function () {
      const nftId = 1;
      const qty = 1;
      const guy = buyer.address;
      await ticket.connect(buyer).mint(tokenId, nftId, qty, guy, { value: nftPrice });
      expect(await ticket.balanceOf(buyer.address, nftId)).to.equal(1);
    });

    it("should test hasAccess method", async function () {
      const nftId = 1;
      const qty = 1;
      const guy = buyer.address;
      await ticket.connect(buyer).mint(tokenId, nftId, qty, guy, { value: nftPrice });
      expect(await ticket.hasAccess(tokenId, buyer.address)).to.equal(true);
      expect(await ticket.hasAccess(tokenId, buyer2.address)).to.equal(false);
    });
  });

  describe("Royalties", function () {
    beforeEach(async function () {
      const nftId = 1;
      const qty = 1;
      const guy = buyer.address;
      await ticket.connect(buyer).mint(tokenId, nftId, qty, guy, { value: nftPrice });
    });

    it("should check royalty receiver", async function () {
      const [receiver,] = await ticket.royaltyInfo(tokenId, nftPrice);
      expect(receiver).to.equal(royaltyReceiver.address);
    });

    it("should check royalty percentage", async function () {
      const [, royaltyAmount] = await ticket.royaltyInfo(tokenId, nftPrice);
      const expectedRoyaltyAmount = nftPrice.mul(royaltyPercentage).div(10000);
      expect(royaltyAmount).to.equal(expectedRoyaltyAmount);
    });

    it("should retrieve royalty information", async function () {
      const nftId = 1;
      const qty = 1;
      const guy = buyer.address;
      const salePrice = ethers.utils.parseEther("0.05");

      await ticket.connect(buyer).mint(tokenId, nftId, qty, guy, { value: salePrice });

      const [receiver, royaltyAmount] = await ticket.royaltyInfo(tokenId, salePrice);
      const expectedRoyaltyAmount = salePrice.mul(royaltyPercentage).div(10000);

      expect(receiver).to.equal(royaltyReceiver.address);
      expect(royaltyAmount).to.equal(expectedRoyaltyAmount);
    });
  });

  describe("Admin Functions", function () {
    it("should set stock limit", async function () {
      const newStockLimit = 50;
      await ticket.connect(owner).setStock(tokenId, newStockLimit);
      expect(await ticket.stock(tokenId)).to.equal(newStockLimit);
    });

    it("should set use stock flag", async function () {
      const newUseStockFlag = true;
      await ticket.connect(owner).setUseStock(newUseStockFlag);
      expect(await ticket.useStock()).to.equal(newUseStockFlag);
    });

    it("should update price", async function () {
      const newPrice = ethers.utils.parseEther("0.03");
      await ticket.connect(owner).updatePrice(newPrice);
      expect(await ticket.price()).to.equal(newPrice);
    });
  });
});