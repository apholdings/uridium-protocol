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
  
  console.log('================ STARTED Deploying Booth Contract ================');
    const Booth = await ethers.getContractFactory("Booth");

    const booth = await Booth.deploy('0x0x0x0x0x00x0x0x0x0x0x0x0x0x0x0x0x0x0x0x0x0x00x0x0x0xx00x0x0xx');

    const boothReceipt = await booth.deployTransaction.wait();
    console.log(`Booth contract deployed to: ${booth.address}`);
    console.log(`Transaction hash: ${boothReceipt.transactionHash}`);
    console.log(`Gas used: ${boothReceipt.gasUsed.toString()}`);
    console.log(`MATIC Cost: ${web3.utils.fromWei((boothReceipt.gasUsed).toString(), "ether")}`);

    // Delay of 45 seconds
    await sleep(45 * 1000)
    await hre.run("verify:verify", {
      address: booth.address,
      constructorArguments: ['0x0x0x0x0x00x0x0x0x0x0x0x0x0x0x0x0x0x0x0x0x0x00x0x0x0xx00x0x0xx'],
      network: "mumbai"
    })
    
    // Grant BOOTH_ROLE to the booth contract in the Ticket contract
    await ticket.grantRole(await ticket.BOOTH_ROLE(), booth.address);
    // Grant BOOTH_ROLE to the booth contract in the Affiliates contract
    await affiliates.grantRole(await affiliates.BOOTH_ROLE(), booth.address);
  console.log('================ FINISHED Deploying Booth Contract ================');
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