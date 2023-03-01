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
    const PraediumToken = await ethers.getContractFactory("Token");
    const totalSupply = ethers.utils.parseEther("1005577");
    const initialSupply = ethers.utils.parseEther("1005577");
    const praediumToken = await PraediumToken.deploy(initialSupply,totalSupply);

    await praediumToken.deployed();    
    await praediumToken.mint("0x49963EbcCB3728948A3fC058d403e6A7D53111bc",initialSupply);    
    const receipt = await praediumToken.deployTransaction.wait();
    console.log(`Praedium contract deployed to: ${praediumToken.address}`);
    console.log(`Transaction hash: ${receipt.transactionHash}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`ETH Cost: ${ethers.utils.formatEther(receipt.gasUsed.toString())}`);
  
    // Delay of 45 seconds
    await sleep(45 * 1000)
    await hre.run("verify:verify", {
      address: praediumToken.address,
      constructorArguments: [initialSupply,totalSupply],
    })
}

main().catch((err) => {
  console.log(err);
  process.exitCode = 1;
})