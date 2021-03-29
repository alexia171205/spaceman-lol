const { constants } = require('@openzeppelin/test-helpers');

const { MAX_UINT256 } = constants;

const totalSupply = 1000000000n * 10n ** 6n * 10n ** 9n;
const totalSupplyString = totalSupply.toString();

const totalReflectionSupply = BigInt(MAX_UINT256) - (BigInt(MAX_UINT256) % totalSupply);

const calculateFirstTransactionBalance = ({ amount, fee }) => {
  const tax = (amount * BigInt(fee)) / 100n;
  const reflectionTax = tax * (totalReflectionSupply / totalSupply);

  const reflectionAmount = amount * (totalReflectionSupply / totalSupply);
  const receivedAmount = reflectionAmount - reflectionTax;

  const newTotalReflectionSupply = totalReflectionSupply - reflectionTax;

  return receivedAmount / (newTotalReflectionSupply / totalSupply);
};

module.exports = {
  totalSupply,
  totalSupplyString,
  totalReflectionSupply,
  calculateFirstTransactionBalance,
};
