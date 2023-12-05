require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config()
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.9",

  networks: {
    sepolia: {
      url: process.env.ETHEREUM_SEPOLIA_RPC_URL,
      accounts: [process.env.PRIVATE_KEY]
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL,
      accounts: [process.env.PRIVATE_KEY]
    },
    mumbai: {
      url: process.env.MUMBAI_RPC_URL,
      accounts: [process.env.PRIVATE_KEY]
    },
  },
  // etherscan: {
  //   apiKey: process.env.ETHERESCAN_API_KEY,
  // },
  etherscan: {
      apiKey: process.env.POLYGONSCAN_API_KEY,
  }
};

