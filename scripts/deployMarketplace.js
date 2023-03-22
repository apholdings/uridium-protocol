const { ethers } = require("hardhat");
const web3 = require('web3');
// const web3 = new Web3(new Web3.providers.HttpProvider("YOUR_PROVIDER_URL"));

async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    },ms)
  })
}

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log(
    "Deploying contracts with the account:",
    deployer.address
    );
    console.log(
        "Account balance:",
        web3.utils.fromWei((await deployer.getBalance()).toString(), "ether")
    );
    
    console.log('================ STARTED Deploying Ticket Contract ================');
    const Ticket = await ethers.getContractFactory("Ticket");
    
    const platformAddress = "0x49963EbcCB3728948A3fC058d403e6A7D53111bc"
    const originNFTAddress = "0x1a76b300E3d5513d9F5D4BEEDF101c1DdA141091"
    const royaltyReceiver = "0xF9D3E93c5C14Cbdbe8354C7F79C4316d51E4d6f4"
    
    const nftPrice = ethers.utils.parseEther("0.01")
    const royaltyPercentage = 500; // 5% represented in basis points (100 basis points = 1%)
    const initialStock = 30;
    const nftId = 1;
    const uri = "https://boomslag.com/api/courses/nft/";
    
    const ticket = await Ticket.deploy(
      nftId,
      nftPrice,
      initialStock,
      royaltyReceiver,
      royaltyPercentage,
      [platformAddress, originNFTAddress],
      [40, 60],
      uri
  );
  
  const receipt = await ticket.deployTransaction.wait();
  console.log(`Ticket contract deployed to: ${ticket.address}`);
  console.log(`Transaction hash: ${receipt.transactionHash}`);
  console.log(`Gas used: ${receipt.gasUsed.toString()}`);
  console.log(`MATIC Cost: ${web3.utils.fromWei((receipt.gasUsed).toString(), "ether")}`);
    
    // Delay of 45 seconds
    await sleep(45 * 1000)
    await hre.run("verify:verify", {
      address: ticket.address,
      constructorArguments: [
        nftId,
        nftPrice,
        initialStock,
        royaltyReceiver,
        royaltyPercentage,
        [platformAddress, originNFTAddress],
        [40, 60],
        uri
      ],
    })
  console.log('================ FINISHED Deploying Ticket Contract ================');
  
  console.log('================ STARTED Deploying Auctions Contract ================');
    const Auctions = await ethers.getContractFactory("Auctions");

    const auctions = await Auctions.deploy(ticket.address);
    
    const auctionReceipt = await auctions.deployTransaction.wait();
    console.log(`Auctions contract deployed to: ${auctions.address}`);
    console.log(`Transaction hash: ${auctionReceipt.transactionHash}`);
    console.log(`Gas used: ${auctionReceipt.gasUsed.toString()}`);
    console.log(`MATIC Cost: ${web3.utils.fromWei((auctionReceipt.gasUsed).toString(), "ether")}`);

    // Delay of 45 seconds
    await sleep(45 * 1000)
    await hre.run("verify:verify", {
      address: auctions.address,
      constructorArguments: [ticket.address],
    })
  console.log('================ FINISHED Deploying Auctions Contract ================');
  
  console.log('================ STARTED Deploying Affiliates Contract ================');
    const Affiliates = await ethers.getContractFactory("Affiliates");

    const referralRewardBasisPoints = [150, 300, 450, 500, 600]; // Example values (10%, 5%, 2.5%)
    const maxDepth = 5;

    const affiliates = await Affiliates.deploy(referralRewardBasisPoints, maxDepth);
    
    const affiliatesReceipt = await affiliates.deployTransaction.wait();
    console.log(`Affiliates contract deployed to: ${affiliates.address}`);
    console.log(`Transaction hash: ${affiliatesReceipt.transactionHash}`);
    console.log(`Gas used: ${affiliatesReceipt.gasUsed.toString()}`);
    console.log(`MATIC Cost: ${web3.utils.fromWei((affiliatesReceipt.gasUsed).toString(), "ether")}`);

    // Delay of 45 seconds
    await sleep(45 * 1000)
    await hre.run("verify:verify", {
      address: affiliates.address,
      constructorArguments: [referralRewardBasisPoints, maxDepth],
    })
  console.log('================ FINISHED Deploying Affiliates Contract ================');
  
  console.log('================ STARTED Deploying Booth Contract ================');
    const Booth = await ethers.getContractFactory("Booth");

    const booth = await Booth.deploy(affiliates.address);

    const boothReceipt = await booth.deployTransaction.wait();
    console.log(`Booth contract deployed to: ${booth.address}`);
    console.log(`Transaction hash: ${boothReceipt.transactionHash}`);
    console.log(`Gas used: ${boothReceipt.gasUsed.toString()}`);
    console.log(`MATIC Cost: ${web3.utils.fromWei((boothReceipt.gasUsed).toString(), "ether")}`);

    // Delay of 45 seconds
    await sleep(45 * 1000)
    await hre.run("verify:verify", {
      address: booth.address,
      constructorArguments: [affiliates.address],
    })
    console.log('================ FINISHED Deploying Booth Contract ================');
  }

main().catch((err) => {
  console.log(err);
  process.exitCode = 1;
})