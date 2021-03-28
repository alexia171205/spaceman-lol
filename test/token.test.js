const { accounts, contract } = require('@openzeppelin/test-environment');
const { constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

const {
  calculateFirstTransactionBalance,
  totalSupplyString,
  totalSupply,
} = require('../test-helpers');

const { ZERO_ADDRESS } = constants;
const [owner, other] = accounts;

const TokenContract = contract.fromArtifact('Token');

const makeSut = () => TokenContract.new({ from: owner });

describe('TokenContract', () => {
  it('exposes proper meta data for the token', async () => {
    const sut = await makeSut();

    const [name, symbol, decimals] = await Promise.all([sut.name(), sut.symbol(), sut.decimals()]);

    expect(name).toBe('Goku');
    expect(symbol).toBe('GOKU');
    expect(+decimals.toString()).toBe(9);
  });

  it('returns the owner', async () => {
    const sut = await makeSut();
    const owner = await sut.owner();
    expect(owner).toBe(owner);
  });

  it('allows the owner to renounce his/her ownership', async () => {
    const sut = await makeSut();

    const owner = await sut.owner();

    expect(owner).toBe(owner);
    const receipt = await sut.renounceOwnership({ from: owner });

    expectEvent(receipt, 'OwnershipTransferred');

    const newOwner = await sut.owner();
    expect(newOwner).toBe(ZERO_ADDRESS);
  });

  it('forbids anyone else from renouncing ownership', async () => {
    const sut = await makeSut();

    await expectRevert(sut.renounceOwnership({ from: other }), 'Ownable: caller is not the owner');
  });

  it(`does not allow to transfer ownership to ${ZERO_ADDRESS}`, async () => {
    const sut = await makeSut();

    await expectRevert(
      sut.transferOwnership(ZERO_ADDRESS, { from: owner }),
      'Ownable: new owner is the zero address'
    );
  });

  it('it reverts the transaction if an account other than the owner tries to transferOwnership', async () => {
    const sut = await makeSut();

    await expectRevert(
      sut.transferOwnership(ZERO_ADDRESS, { from: other }),
      'Ownable: caller is not the owner'
    );
  });

  it('allows the owner to transferOwnership', async () => {
    const sut = await makeSut();

    expect(sut.owner()).resolves.toBe(owner);
    const receipt = await sut.transferOwnership(other, { from: owner });

    expectEvent(receipt, 'OwnershipTransferred');

    expect(sut.owner()).resolves.toBe(other);
  });

  it('has a taxFee', async () => {
    const sut = await makeSut();

    const taxFee = await sut.taxFee();

    expect(+taxFee.toString()).toBe(5);
  });

  it('returns the total supply', async () => {
    const sut = await makeSut();

    const totalSupply = await sut.totalSupply();
    expect(totalSupply.toString()).toBe(totalSupplyString);
  });

  it('only allows the owner to update the tax fee', async () => {
    const sut = await makeSut();

    const taxFee = await sut.taxFee();

    expect(+taxFee.toString()).toBe(5);

    await expectRevert(
      sut.setTaxFeePercent(10, { from: other }),
      'Ownable: caller is not the owner'
    );

    const taxFee1 = await sut.taxFee();

    expect(+taxFee1.toString()).toBe(5);

    await sut.setTaxFeePercent(10, { from: owner });

    const taxFee2 = await sut.taxFee();

    expect(+taxFee2.toString()).toBe(10);
  });

  it('assigns all tokens to the owner at deployment', async () => {
    const sut = await makeSut();

    const [totalSupply, ownerBalance] = await Promise.all([
      sut.totalSupply(),
      sut.balanceOf(owner),
    ]);
    expect(totalSupply.toString()).toBe(ownerBalance.toString());
  });

  it(`transfers tokens from ${owner} to ${other} and distributes the tax fee correctly`, async () => {
    const sut = await makeSut();

    const transferAmount = 1000000n;

    const finalBalance = calculateFirstTransactionBalance({ amount: transferAmount, fee: 5 });

    const receipt = await sut.transfer(other, transferAmount, { from: owner });

    expectEvent(receipt, 'Transfer');

    const otherAccountBalance = await sut.balanceOf(other);

    expect(otherAccountBalance.toString()).toBe(finalBalance.toString());
  });

  it('does not allow an account to transfer more than he owns', async () => {
    const sut = await makeSut();

    await sut.transfer(other, 100n, { from: owner });

    try {
      await sut.transfer(owner, 200n, { from: other });
    } catch (error) {
      expect(error).toEqual(
        new Error('Returned error: VM Exception while processing transaction: revert')
      );
    }
  });
});
