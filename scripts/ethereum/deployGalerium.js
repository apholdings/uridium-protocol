const { ethers } = require("hardhat");
const web3 = require('web3');

async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    },ms)
  })
}

async function main() {
    // Deploy praediumToken contract with a max supply of 1005577
    const GaleriumToken = await ethers.getContractFactory("Galerium");
    const galerium = await GaleriumToken.deploy();
    await galerium.deployed();  
  
    const receipt = await galerium.deployTransaction.wait();
    console.log(`Praedium contract deployed to: ${galerium.address}`);
    console.log(`Transaction hash: ${receipt.transactionHash}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`ETH Cost: ${ethers.utils.formatEther(receipt.gasUsed.toString())}`);
  
    // Delay of 45 seconds
    await sleep(45 * 1000)
    await hre.run("verify:verify", {
      address: galerium.address,
      constructorArguments: [],
    })
}

main().catch((err) => {
  console.log(err);
  process.exitCode = 1;
})