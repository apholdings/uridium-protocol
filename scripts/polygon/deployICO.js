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
    // Deploy praediumToken contract with a max supply of 1005577
    const ICOContract = await ethers.getContractFactory("ICO");
    const maxICOSupply = ethers.utils.parseEther("100557");
  
    const PraediumTokenContract = await ethers.getContractFactory("Token");
    const praediumToken = await PraediumTokenContract.attach("0xCC293Da6Fa3cD5Ccb171716068D6809Fca131883");
  
    const ico = await ICOContract.deploy(praediumToken.address, maxICOSupply);
    await ico.deployed();
  
    const now = Math.floor(Date.now() / 1000);
    const startTime = now + 3600; // ICO starts in 1 hour
    const endTime = now + (7 * 24 * 3600); // ICO ends in 1 week
    await ico.setICOTime(startTime, endTime);
    
    const receipt = await ico.deployTransaction.wait();
    console.log(`Praedium ICO contract deployed to: ${ico.address}`);
    console.log(`Transaction hash: ${receipt.transactionHash}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`MATIC Cost: ${web3.utils.fromWei((receipt.gasUsed).toString(), "ether")}`);

  // Delay of 45 seconds
    await sleep(45 * 1000)
    await hre.run("verify:verify", {
      address: ico.address,
      constructorArguments: [praediumToken.address,maxICOSupply],
    })
}

main().catch((err) => {
  console.log(err);
  process.exitCode = 1;
})