const { ethers } = require("hardhat");

async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    },ms)
  })
}

async function main() {
  // Deploy praediumToken contract with a max supply of 1005577
  const DAI = await ethers.getContractFactory("DAI");
  const dai = await DAI.deploy();
  await dai.deployed();  
  
  const initialSupply = ethers.utils.parseEther("1000000");
  
    // await dai.mint(dai.address, initialSupply);
    
  await dai.mint("0x49963EbcCB3728948A3fC058d403e6A7D53111bc", initialSupply);
  
  const receipt = await dai.deployTransaction.wait();
  console.log(`DAI contract deployed to: ${dai.address}`);
  console.log(`Transaction hash: ${receipt.transactionHash}`);
  console.log(`Gas used: ${receipt.gasUsed.toString()}`);
  console.log(`MATIC Cost: ${ethers.utils.formatEther(receipt.gasUsed.toString())}`);

  // Delay of 45 seconds
  await sleep(45 * 1000)
  await hre.run("verify:verify", {
        address: dai.address,
        contract: "contracts/testnet/DAI.sol:DAI",
        constructorArguments: [],
    });
}

main().catch((err) => {
  console.log(err);
  process.exitCode = 1;
})