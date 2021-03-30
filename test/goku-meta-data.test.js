const { accounts, contract } = require('@openzeppelin/test-environment');

const { totalSupplyString } = require('../test-helpers');

const [owner] = accounts;

const TokenContract = contract.fromArtifact('Goku');

const makeSut = () => TokenContract.new({ from: owner });

describe('Goku Meta Data', () => {
  it('exposes proper meta data for the token', async () => {
    const sut = await makeSut();

    const [name, symbol, decimals] = await Promise.all([sut.name(), sut.symbol(), sut.decimals()]);

    expect(name).toBe('Goku');
    expect(symbol).toBe('GOKU');
    expect(+decimals.toString()).toBe(9);
  });

  it('returns the total supply', async () => {
    const sut = await makeSut();

    const totalSupply = await sut.totalSupply();
    expect(totalSupply.toString()).toBe(totalSupplyString);
  });

  it('has a taxFee', async () => {
    const sut = await makeSut();

    const taxFee = await sut.taxFee();

    expect(+taxFee.toString()).toBe(5);
  });
});
