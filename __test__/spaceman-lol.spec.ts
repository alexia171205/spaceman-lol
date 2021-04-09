import { accounts, contract } from '@openzeppelin/test-environment';
import { expectEvent, expectRevert } from '@openzeppelin/test-helpers';
import abi from 'ethereumjs-abi';
const [recipient, recipient2, owner, other, other2, pairAddress] = accounts;

const EMPTY_ADDRESS = '0x' + '0'.repeat(40);

const TOTAL_SUPPLY = 1000000000n * 10n ** 6n * 10n ** 9n;

const MAX_TX_AMOUNT = 5000000n * 10n ** 6n * 10n ** 9n;

const Sut = contract.fromArtifact(process.env.CONTRACT_NAME || '');
const Mock = contract.fromArtifact(process.env.MOCK_CONTRACT_NAME || '');
const IUniswapV2Router02 = contract.fromArtifact('IUniswapV2Router02');
const IUniswapV2Factory = contract.fromArtifact('IUniswapV2Factory');

describe('Spaceman LOL', () => {
  describe('Meta Data', () => {
    it('has a name', async () => {
      const { sut } = await makeSut();

      const name = await sut.name();

      expect(name).toBe('TEST SPACEMAN');
    });
    it('has a symbol', async () => {
      const { sut } = await makeSut();

      const symbol = await sut.symbol();

      expect(symbol).toBe('SML');
    });
    it('has decimals', async () => {
      const { sut } = await makeSut();

      const decimals = await sut.decimals();

      expect(+decimals).toBe(9);
    });
    it('has a tax fee', async () => {
      const { sut } = await makeSut();

      const taxFee = await sut.taxFee();

      expect(+taxFee).toBe(5);
    });
    it('has a liquidity fee', async () => {
      const { sut } = await makeSut();

      const liquidityFee = await sut.liquidityFee();

      expect(+liquidityFee).toBe(5);
    });
    it('has a maximum transfer amount', async () => {
      const { sut } = await makeSut();

      const maxTxAmount = await sut.maxTxAmount();

      expect(maxTxAmount.toString()).toBe((5000000n * 10n ** 6n * 10n ** 9n).toString());
    });
    it('allows to check if swap and liquify functionality is activated', async () => {
      const { sut } = await makeSut();

      const isSwapAndLiquifyingEnabled = await sut.isSwapAndLiquifyingEnabled();

      expect(isSwapAndLiquifyingEnabled).toBe(false);
    });
  });
  describe('It is an ERC20', () => {
    it('has a total supply', async () => {
      const { sut } = await makeSut();

      const totalSupply = await sut.totalSupply();

      expect(totalSupply.toString()).toBe(TOTAL_SUPPLY.toString());
    });
    it('allows to check the balance of an account', async () => {
      const { sut } = await makeSut();

      const balance = await sut.balanceOf(owner);

      // The owner has the entire supply at deploy.
      expect(balance.toString()).toBe(TOTAL_SUPPLY.toString());
    });
    it('allows tokens to be transferred between accounts', async () => {
      const { sut } = await makeSut();

      const transferAmount = 1000000000n;

      const receipt = await sut.transfer(recipient, transferAmount, { from: owner });

      expectEvent(receipt, 'Transfer');

      const balanceOfRecipient = await sut.balanceOf(recipient);
      const balanceOfOwner = await sut.balanceOf(owner);

      expect(balanceOfRecipient.toString()).toBe(transferAmount.toString());
      expect(balanceOfOwner.toString()).toBe((TOTAL_SUPPLY - transferAmount).toString());
    });
    it('allows to approve, check and transfer allowances', async () => {
      const { sut } = await makeSut();

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
  describe('Core functionality', () => {
    it('assigns all tokens to the owner in the constructor', async () => {
      const { sut } = await makeSut();

      const ownerBalance = await sut.balanceOf(owner);

      expect(ownerBalance.toString()).toBe(TOTAL_SUPPLY.toString());
    });

    it('creates a uniswap WETH pair', async () => {
      const { sut } = await makeSut();

      const uniswapV2WETHPair = await sut.uniswapV2WETHPair();

      expect(uniswapV2WETHPair).toBe(pairAddress.toString());
    });

    it('creates a uniswap router', async () => {
      const { sut, mockUniswapRouter02 } = await makeSut();

      const uniswapV2Router = await sut.uniswapV2Router();

      expect(uniswapV2Router).toBe(mockUniswapRouter02.address);
    });

    it('allows the only the owner to exclude an account from rewards, verify that it is excluded and then include it back to get rewards', async () => {
      const { sut } = await makeSut();

      const isRecipientExcludedFromRewards01 = await sut.isExcludedFromRewards(recipient);

      // By default the recipient is not excluded from rewards
      expect(isRecipientExcludedFromRewards01).toBe(false);

      // Only the owner can exclude people from rewards
      await expectRevert(
        sut.excludeFromReward(recipient, { from: other }),
        'Ownable: caller is not the owner'
      );

      // Owner excludes the recipient from rewards
      await sut.excludeFromReward(recipient, { from: owner });

      // Owner cannot exclude an account that is already excluded
      await expectRevert(
        sut.excludeFromReward(recipient, { from: owner }),
        'This account is already excluded from receiving rewards.'
      );

      const isRecipientExcludedFromRewards02 = await sut.isExcludedFromRewards(recipient);

      // This confirms accounts can be excluded from rewards
      expect(isRecipientExcludedFromRewards02).toBe(true);

      const initialBalance = 10000000n;

      // Transfer an initial balance to the recipient
      await sut.transfer(recipient, initialBalance, { from: owner });

      // Transfer a large amount of tokens to a third account (other) to see if recipient gets any rewards
      await sut.transfer(other, TOTAL_SUPPLY / 2n, { from: owner });

      // Since the owner does not pay fees. It is needed for another account to make a large transfer
      await sut.transfer(recipient2, MAX_TX_AMOUNT, { from: other });

      const balanceOfRecipient01 = await sut.balanceOf(recipient);

      // If the balance after a large transaction equals the initial balance, it shows the recipient is excluded from rewards.
      expect(balanceOfRecipient01.toString()).toBe(initialBalance.toString());

      // Only the owner can include people in rewards
      await expectRevert(
        sut.includeInRewards(recipient, { from: other }),
        'Ownable: caller is not the owner'
      );

      await sut.includeInRewards(recipient, { from: owner });

      // Prevents the owner to add an account in rewards that is already getting rewards.
      await expectRevert(
        sut.includeInRewards(recipient, { from: owner }),
        'This account is already receiving rewards.'
      );

      // Another large transaction to see if the recipient will get rewarded this time, after the owner included him back
      await sut.transfer(recipient2, MAX_TX_AMOUNT, { from: other });

      const balanceOfRecipient02 = await sut.balanceOf(recipient);

      // If the recipient balance increased from a transaction he did not partake. it means that now he can get rewards again
      expect(BigInt(balanceOfRecipient02.toString())).toBeGreaterThan(initialBalance);
    });
    it('rewards holders from third party transactions', async () => {
      const { sut } = await makeSut();

      const initialBalance = 10000000n;

      // Transfer an initial balance to the recipient
      await sut.transfer(recipient, initialBalance, { from: owner });

      // Transfer a large amount of tokens to a third account (other) to see if recipient gets any rewards
      await sut.transfer(other, TOTAL_SUPPLY / 2n, { from: owner });

      // Since the owner does not pay fees. We need tod o one more transaction between accounts who pay fees
      await sut.transfer(recipient2, MAX_TX_AMOUNT, { from: other });

      const finalBalanceOfRecipient = await sut.balanceOf(recipient);

      // If the balance after a large transaction (he/she did not participate) is higher than the initial balance. It means he got rewarded.
      expect(BigInt(finalBalanceOfRecipient.toString()) > initialBalance).toBe(true);
    });
    it('allows the owner to transfer without paying fees', async () => {
      const { sut } = await makeSut();

      const transferAmount = TOTAL_SUPPLY / 2n;

      await sut.transfer(recipient, transferAmount, { from: owner });

      const balanceOfRecipient = await sut.balanceOf(recipient);

      // If the balance of the recipient is the same as the amount sent by the owner. It means no tax has been paid.
      expect(balanceOfRecipient.toString()).toBe(transferAmount.toString());
    });
    it('normal users pay fees on transactions', async () => {
      const { sut } = await makeSut();

      const transferAmount = TOTAL_SUPPLY / 2n;

      // Give recipient (normal account) an initial balance
      await sut.transfer(recipient, transferAmount, { from: owner });

      await sut.transfer(other, MAX_TX_AMOUNT, { from: recipient });

      const balanceOfOther = await sut.balanceOf(other);

      // If the other account received less than the recipient sent. It means the recipient paid a tax
      expect(BigInt(balanceOfOther.toString())).toBeLessThan(MAX_TX_AMOUNT);
    });
    it(`prevents normal users to transfer more than the maximum amount of ${MAX_TX_AMOUNT}`, async () => {
      const { sut } = await makeSut();

      const transferAmount = TOTAL_SUPPLY / 2n;

      // The owner can transfer as much as he wants
      await sut.transfer(recipient, transferAmount, { from: owner });

      await expectRevert(
        sut.transfer(other, transferAmount, { from: recipient }),
        'Transfer amount exceeds the maxTxAmount.'
      );
    });
    it('allows the owner to set a new maximum transaction amount', async () => {
      const { sut } = await makeSut();

      const transferAmount = TOTAL_SUPPLY / 2n;

      // Give recipient (normal account) tokens.
      await sut.transfer(recipient, transferAmount, { from: owner });

      const newMaxTxAmount = MAX_TX_AMOUNT * 20n;

      await expectRevert(
        sut.transfer(other, newMaxTxAmount, { from: recipient }),
        'Transfer amount exceeds the maxTxAmount.'
      );

      // Only the owner can set a new max transfer amount
      await expectRevert(
        sut.setMaxTransferAmount(10, { from: recipient }),
        'Ownable: caller is not the owner'
      );

      sut.setMaxTransferAmount(10, { from: owner });

      const contractNewMaxAmount = await sut.maxTxAmount();

      expect(contractNewMaxAmount.toString()).toEqual(((TOTAL_SUPPLY * 10n) / 100n).toString());

      // now the recipient (normal account) can transfer a larger amount
      return expect(sut.transfer(other, newMaxTxAmount, { from: recipient })).resolves.toBeTruthy();
    });
    it('allows the owner to exclude accounts from paying fees and include them again', async () => {
      const { sut } = await makeSut();

      const transferAmount = TOTAL_SUPPLY / 2n;

      // Give recipient (normal account) tokens.
      await sut.transfer(recipient, transferAmount, { from: owner });

      await sut.transfer(recipient2, MAX_TX_AMOUNT, { from: recipient });

      const recipient2Balance = await sut.balanceOf(recipient2);

      // The recipient2 received less tokens that were sent from recipient1, which means a tax was applied
      expect(BigInt(recipient2Balance.toString())).toBeLessThan(MAX_TX_AMOUNT);

      // Only the owner can exclude users from paying fees
      await expectRevert(
        sut.excludeFromFees(recipient, { from: other }),
        'Ownable: caller is not the owner'
      );

      // Exclude recipient to pay for fees
      await sut.excludeFromFees(recipient, { from: owner });

      // This transaction should be exempt from fees
      await sut.transfer(other, MAX_TX_AMOUNT, { from: recipient });

      const otherBalance = await sut.balanceOf(other);

      expect(otherBalance.toString()).toBe(MAX_TX_AMOUNT.toString());

      // Only the owner can include accounts back to fees
      await expectRevert(
        sut.includeInFees(recipient, { from: other }),
        'Ownable: caller is not the owner'
      );

      // recipient is no longer exempt from fees
      await sut.includeInFees(recipient, { from: owner });

      await sut.transfer(other2, MAX_TX_AMOUNT, { from: recipient });

      const other2Balance = await sut.balanceOf(other2);

      // The recipient paid a tax when he transferred to the other2 account
      expect(BigInt(other2Balance.toString())).toBeLessThan(MAX_TX_AMOUNT);
    });
    it('allows an allowance to be increased by the owner', async () => {
      const { sut } = await makeSut();

      // Owner gives an allowance to the recipient of the MAX_TX_AMOUNT
      await sut.approve(recipient, MAX_TX_AMOUNT, { from: owner });

      const recipientAllowance01 = await sut.allowance(owner, recipient);

      expect(recipientAllowance01.toString()).toBe(MAX_TX_AMOUNT.toString());

      await sut.increaseAllowance(recipient, MAX_TX_AMOUNT, { from: owner });

      const recipientAllowance02 = await sut.allowance(owner, recipient);

      expect(recipientAllowance02.toString()).toBe((MAX_TX_AMOUNT * 2n).toString());
    });
    it('allows an allowance to be decreased by the owner', async () => {
      const { sut } = await makeSut();

      // Owner gives an allowance to the recipient of the MAX_TX_AMOUNT
      await sut.approve(recipient, MAX_TX_AMOUNT, { from: owner });

      const recipientAllowance01 = await sut.allowance(owner, recipient);

      expect(recipientAllowance01.toString()).toBe(MAX_TX_AMOUNT.toString());

      await sut.decreaseAllowance(recipient, MAX_TX_AMOUNT / 2n, { from: owner });

      const recipientAllowance02 = await sut.allowance(owner, recipient);

      expect(recipientAllowance02.toString()).toBe((MAX_TX_AMOUNT - MAX_TX_AMOUNT / 2n).toString());
    });
    it('shows the correct fees paid by users', async () => {
      const { sut } = await makeSut();

      // Owner does not pay fees
      await sut.transfer(recipient, TOTAL_SUPPLY / 2n, { from: owner });

      const totalFees01 = await sut.totalFees();

      expect(totalFees01.toString()).toBe('0');

      await sut.transfer(other, MAX_TX_AMOUNT, { from: recipient });

      const totalFees02 = await sut.totalFees();

      expect(totalFees02.toString()).toBe(((MAX_TX_AMOUNT * 10n) / 100n / 2n).toString());
    });
    it('allows a user to airdrop to all users', async () => {
      const { sut } = await makeSut();

      await sut.transfer(recipient, MAX_TX_AMOUNT, { from: owner });

      await sut.transfer(recipient2, MAX_TX_AMOUNT, { from: owner });

      const ownerBalance1 = await sut.balanceOf(owner);

      await sut.deliver(MAX_TX_AMOUNT * 2n, { from: owner });

      const [recipientBalance, recipient2Balance, ownerBalance2] = await Promise.all([
        sut.balanceOf(recipient),
        sut.balanceOf(recipient2),
        sut.balanceOf(owner),
      ]);

      // If their balance increased it means they got an airdrop from the owner
      expect(BigInt(recipientBalance.toString())).toBeGreaterThan(MAX_TX_AMOUNT);
      expect(BigInt(recipient2Balance.toString())).toBeGreaterThan(MAX_TX_AMOUNT);
      // Owner loses more tokens after the transfer proving that he air dropped to the others
      expect(BigInt(ownerBalance1.toString())).toBeGreaterThan(BigInt(ownerBalance2.toString()));
    });
    it('adds liquidity if it has the minimum number of tokens and the liquidity event has been enabled', async () => {
      const { sut } = await makeSut();

      await sut.transfer(recipient, TOTAL_SUPPLY, { from: owner });

      const contractBalance01 = await sut.balanceOf(sut.address);

      // Owner does not pay any liquidity fees so contract still has 0 tokens
      expect(contractBalance01.toString()).toBe('0');

      // Remove the max cap amount to easily test the liquidity event
      await sut.setMaxTransferAmount(100, { from: owner });

      await sut.transfer(
        recipient2,
        // Minimum number of tokens to trigger the liquidity event * 20.
        500000n * 10n ** 6n * 10n ** 9n * 20n,
        {
          from: recipient,
        }
      );

      const isSwapAndLiquifyingEnabled01 = await sut.isSwapAndLiquifyingEnabled();

      expect(isSwapAndLiquifyingEnabled01).toBe(false);

      const transferReceipt02 = await sut.transfer(
        recipient2,
        // Minimum number of tokens to trigger the liquidity event * 20.
        1n,
        {
          from: recipient,
        }
      );

      expectNoEvent(transferReceipt02, 'SwapAndLiquefy');

      await expectRevert(
        sut.setSwapAndLiquifyingState(true, {
          from: other,
        }),
        'Ownable: caller is not the owner'
      );

      const setSwapANdLiquifyingStateReceipt = await sut.setSwapAndLiquifyingState(true, {
        from: owner,
      });

      expectEvent(setSwapANdLiquifyingStateReceipt, 'SwapAndLiquefyStateUpdate', { state: true });

      const isSwapAndLiquifyingEnabled02 = await sut.isSwapAndLiquifyingEnabled();

      expect(isSwapAndLiquifyingEnabled02).toBe(true);

      const transferReceipt03 = await sut.transfer(recipient2, 1n, {
        from: recipient,
      });

      const contractBalance02 = await sut.balanceOf(sut.address.toString());

      expect(BigInt(contractBalance02.toString())).toBeGreaterThan(500000n * 10n ** 6n * 10n ** 9n);

      // This is triggered because the owner transferred a large amount to meet the minimal requirement and liquifying event is active
      expectEvent(transferReceipt03, 'SwapAndLiquefy');
    });
    it('does not trigger the swap and liquefy event if the sender is the uniswapv2pair', async () => {
      const { sut } = await makeSut();

      await sut.transfer(recipient, TOTAL_SUPPLY, { from: owner });

      // Remove the max cap amount to easily test the liquidity event
      await sut.setMaxTransferAmount(100, { from: owner });

      await sut.setSwapAndLiquifyingState(true, {
        from: owner,
      });

      await sut.transfer(pairAddress, TOTAL_SUPPLY, { from: recipient });

      const receipt = await sut.transfer(other, 1n, { from: pairAddress });

      expectNoEvent(receipt, 'SwapAndLiquefy');
    });
    it('correctly transfer from excluded to normal account', async () => {
      const { sut } = await makeSut();

      await sut.excludeFromReward(recipient, { from: owner });

      await sut.transfer(recipient, MAX_TX_AMOUNT * 2n, { from: owner });

      await sut.transfer(other, MAX_TX_AMOUNT, { from: recipient });

      const recipientBalance01 = await sut.balanceOf(recipient);

      await sut.includeInRewards(recipient, { from: owner });

      const recipientBalance02 = await sut.balanceOf(recipient);

      expect(BigInt(recipientBalance01.toString())).toBeLessThan(MAX_TX_AMOUNT * 2n);
      expect(BigInt(recipientBalance02.toString())).toBeLessThan(MAX_TX_AMOUNT * 2n);
    });
    it('correctly transfer from normal account to excluded', async () => {
      const { sut } = await makeSut();

      await sut.transfer(recipient, MAX_TX_AMOUNT, { from: owner });

      await sut.excludeFromReward(other, { from: owner });

      await sut.transfer(other, MAX_TX_AMOUNT, { from: recipient });

      await sut.includeInRewards(other, { from: owner });

      const otherBalance = await sut.balanceOf(other);

      // If the same condition holds true for the recipient balance after the owner switch him back to receiving rewards it means the transfer was correctly done
      expect(otherBalance.toString()).not.toBe('0');
    });
    it.only('correctly transfer between two excluded accounts', async () => {
      const { sut } = await makeSut();

      await sut.excludeFromReward(recipient, { from: owner });

      await sut.excludeFromReward(owner, { from: owner });

      await sut.transfer(recipient, MAX_TX_AMOUNT, { from: owner });

      await sut.transfer(other, 1000n, { from: recipient });

      const recipientBalance01 = await sut.balanceOf(recipient);

      await sut.includeInRewards(recipient, { from: owner });

      const recipientBalance02 = await sut.balanceOf(recipient);

      expect(BigInt(recipientBalance01.toString())).toBeLessThan(MAX_TX_AMOUNT);
      expect(BigInt(recipientBalance02.toString())).toBeLessThan(MAX_TX_AMOUNT);
    });
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
