import { accounts, contract } from '@openzeppelin/test-environment';
import {
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} from '@openzeppelin/test-helpers';

const [sender, recipient, owner, other] = accounts;

const EMPTY_ADDRESS = '0x' + '0'.repeat(40);

const TOTAL_SUPPLY = 1000000000n * 10n ** 6n * 10n ** 9n;

const Sut = contract.fromArtifact(process.env.CONTRACT_NAME || '');
const Mock = contract.fromArtifact(process.env.MOCK_CONTRACT_NAME || '');
const IUniswapV2Router02 = contract.fromArtifact('IUniswapV2Router02');
const IUniswapV2Factory = contract.fromArtifact('IUniswapV2Factory');

describe('Spaceman LOL', () => {
  describe('Meta Data', () => {
    it('has a name', async () => {
      const sut = await makeSut();

      const name = await sut.name();

      expect(name).toBe('TEST SPACEMAN');
    });
    it('has a symbol', async () => {
      const sut = await makeSut();

      const symbol = await sut.symbol();

      expect(symbol).toBe('SML');
    });
    it('has decimals', async () => {
      const sut = await makeSut();

      const decimals = await sut.decimals();

      expect(+decimals).toBe(9);
    });
    it('has a tax fee', async () => {
      const sut = await makeSut();

      const taxFee = await sut.taxFee();

      expect(+taxFee).toBe(5);
    });
    it('has a liquidity fee', async () => {
      const sut = await makeSut();

      const liquidityFee = await sut.liquidityFee();

      expect(+liquidityFee).toBe(5);
    });
    it('has a maximum transfer amount', async () => {
      const sut = await makeSut();

      const maxTxAmount = await sut.maxTxAmount();

      expect(maxTxAmount.toString()).toBe((5000000n * 10n ** 6n * 10n ** 9n).toString());
    });
  });
  describe('It is an ERC20', () => {
    it('has a total supply', async () => {
      const sut = await makeSut();

      const totalSupply = await sut.totalSupply();

      expect(totalSupply.toString()).toBe(TOTAL_SUPPLY.toString());
    });
    it('allows to check the balance of an account', async () => {
      const sut = await makeSut();

      const balance = await sut.balanceOf(owner);

      // The owner has the entire supply at deploy.
      expect(balance.toString()).toBe(TOTAL_SUPPLY.toString());
    });
    it('allows tokens to be transferred between accounts', async () => {
      const sut = await makeSut();

      const transferAmount = 1000000000n;

      const receipt = await sut.transfer(recipient, transferAmount, { from: owner });

      expectEvent(receipt, 'Transfer');

      const balanceOfRecipient = await sut.balanceOf(recipient);
      const balanceOfOwner = await sut.balanceOf(owner);

      expect(balanceOfRecipient.toString()).toBe(transferAmount.toString());
      expect(balanceOfOwner.toString()).toBe((TOTAL_SUPPLY - transferAmount).toString());
    });
    it('allows to approve, check and transfer allowances', async () => {
      const sut = await makeSut();

      const recipientAllowance01 = await sut.allowance(owner, recipient);

      // Recipient starts the process without an allowance (0)
      expect(+recipientAllowance01).toBe(0);

      const allowanceAmount = 1000000000n;

      // Owner gives an allowance to the recipient
      const approveReceipt = await sut.approve(recipient, allowanceAmount, { from: owner });

      expectEvent(approveReceipt, 'Approval');

      const recipientAllowance02 = await sut.allowance(owner, recipient);

      // Confirms now the recipient has an allowance of 1000000000
      expect(recipientAllowance02.toString()).toBe(allowanceAmount.toString());

      // Recipient gives his allowance to the other account for the total amount of 1000000000
      const transferFromReceipt = await sut.transferFrom(owner, other, allowanceAmount, {
        from: recipient,
      });

      expectEvent(transferFromReceipt, 'Transfer');
      expectEvent(transferFromReceipt, 'Approval');

      const recipientAllowance03 = await sut.allowance(owner, recipient);

      // Now the recipient has 0 allowance in his account
      expect(+recipientAllowance03).toBe(0);

      const balanceOfOwner = await sut.balanceOf(owner);

      // The owner account has less tokens because of the allowance transferred to the other account;
      expect(balanceOfOwner.toString()).toBe((TOTAL_SUPPLY - allowanceAmount).toString());

      const otherBalance = await sut.balanceOf(other);

      // The other account now has a balance of 1000000000
      expect(otherBalance.toString()).toBe(allowanceAmount.toString());
    });
  });
});

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
  await mockUniswapFactory.givenMethodReturnAddress(createPair, EMPTY_ADDRESS);

  return Sut.new(mockUniswapRouter02.address, { from: owner });
}
