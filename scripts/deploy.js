const { ethers } = require("hardhat");
const web3 = require('web3');
const https = require("https");

async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    },ms)
  })
}

// Function to get the current price of MATIC in USD
function getMaticUsdPrice() {
  return new Promise((resolve, reject) => {
    https.get("https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=usd", (res) => {
      let data = "";
      
      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        const jsonData = JSON.parse(data);
        // console.log(jsonData);
        resolve(jsonData['matic-network'].usd);
      });
      
      res.on("error", (error) => {
        reject(error);
      });
    });
  });
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

      const maxReferralDepth = 5;  
      const referralRewardBasisPointsArray = [
          [ 800, 1000, 1200, 1400, 1600], // Level 1: Bronze (Direct Referral)
          [ 600,  800, 1000, 1200, 1400], // Level 2: Silver (Indirect Referral)
          [ 400,  600,  800, 1000, 1200], // Level 3: Gold (Indirect Referral)
          [ 200,  400,  600,  800, 1000], // Level 4: Platinum (Indirect Referral)
          [ 100,  200,  400,  600,  800]  // Level 5: Diamond (Indirect Referral)
        ]; // Represented in basis points

      // Define the rank criteria
      const rankCriteriasArray = [
          {requiredDirectReferrals: 5, requiredSalesVolume: ethers.utils.parseEther("1")},
          {requiredDirectReferrals: 10, requiredSalesVolume: ethers.utils.parseEther("5")},
          {requiredDirectReferrals: 20, requiredSalesVolume: ethers.utils.parseEther("10")},
          {requiredDirectReferrals: 50, requiredSalesVolume: ethers.utils.parseEther("20")},
          {requiredDirectReferrals: 100, requiredSalesVolume: ethers.utils.parseEther("50")}
      ];

      const affiliates = await Affiliates.deploy(
        referralRewardBasisPointsArray,
        rankCriteriasArray,
        maxReferralDepth
      );
        
      const affiliatesReceipt = await affiliates.deployTransaction.wait();
      console.log(`Affiliates contract deployed to: ${affiliates.address}`);
      console.log(`Transaction hash: ${affiliatesReceipt.transactionHash}`);
      console.log(`Gas used: ${affiliatesReceipt.gasUsed.toString()}`);
      console.log(`MATIC Cost: ${web3.utils.fromWei((affiliatesReceipt.gasUsed).toString(), "ether")}`);

      // Delay of 45 seconds
      await sleep(45 * 1000)
      await hre.run("verify:verify", {
        address: affiliates.address,
        constructorArguments: [
          referralRewardBasisPointsArray,
          rankCriteriasArray,
          maxReferralDepth
        ],
      })
    console.log('================ FINISHED Deploying Affiliates Contract ================');
  
    console.log('================ STARTED Deploying Booth Contract ================');
    
      const commissionPercentage = 25;
      const Booth = await ethers.getContractFactory("Booth");
      const booth = await Booth.deploy(affiliates.address,commissionPercentage);

      const boothReceipt = await booth.deployTransaction.wait();
      console.log(`Booth contract deployed to: ${booth.address}`);
      console.log(`Transaction hash: ${boothReceipt.transactionHash}`);
      console.log(`Gas used: ${boothReceipt.gasUsed.toString()}`);
      console.log(`MATIC Cost: ${web3.utils.fromWei((boothReceipt.gasUsed).toString(), "ether")}`);

      // Delay of 45 seconds
      await sleep(45 * 1000)
      await hre.run("verify:verify", {
        address: booth.address,
        constructorArguments: [
          affiliates.address,
          commissionPercentage
        ],
      })
      
    console.log('================ FINISHED Deploying Booth Contract ================');
      
    console.log('================ Granting Roles ================');
      // Delay of 30 seconds
      await sleep(30 * 1000)
      // Get the current gas price for grantRole methods
      const grantRoleGasPrice = await deployer.provider.getGasPrice();
      const increasedGrantRoleGasPrice = grantRoleGasPrice.add(ethers.BigNumber.from("1000000000")); // Add 1 Gwei to the current gas price
      // Grant BOOTH_ROLE to the booth contract in the Ticket contract
      await ticket.grantRole(await ticket.BOOTH_ROLE(), booth.address, { gasPrice: increasedGrantRoleGasPrice });
      console.log('Ticket Contract Granted BOOTH role to Booth Contract')
      // Grant BOOTH_ROLE to the booth contract in the Affiliates contract
      await affiliates.grantRole(await affiliates.BOOTH_ROLE(), booth.address, { gasPrice: increasedGrantRoleGasPrice });
      console.log('Affiliates Contract Granted BOOTH role to Booth Contract')
    console.log('================ FINISHED Granting Roles ================');

    
    console.log('================ FINAL DEPLOYMENT COSTS =================');
      // Get the current price of MATIC in USD
      const maticUsdPrice = await getMaticUsdPrice();

      // Calculate the total gas used in all deployments
      const totalGasUsed = receipt.gasUsed
        .add(auctionReceipt.gasUsed)
        .add(affiliatesReceipt.gasUsed)
        .add(boothReceipt.gasUsed);
      // Convert the total gas used to MATIC
      const gasPrice = await deployer.provider.getGasPrice();
      const totalMaticCost = totalGasUsed.mul(gasPrice);

      // Convert the total MATIC cost to USD
      const totalMaticCostInEther = parseFloat(web3.utils.fromWei(totalMaticCost.toString(), "ether"));
      const totalDeploymentCostUsd = totalMaticCostInEther * maticUsdPrice;

      console.log(`Total gas used: ${totalGasUsed.toString()}`);
      console.log(`Total cost in MATIC: ${totalMaticCostInEther}`);
      console.log(`Total cost in USD: $${totalDeploymentCostUsd.toFixed(2)}`);
  }

main().catch((err) => {
  console.log(err);
  process.exitCode = 1;
})