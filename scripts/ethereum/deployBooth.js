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
    const feePercent = 1;
    const [deployer] = await ethers.getSigners();
    
    console.log('================ Deploying Marketplace Contract ================');
    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", ( web3.utils.fromWei((await deployer.getBalance()).toString(), "ether") ).toString());
    // Get the ContractFactories and Signers here.
    const Marketplace = await ethers.getContractFactory("Booth");
    // deploy contracts
    const marketplace = await Marketplace.deploy(feePercent);

    const receipt = await marketplace.deployTransaction.wait();
    console.log(`Course NFT Marketplace contract deployed to: ${marketplace.address}`);
    console.log(`Transaction hash: ${receipt.transactionHash}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);
    // console.log(`ETH Cost: ${web3.utils.fromWei((receipt.gasUsed).toString(), "ether")}`);

    // Delay of 45 seconds
    await sleep(45 * 1000)
    await hre.run("verify:verify", {
      address: marketplace.address,
      constructorArguments: [feePercent],
    })
}

main().catch((err) => {
  console.log(err);
  process.exitCode = 1;
})