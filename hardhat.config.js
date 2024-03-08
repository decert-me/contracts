
require('dotenv').config();
require("@nomiclabs/hardhat-etherscan");
require('hardhat-abi-exporter');
require("@nomiclabs/hardhat-solhint");
require('solidity-coverage')
require("@nomicfoundation/hardhat-chai-matchers")

const defaultNetwork = "localhost";
const mnemonic = process.env.MNEMONIC


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
    },
    optimismSepolia: {
      url: 'https://sepolia.optimism.io',
      accounts: {
        mnemonic,
      },
      gasPrice: 12000000,
      chainId: 11155420,
    },
    optimism: {
      url: 'https://mainnet.optimism.io',
      accounts: {
        mnemonic,
      },
      chainId: 10,
    },
    arbitrumSepolia: {
      url: 'https://arbitrum-sepolia.blockpi.network/v1/rpc/public',
      accounts: {
        mnemonic,
      },
      chainId: 421614,
    },
    arbitrumOne: {
      url: 'https://arbitrum.llamarpc.com',
      accounts: {
        mnemonic,
      },
      chainId: 42161,
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
    apiKey: {
      optimisticEthereum: process.env.OPTIMISM_ETHERSCAN_API_KEY,
      optimismSepolia: process.env.OPTIMISM_ETHERSCAN_API_KEY,
      polygon: process.env.POLYGON_ETHERSCAN_API_KEY,
      arbitrumSepolia: process.env.ARBITRUM_ETHERSCAN_API_KEY,
      arbitrumOne: process.env.ARBITRUM_ETHERSCAN_API_KEY,
    },
    customChains: [
      {
        network: "optimismSepolia",
        chainId: 11155420,
        urls: {
          apiURL: "https://api-sepolia-optimism.etherscan.io/api",
          browserURL: "https://sepolia-optimism.etherscan.io"
        }
      },
      {
        network: "arbitrumSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io/",
        }
      }
    ]
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