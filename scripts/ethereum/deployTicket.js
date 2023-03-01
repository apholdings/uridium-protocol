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
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (web3.utils.fromWei((await deployer.getBalance()).toString(), "ether")).toString());

  console.log('================ Deploying Ticket Contract ================');

  const NFT = await ethers.getContractFactory("Ticket");
    
    const OwnerAddress = "0x49963EbcCB3728948A3fC058d403e6A7D53111bc"
    const SellerAddress = "0x1a76b300E3d5513d9F5D4BEEDF101c1DdA141091"
    const CoursePrice = ethers.utils.parseEther("0.01")
    
    const nft = await NFT.deploy(CoursePrice,[OwnerAddress,SellerAddress],[10,90]);
  
  const receipt = await nft.deployTransaction.wait();
  console.log(`Ticket contract deployed to: ${nft.address}`);
  console.log(`Transaction hash: ${receipt.transactionHash}`);
  console.log(`Gas used: ${receipt.gasUsed.toString()}`);
  console.log(`ETH Cost: ${web3.utils.fromWei((receipt.gasUsed).toString(), "ether")}`);

  // Delay of 45 seconds
  await sleep(45 * 1000)
  await hre.run("verify:verify", {
    address: nft.address,
    constructorArguments: [CoursePrice,[OwnerAddress,SellerAddress],[10,90]],
  })
}

main().catch((err) => {
  console.log(err);
  process.exitCode = 1;
})