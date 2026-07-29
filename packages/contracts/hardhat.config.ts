import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import * as dotenv from 'dotenv';
dotenv.config();

// Fail fast on real networks; allow a dummy key for compile/test-only runs.
const PRIVATE_KEY = process.env.PRIVATE_KEY
  ? `0x${process.env.PRIVATE_KEY.replace(/^0x/, '')}`
  : `0x${'0'.repeat(64)}`;

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'london', // Required — Ronin runs London EVM fork
    },
  },

  networks: {
    hardhat: {},
    saigon: {
      chainId: 202601, // Ronin testnet (NOT 2021 — that's the dead old ID)
      url: process.env.RONIN_RPC_URL ?? 'https://saigon-testnet.roninchain.com/rpc',
      accounts: [PRIVATE_KEY],
    },
    ronin: {
      chainId: 2020,
      url: process.env.RONIN_MAINNET_RPC_URL ?? 'https://api.roninchain.com/rpc',
      accounts: [PRIVATE_KEY],
      // EIP-1559 on Ronin mainnet (supported after Feb 2026 OP Stack migration).
      // Uncomment and tune before production deploys to avoid legacy gas pricing.
      // maxFeePerGas: 20_000_000_000n,         // 20 gwei
      // maxPriorityFeePerGas: 1_000_000_000n,  // 1 gwei tip
    },
  },

  // hardhat-deploy named accounts.
  // The minter address is NOT listed here — it comes from process.env.MINTER_ADDRESS
  // in the deploy script. Listing it here would imply a second private key is present.
  namedAccounts: {
    admin: { default: 0 }, // accounts[0] — pays gas
  },

  // Sourcify verification — Ronin uses Sourcify, not Etherscan.
  // Endpoint requires trailing slash per Ronin docs.
  sourcify: {
    enabled: true,
    apiUrl: 'https://sourcify.roninchain.com/server/',
    browserUrl: 'https://sourcify.roninchain.com',
  },

  // etherscan block required by @nomicfoundation/hardhat-toolbox even though
  // Ronin verification goes through Sourcify. Without this, the verify task
  // emits warnings about unknown networks.
  etherscan: {
    apiKey: {
      saigon: 'no-api-key',
      ronin: 'no-api-key',
    },
    customChains: [
      {
        network: 'saigon',
        chainId: 202601,
        urls: {
          apiURL: 'https://saigon-explorer.roninchain.com/api',
          browserURL: 'https://saigon-explorer.roninchain.com',
        },
      },
      {
        network: 'ronin',
        chainId: 2020,
        urls: {
          apiURL: 'https://explorer.roninchain.com/api',
          browserURL: 'https://explorer.roninchain.com',
        },
      },
    ],
  },
};

export default config;
