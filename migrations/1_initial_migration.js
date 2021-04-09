const Migrations = artifacts.require('SpacemanLOL.sol');
const { PANCAKE_ROUTER_ADDRESS } = require('../env.json');

module.exports = function (deployer) {
  deployer.deploy(Migrations, PANCAKE_ROUTER_ADDRESS);
};
