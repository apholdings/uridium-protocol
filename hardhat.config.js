require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.8.9',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200, // Adjust this value as needed
          },
        },
      },
    ],
  },

  networks: {
    sepolia: {
      url: process.env.ETHEREUM_SEPOLIA_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
    },
    mumbai: {
      url: process.env.MUMBAI_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
    },
    // mumbaiFork: {
    //   url: 'http://127.0.0.1:8545',
    //   accounts: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    // },
  },
  // etherscan: {
  //   apiKey: process.env.ETHERESCAN_API_KEY,
  // },
  etherscan: {
    apiKey: process.env.POLYGONSCAN_API_KEY,
  },
};
