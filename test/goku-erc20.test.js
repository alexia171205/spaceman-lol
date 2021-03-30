const { accounts, contract } = require('@openzeppelin/test-environment');
const { expectEvent } = require('@openzeppelin/test-helpers');

const { calculateFirstTransactionBalance } = require('../test-helpers');

const [owner, other] = accounts;

const TokenContract = contract.fromArtifact('Goku');

const makeSut = () => TokenContract.new({ from: owner });

describe('Goku ERC20 interface', () => {
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
