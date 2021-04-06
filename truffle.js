const HDWalletProvider = require('@truffle/hdwallet-provider');
const { MNEMONIC, BSC_SCAN_API_KEY } = require('./env.json');

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
          providerOrUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
        }),
      network_id: 97,
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
};
