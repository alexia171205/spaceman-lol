const HDWalletProvider = require('@truffle/hdwallet-provider');
const { MNEMONIC, BSC_SCAN_API_KEY, BSC_TESTNET_URL, BSC_URL } = require('./env.json');

module.exports = {
  api_keys: {
    bscscan: BSC_SCAN_API_KEY,
  },
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*', // Match any network id
    },
    testnet: {
      provider: () =>
        new HDWalletProvider({
          mnemonic: MNEMONIC,
          providerOrUrl: BSC_TESTNET_URL,
        }),
      network_id: 97,
      confirmations: 10,
      timeoutBlocks: 200,
      skipDryRun: true,
      production: true,
    },
    bsc: {
      provider: () =>
        new HDWalletProvider({
          mnemonic: MNEMONIC,
          providerOrUrl: BSC_URL,
        }),
      network_id: 56,
      confirmations: 10,
      timeoutBlocks: 200,
      skipDryRun: true,
      production: true,
    },
  },
  compilers: {
    solc: {
      version: '0.8.3',
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },
  plugins: ['solidity-coverage'],
};
