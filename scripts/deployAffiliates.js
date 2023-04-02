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
    
  console.log('================ STARTED Deploying Affiliates Contract ================');
    const Affiliates = await ethers.getContractFactory("Affiliates");

    const maxReferralDepth = 5;  
    const referralRewardBasisPointsArray = [
      [ 100,  200,  400,  600,  800]  // Level 1: Bronze
      [ 200,  400,  600,  800, 1000], // Level 2: Silver 
      [ 400,  600,  800, 1000, 1200], // Level 3: Gold 
      [ 600,  800, 1000, 1200, 1400], // Level 4: Platinum 
      [ 800, 1000, 1200, 1400, 1600], // Level 5: Diamond 
      ]; // Represented in basis points

    // Define the rank criteria
    const rankCriteriasArray = [
        {requiredDirectReferrals: 0, requiredSalesVolume: ethers.utils.parseEther("0")},
        {requiredDirectReferrals: 5, requiredSalesVolume: ethers.utils.parseEther("100")},
        {requiredDirectReferrals: 10, requiredSalesVolume: ethers.utils.parseEther("250")},
        {requiredDirectReferrals: 15, requiredSalesVolume: ethers.utils.parseEther("500")},
        {requiredDirectReferrals: 20, requiredSalesVolume: ethers.utils.parseEther("1000")}
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
      constructorArguments: [referralRewardBasisPointsArray, rankCriteriasArray, maxReferralDepth],
      network: "mumbai"
    })
  console.log('================ FINISHED Deploying Affiliates Contract ================');
  
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

    console.log('================ FINAL DEPLOYMENT COSTS =================');
    console.log(`Total gas used: ${totalGasUsed.toString()}`);
    console.log(`Total cost in MATIC: ${totalMaticCostInEther}`);
    console.log(`Total cost in USD: $${totalDeploymentCostUsd.toFixed(2)}`);
  }

main().catch((err) => {
  console.log(err);
  process.exitCode = 1;
})