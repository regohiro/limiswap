import { task } from "hardhat/config";

import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
dotenvConfig({ path: resolve(__dirname, "./.env") });

import { HardhatUserConfig, NetworkUserConfig } from "hardhat/types";
import "hardhat-deploy";
import "hardhat-deploy-ethers";

import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import "hardhat-gas-reporter";
import "@nomiclabs/hardhat-etherscan";

const chainIds = {
  mainnet: 1,
  rinkeby: 4,
  kovan: 42,
  hardhat: 31337,
};

const MNEMONIC = process.env.MNEMONIC || "";
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";
const INFURA_API_KEY = process.env.INFURA_API_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  solidity: {
    compilers: [
      {
        version: "0.8.7",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic: MNEMONIC,
      },
      chainId: chainIds.hardhat,
      forking: {
        url: "https://eth-kovan.alchemyapi.io/v2/" + ALCHEMY_API_KEY,
        blockNumber: 28394724,
      },
    },
    kovan: {
      accounts: {
        mnemonic: MNEMONIC
      },
      chainId: 42,
      url: "https://eth-kovan.alchemyapi.io/v2/" + ALCHEMY_API_KEY,
    },
    rinkeby: {
      accounts: {
        mnemonic: MNEMONIC
      },
      chainId: 4,
      url: "https://rinkeby.infura.io/v3/" + INFURA_API_KEY,
    }
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  },
  gasReporter: {
    currency: "USD",
    gasPrice: 100,
    enabled: false,
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
  },
  mocha: {
    timeout: 20000000,
  },
};

export default config;
