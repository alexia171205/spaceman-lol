const { accounts, contract } = require('@openzeppelin/test-environment');
const { expectEvent, expectRevert, constants } = require('@openzeppelin/test-helpers');

const { calculateFirstTransactionBalance } = require('../test-helpers');

const { ZERO_ADDRESS } = constants;
const [owner, other, beneficiary, beneficiary2] = accounts;

const Contract = contract.fromArtifact(process.env.CONTRACT_NAME);

const makeSut = () => Contract.new({ from: owner });

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

  it('allows an account to give an allowance to another account', async () => {
    const sut = await makeSut();

    const receipt = await sut.approve(beneficiary, 100n, { from: owner });

    expectEvent(receipt, 'Approval');

    const beneficiaryAllowance = await sut.allowance(owner, beneficiary);
    expect(beneficiaryAllowance.toString()).toBe(100n.toString());
  });

  it(`does not allow an account to provide allowance to the ${ZERO_ADDRESS}`, async () => {
    const sut = await makeSut();

    await expectRevert(
      sut.approve(ZERO_ADDRESS, 100n, { from: owner }),
      'The burn address is not allowed to make this operation -- Reason given: The burn address is not allowed to make this operation.'
    );
  });

  it('allows an account to increase an allowance to another account', async () => {
    const sut = await makeSut();

    const receipt1 = await sut.approve(beneficiary, 100n, { from: owner });

    expectEvent(receipt1, 'Approval');

    const beneficiaryAllowance1 = await sut.allowance(owner, beneficiary);
    expect(beneficiaryAllowance1.toString()).toBe(100n.toString());

    const receipt2 = await sut.increaseAllowance(beneficiary, 50n, { from: owner });

    expectEvent(receipt2, 'Approval');

    const beneficiaryAllowance2 = await sut.allowance(owner, beneficiary);
    expect(beneficiaryAllowance2.toString()).toBe(150n.toString());
  });

  it('allows an account to decrease an allowance to another account', async () => {
    const sut = await makeSut();

    const receipt1 = await sut.approve(beneficiary, 100n, { from: owner });

    expectEvent(receipt1, 'Approval');

    const beneficiaryAllowance1 = await sut.allowance(owner, beneficiary);
    expect(beneficiaryAllowance1.toString()).toBe(100n.toString());

    const receipt2 = await sut.decreaseAllowance(beneficiary, 50n, { from: owner });

    expectEvent(receipt2, 'Approval');

    const beneficiaryAllowance2 = await sut.allowance(owner, beneficiary);
    expect(beneficiaryAllowance2.toString()).toBe(50n.toString());
  });

  it('does not allow an account to reduce an allowance below zero', async () => {
    const sut = await makeSut();

    try {
      await sut.decreaseAllowance(beneficiary, 50n, { from: owner });
    } catch (error) {
      expect(error).toEqual(
        new Error('Returned error: VM Exception while processing transaction: revert')
      );
    }
  });

  it('does not allow an empty account to withdraw any money', async () => {
    const sut = await makeSut();

    await expectRevert(sut.transferFrom(owner, other, 200n, { from: beneficiary }), 'revert');
  });

  it('does not allow an account to transfer an allowance larger than the owner allows', async () => {
    const sut = await makeSut();

    await sut.approve(beneficiary, 100n, { from: owner });

    await expectRevert(sut.transferFrom(owner, other, 200n, { from: beneficiary }), 'revert');
  });

  it('does not allow a beneficiary to receive an allowance larger than what the owner owns', async () => {
    const sut = await makeSut();

    await sut.transfer(other, 100n, { from: owner });

    await sut.approve(beneficiary, 200n, { from: other });

    await expectRevert(sut.transferFrom(other, owner, 200n, { from: beneficiary }), 'revert');
  });

  it('allows a beneficiary to successfully spend his allowance, while rewarding the holders', async () => {
    const sut = await makeSut();

    /**
     * @description This has a tax. So the other account receives less than 500.
     */
    await sut.transfer(other, 500n, { from: owner });

    const ownerPreBalance = await sut.balanceOf(owner);

    await sut.approve(beneficiary, 400n, { from: other });

    const receipt = await sut.transferFrom(other, beneficiary2, 200n, { from: beneficiary });

    expectEvent(receipt, 'Approval');
    expectEvent(receipt, 'Transfer');

    const [beneficiaryAllowance, beneficiary2Balance, ownerPostBalance] = await Promise.all([
      sut.allowance(other, beneficiary),
      sut.balanceOf(beneficiary2),
      sut.balanceOf(owner),
    ]);

    expect(beneficiaryAllowance.toString()).toBe(200n.toString());
    /**
     * @description Very hard to correctly predict the inflation rate. So we just compare if the beneficiary received less than what was sent.
     */
    expect(beneficiary2Balance < 200n).toBe(true);
    /**
     * @description Very hard to correctly predict the inflation rate. So we just compare that if the owner balance increased, it means he got rewarded from the transaction.
     */
    expect(ownerPreBalance < ownerPostBalance).toBe(true);
  });
});
