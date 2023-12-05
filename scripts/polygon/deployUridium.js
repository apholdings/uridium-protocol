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
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (web3.utils.fromWei((await deployer.getBalance()).toString(), "ether")).toString());

  // Deploy praediumToken contract with a max supply of 1005577
  const UridiumToken = await ethers.getContractFactory("Uridium");
  const uridium = await UridiumToken.deploy();
  await uridium.deployed();  
  
  const initialSupply = ethers.utils.parseEther("1000000");

  // Mint tokens to the contract address
  // await uridium.mint(uridium.address, contractSupply);

  // Mint tokens to the specified address
  // const recipientAddress = "0x49963EbcCB3728948A3fC058d403e6A7D53111bc";
  await uridium.mint(deployer.address, initialSupply);
  
  const receipt = await uridium.deployTransaction.wait();

  console.log(`Uridium contract deployed to: ${uridium.address}`);
  console.log(`Transaction hash: ${receipt.transactionHash}`);
  console.log(`Gas used: ${receipt.gasUsed.toString()}`);
  console.log(`MATIC Cost: ${ethers.utils.formatEther(receipt.gasUsed.toString())}`);

  // Delay of 45 seconds
  await sleep(45 * 1000)
  await hre.run("verify:verify", {
    address: uridium.address,
    constructorArguments: [],
  })
}

main().catch((err) => {
  console.log(err);
  process.exitCode = 1;
})