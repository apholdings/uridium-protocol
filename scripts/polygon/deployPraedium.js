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
    const praediumToken = await PraediumToken.deploy(totalSupply);
    await praediumToken.deployed();

    const devAddress = "0x1a76b300E3d5513d9F5D4BEEDF101c1DdA141091"; // Gets 8%
    const icoAddress = "0x740fFB7686c793259cd6f1e95388f95717a32B16"; // Gets 10%
    const foundationAddress = "0xF9D3E93c5C14Cbdbe8354C7F79C4316d51E4d6f4"; // Gets 10%

    // Mint 8% for dev team
    const devAllocation = totalSupply.mul(8).div(100);
    await praediumToken.mint(devAddress, devAllocation);

    // Mint 10% for ICO contract
    const icoAllocation = totalSupply.mul(10).div(100);
    await praediumToken.mint(icoAddress, icoAllocation);

    // Mint 10% for foundation
    const foundationAllocation = totalSupply.mul(10).div(100);
    await praediumToken.mint(foundationAddress, foundationAllocation);

    // Mint the remaining supply (72%)
    const remainingSupply = totalSupply.sub(devAllocation).sub(icoAllocation).sub(foundationAllocation);
    await praediumToken.mint(praediumToken.address, remainingSupply);
  
    const receipt = await praediumToken.deployTransaction.wait();
    console.log(`Praedium contract deployed to: ${praediumToken.address}`);
    console.log(`Transaction hash: ${receipt.transactionHash}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`MATIC Cost: ${ethers.utils.formatEther(receipt.gasUsed.toString())}`);
  
    // Delay of 45 seconds
    await sleep(45 * 1000)
    await hre.run("verify:verify", {
      address: praediumToken.address,
      constructorArguments: [totalSupply],
    })
}

main().catch((err) => {
  console.log(err);
  process.exitCode = 1;
})