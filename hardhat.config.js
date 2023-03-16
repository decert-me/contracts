
require('dotenv').config();
require("@nomiclabs/hardhat-etherscan");
require('hardhat-abi-exporter');
require("@nomiclabs/hardhat-solhint");
require('solidity-coverage')
require("@nomicfoundation/hardhat-chai-matchers")

const defaultNetwork = "localhost";
const mnemonic = process.env.MNEMONIC
const scankey = process.env.ETHERSCAN_API_KEY


module.exports = {
  defaultNetwork,
  networks: {
    hardhat: {
      chainId: 31337,
      accounts: {
        mnemonic
      },
    },
    localhost: {
      url: "http://localhost:8545",
      accounts: {
        mnemonic
      },
    },
    mainnet: {
      url: "https://rpc.flashbots.net",
      accounts: {
        mnemonic
      },
      chainId: 1,
    },
    goerli: {
      url: "https://rpc.ankr.com/eth_goerli",
      accounts: {
        mnemonic,
      },
      chainId: 5,
    },
    polygon: {
      url: 'https://polygon.llamarpc.com',
      gasPrice: 120000000000,
      accounts: {
        mnemonic,
      },
      chainId: 137,
    },
    mumbai: {
      url: 'https://rpc-mumbai.maticvigil.com',
      gasPrice: 30000000000,
      accounts: {
        mnemonic,
      },
      chainId: 80001,
    }
  },
  solidity: {
    compilers: [{
      version: "0.8.10",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    },
    {
      version: "0.7.6",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    },
    {
      version: "0.6.7",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
    ],
  },
  etherscan: {
    // Your API key for Etherscan
    apiKey: scankey
  },
  abiExporter: {
    path: './deployments/abi',
    runOnCompile: true,
    clear: true,
    flat: true,
    spacing: 2,
    pretty: true,
  },
};