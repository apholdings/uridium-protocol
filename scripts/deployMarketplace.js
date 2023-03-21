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

    console.log(
    "Deploying contracts with the account:",
    deployer.address
    );
    console.log(
        "Account balance:",
        web3.utils.fromWei((await deployer.getBalance()).toString(), "ether")
    );
    
    // Get the ContractFactories and Signers here.
    const RoleManagement = await ethers.getContractFactory("RoleManagement");
    const Pricing = await ethers.getContractFactory("Pricing");
    const PaymentDistribution = await ethers.getContractFactory("PaymentDistribution");
    const TicketBase = await ethers.getContractFactory("TicketBase");
    const Ticket = await ethers.getContractFactory("Ticket");
    const Booth = await ethers.getContractFactory("Booth");
    const Affiliate = await ethers.getContractFactory("Affiliate");
    const Marketplace = await ethers.getContractFactory("Marketplace");
    const Auctions = await ethers.getContractFactory("Auctions");

    // Deploy contracts
    const roleManagement = await RoleManagement.deploy();
    const pricing = await Pricing.deploy();
    const paymentDistribution = await PaymentDistribution.deploy();
    const ticketBase = await TicketBase.deploy(roleManagement.address);
    const ticket = await Ticket.deploy(ticketBase.address, pricing.address, paymentDistribution.address);
    const affiliate = await Affiliate.deploy(1000); // 10% referral reward
    const booth = await Booth.deploy(affiliate.address);
    const marketplace = await Marketplace.deploy(1); // 1% fee
    const auctions = await Auctions.deploy(marketplace.address);

    // Log the deployed contract addresses
    console.log("RoleManagement:", roleManagement.address);
    console.log("Pricing:", pricing.address);
    console.log("PaymentDistribution:", paymentDistribution.address);
    console.log("TicketBase:", ticketBase.address);
    console.log("Ticket:", ticket.address);
    console.log("Affiliate:", affiliate.address);
    console.log("Booth:", booth.address);
    console.log("Marketplace:", marketplace.address);
    console.log("Auctions:", auctions.address);

}

main().catch((err) => {
  console.log(err);
  process.exitCode = 1;
})