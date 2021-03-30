const { accounts, contract } = require('@openzeppelin/test-environment');
const { constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

const { ZERO_ADDRESS } = constants;
const [owner, other] = accounts;

const Contract = contract.fromArtifact(process.env.CONTRACT_NAME);

const makeSut = () => Contract.new({ from: owner });

describe('Goku Ownable', () => {
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
});
