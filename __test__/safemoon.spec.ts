import { accounts, contract } from '@openzeppelin/test-environment';
import abi from 'ethereumjs-abi';
const [recipient, recipient2, owner, other, other2, pairAddress] = accounts;

const EMPTY_ADDRESS = '0x' + '0'.repeat(40);

const TOTAL_SUPPLY = 1000000000n * 10n ** 6n * 10n ** 9n;

const MAX_TX_AMOUNT = 5000000n * 10n ** 6n * 10n ** 9n;

const Sut = contract.fromArtifact('SafeMoon' || '');
const Mock = contract.fromArtifact(process.env.MOCK_CONTRACT_NAME || '');
const IUniswapV2Router02 = contract.fromArtifact('IUniswapV2Router02');
const IUniswapV2Factory = contract.fromArtifact('IUniswapV2Factory');

describe('Spaceman LOL', () => {
  it.only('correctly transfer between two excluded accounts', async () => {
    const { sut } = await makeSut();

    await sut.excludeFromReward(recipient, { from: owner });

    await sut.excludeFromReward(owner, { from: owner });

    await sut.transfer(recipient, MAX_TX_AMOUNT, { from: owner });

    await sut.transfer(other, 1000n, { from: recipient });

    const recipientBalance01 = await sut.balanceOf(recipient);

    await sut.includeInReward(recipient, { from: owner });

    const recipientBalance02 = await sut.balanceOf(recipient);

    expect(BigInt(recipientBalance01.toString())).toBeLessThan(MAX_TX_AMOUNT);
    expect(BigInt(recipientBalance02.toString())).toBeLessThan(MAX_TX_AMOUNT);
  });
});

function expectNoEvent(receipt: any, eventName: string) {
  return expect(receipt.logs.some(({ event }: { event: string }) => event === eventName)).toBe(
    false
  );
}

async function makeSut() {
  const mockUniswapFactory = await Mock.new();
  const mockUniswapRouter02 = await Mock.new();

  const IUniswapV2FactoryContract = await IUniswapV2Factory.at(mockUniswapFactory.address);
  const IUniswapRouter02Contract = await IUniswapV2Router02.at(mockUniswapRouter02.address);

  const factory = IUniswapRouter02Contract.contract.methods.factory().encodeABI();
  await mockUniswapRouter02.givenMethodReturnAddress(factory, mockUniswapFactory.address);

  const WETH = IUniswapRouter02Contract.contract.methods.WETH().encodeABI();
  await mockUniswapRouter02.givenMethodReturnAddress(WETH, EMPTY_ADDRESS);

  const createPair = IUniswapV2FactoryContract.contract.methods
    .createPair(EMPTY_ADDRESS, EMPTY_ADDRESS)
    .encodeABI();
  await mockUniswapFactory.givenMethodReturnAddress(createPair, pairAddress.toString());

  const swapExactTokensForETHSupportingFeeOnTransferTokens = IUniswapRouter02Contract.contract.methods
    .swapExactTokensForETHSupportingFeeOnTransferTokens(
      0,
      0,
      [EMPTY_ADDRESS, EMPTY_ADDRESS],
      EMPTY_ADDRESS,
      0
    )
    .encodeABI();

  await mockUniswapRouter02.givenMethodReturnBool(
    swapExactTokensForETHSupportingFeeOnTransferTokens,
    true
  );

  const addLiquidityETH = IUniswapRouter02Contract.contract.methods
    .addLiquidityETH(EMPTY_ADDRESS, 0, 0, 0, EMPTY_ADDRESS, 0)
    .encodeABI();

  const addLiquidityETHReturn = abi.rawEncode(['uint', 'uint', 'uint'], [0, 0, 0]);
  await mockUniswapRouter02.givenMethodReturn(addLiquidityETH, addLiquidityETHReturn);

  const sut = await Sut.new(mockUniswapRouter02.address, { from: owner });

  return {
    sut,
    mockUniswapFactory,
    mockUniswapRouter02,
  };
}
