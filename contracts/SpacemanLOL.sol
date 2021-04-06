// SPDX-License-Identifier: MIT

pragma solidity 0.8.3;

import "./interfaces/IERC20.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IUniswapV2Factory.sol";
import "./lib/Context.sol";
import "./lib/Ownable.sol";
import "./lib/Address.sol";
import "./SpacemanLOLMetaData.sol";

contract SpacemanLOL is Ownable, SpacemanLOLMetaData {
	event SwapAndLiquefy(
		uint256 tokensSwapped,
		uint256 ethReceived,
		uint256 tokensIntoLiqudity
	);
	event SwapAndLiquefyStateUpdate(bool state);

	/**
	 *@dev Adds the Address library utility methods to the type {address}.
	 */
	using Address for address;

	/**
	 *@dev the maximum uint256 value in solidity, which is used to convert the total supply of tokens to reflections for the reward mechanism.
	 */
	uint256 private constant MAX_INT_VALUE = type(uint256).max;

	uint256 private _tokenSupply = 1000000000 * 10**6 * 10**9;
	/**
	 *@dev Convert the total supply to reflections with perfect rouding using the maximum uint256 as the numerator.
	 */
	uint256 private _reflectionSupply = (MAX_INT_VALUE -
		(MAX_INT_VALUE % _tokenSupply));

	/**
	 *@dev The total amount of fees paid by the users.
	 */
	uint256 private _totalTokenFees;

	/**
	 *@dev The transaction fee users will incur upon selling the token. 5 percent of the principal.
	 */
	uint8 public taxFee = 5;
	/**
	 *@dev This is used to save the previous fee.
	 */
	uint8 private _previousTaxFee = taxFee;

	/**
	 *@dev The liquidity fee users will incur upon selling tokens. 5 percent of the principal.
	 */
	uint8 public liquidityFee = 5;
	/**
	 *@dev This is used to save the previous fee.
	 */
	uint8 private _previousLiquidityFee = liquidityFee;

	/**
	 *@dev The wallet which holds the account balance in reflections.
	 */
	mapping(address => uint256) private _reflectionBalance;

	/**
	 *@dev The wallet which holds the balance for excluded accounts (accounts that do not receive rewards).
	 */
	mapping(address => uint256) private _tokenBalance;

	/**
	 *@dev Accounts which are excluded from rewards
	 */
	mapping(address => bool) private _isExcludedFromRewards;

	/**
	 *@dev Accounts which are excluded from paying txs fees.
	 */
	mapping(address => bool) private _isExcludedFromFees;

	/**
	 *@dev Accounts which are excluded from rewards
	 */
	address[] private _excluded;

	/**
	 *@dev Contains the allowances a parent account has provided to children accounts in reflections;
	 */
	mapping(address => mapping(address => uint256)) private _allowances;

	/**
	 *@dev A maximum amount that can be transfered at once. Which is equivalent to 1% of the total supply.
	 */
	uint256 public maxTxAmount = 5000000 * 10**6 * 10**9;

	/**
	 *@dev Number of tokens needed to provide liquidity to the pool
	 */
	uint256 private _numberTokensSellToAddToLiquidity = 500000 * 10**6 * 10**9;

	/**
	 *@dev State indicating that we are in a liquefaction process to prevent stacking liquefaction events.
	 */
	bool swapAndLiquifyingInProgress;

	/**
	 *@dev Variable to allow the owner to enable or disable liquefaction  events
	 */
	bool public isSwapAndLiquifyingEnabled = false;

	/**
	 *@dev Variable to control universal trading for the token
	 */
	bool public isTradingEnabled = false;

	IUniswapV2Router02 public immutable uniswapV2Router;
	address public immutable uniswapV2WETHPair;

	constructor(address routerAddress) {
		/**
		 *@dev Gives all the reflection to the deplyer (the first owner) of the contract upon creation.
		 */
		_reflectionBalance[_msgSender()] = _reflectionSupply;

		// Tells solidity this address follows the IUniswapV2Router interface
		IUniswapV2Router02 _uniswapV2Router = IUniswapV2Router02(routerAddress);

		// Creates a pair between our token and WETH and saves the address in a state variable
		uniswapV2WETHPair = IUniswapV2Factory(_uniswapV2Router.factory())
			.createPair(address(this), _uniswapV2Router.WETH());

		// Saves the UniswapV2Router in a state variable
		uniswapV2Router = _uniswapV2Router;

		_isExcludedFromFees[owner()] = true;
		_isExcludedFromFees[address(this)] = true;
	}

	/**
	 *@dev Tell the contract we are swapping
	 */
	modifier lockTheSwap {
		swapAndLiquifyingInProgress = true;
		_;
		swapAndLiquifyingInProgress = false;
	}

	/**
	 *@dev returns the total supply of tokens.
	 */
	function totalSupply() external view override returns (uint256) {
		return _tokenSupply;
	}

	function _getCurrentSupply() private view returns (uint256, uint256) {
		uint256 totalReflection = _reflectionSupply;
		uint256 totalTokens = _tokenSupply;
		// Iterates to all excluded accounts
		for (uint256 i; i < _excluded.length; i++) {
			if (
				// Makes sure that no single account has more tokens than the total possible amount of tokens. And does the same for reflections.
				_reflectionBalance[_excluded[i]] > _reflectionSupply ||
				_tokenBalance[_excluded[i]] > _tokenSupply
			) return (_reflectionSupply, _tokenSupply);
			// Remove the excluded accounts reflections when calculating the current supply.
			totalReflection =
				totalReflection -
				_reflectionBalance[_excluded[i]];
			// Remove the excluded accounts tokens when calculating the current supply.
			totalTokens = totalTokens - _tokenBalance[_excluded[i]];
		}

		return
			// Makes sure token supply does not overflow
			_reflectionSupply / _tokenSupply > totalReflection
				? (_reflectionSupply, _tokenSupply)
				: (totalReflection, totalTokens);
	}

	/**
	 *@dev Confirms if an account is excluded from rewards
	 */
	function isExcludedFromRewards(address account) public view returns (bool) {
		return _isExcludedFromRewards[account];
	}

	function isExcludedFromFees(address account) external view returns (bool) {
		return _isExcludedFromFees[account];
	}

	/**
	 *@dev Returns the rate betweenthe total reflections and the total tokens.
	 */
	function _getRate() private view returns (uint256) {
		(uint256 currentReflections, uint256 currentTokens) =
			_getCurrentSupply();
		return currentReflections / currentTokens;
	}

	/**
	 *@dev Converts an amount of tokens to reflections using the current rate.
	 */
	function _reflectionFromToken(uint256 amount)
		private
		view
		returns (uint256)
	{
		require(
			_tokenSupply >= amount,
			"You cannot own more tokens than the total token supply"
		);
		return amount * _getRate();
	}

	/**
	 *@dev Converts an amount of reflections to tokens using the current rate.
	 */
	function _tokenFromReflection(uint256 reflectionAmount)
		private
		view
		returns (uint256)
	{
		require(
			_reflectionSupply >= reflectionAmount,
			"Cannot have a personal reflection amount larger than total reflection"
		);
		return reflectionAmount / _getRate();
	}

	/**
	 *@dev returns the total tokens a user holds. It first finds the reflections and converts to tokens to reflect the rewards the user has accrued over time.
	 * if the account does not receive rewards. It returns the balance from the token balance.
	 */
	function balanceOf(address account) public view override returns (uint256) {
		return
			_isExcludedFromRewards[account]
				? _tokenBalance[account]
				: _tokenFromReflection(_reflectionBalance[account]);
	}

	function totalFees() external view returns (uint256) {
		return _totalTokenFees;
	}

	/**
	 *@dev Excluded an account from getting rewards.
	 */
	function excludeFromReward(address account) external onlyOwner() {
		require(
			!_isExcludedFromRewards[account],
			"This account is already excluded from receiving rewards."
		);

		// If the account has reflections (means it has rewards), convert it to tokens.
		if (_reflectionBalance[account] > 0) {
			_tokenBalance[account] = _tokenFromReflection(
				_reflectionBalance[account]
			);
		}

		_isExcludedFromRewards[account];
		_excluded.push(account);
	}

	function includeInRewards(address account) external onlyOwner() {
		require(
			_isExcludedFromRewards[account],
			"This account is already receiving rewards."
		);
		// Iterate to all accounts until we found the desired account.
		for (uint256 i = 0; i < _excluded.length; i++) {
			if (_excluded[i] == account) {
				// Remove the account from the excluded array by replacing it with the latest account in the array
				_excluded[i] = _excluded[_excluded.length - 1];
				// Remove it's token balance. Because now he will receive reflections.
				_tokenBalance[account] = 0;
				_isExcludedFromRewards[account] = false;
				// Remove the duplicate last account to keep this a unique set.
				_excluded.pop();
				// Stop the loop.
				break;
			}
		}
	}

	function excludeFromFree(address account) external onlyOwner() {
		_isExcludedFromFees[account] = true;
	}

	function includeInFees(address account) external onlyOwner() {
		_isExcludedFromRewards[account] = false;
	}

	/**
	 *@dev It allows a non excluded account to airdrop to other users.
	 */
	function deliver(uint256 amount) public {
		address sender = _msgSender();
		require(
			!_isExcludedFromRewards[sender],
			"Accounts without rewards cannot do an air drop"
		);
		uint256 reflectionAmount = _reflectionFromToken(amount);
		_reflectionBalance[sender] =
			_reflectionBalance[sender] -
			reflectionAmount;
		_reflectionSupply -= reflectionAmount;
		_totalTokenFees += amount;
	}

	/**
	 *@dev Updates the tax fee. Only the owner can use it.
	 */
	function setTaxFeePercent(uint8 fee) external onlyOwner() {
		taxFee = fee;
	}

	/**
	 *@dev Updates the liquidity fee. Only the owner can use it.
	 */
	function setLiquidityFeePercent(uint8 fee) external onlyOwner() {
		liquidityFee = fee;
	}

	/**
	 *@dev Removes all fees and saves them to be reinstated at a later date.
	 */
	function removeAllFees() private {
		if (taxFee == 0 && liquidityFee == 0) return;

		_previousTaxFee = taxFee;
		_previousLiquidityFee = liquidityFee;

		taxFee = 0;
		liquidityFee = 0;
	}

	/**
	 *@dev Restores the fees to their previous values.
	 */
	function restoreAllFees() private {
		taxFee = _previousTaxFee;
		liquidityFee = _previousLiquidityFee;
	}

	/**
	 *@dev Update the maximum transfer amount. Calculate sit from a percentage amount. Only the owner of the contract can call it.
	 */
	function setMaxTransferAmount(uint256 percent) external onlyOwner() {
		maxTxAmount = (_tokenSupply * percent) / 100;
	}

	/**
	 *@dev Gives the owner of the contract control if the logic to add liquidity to the pool is enabled or not.
	 */
	function setSwapAndLiquifyingState(bool state) external onlyOwner() {
		isSwapAndLiquifyingEnabled = state;
		emit SwapAndLiquefyStateUpdate(state);
	}

	/**
	 *@dev Calculates a fee final amount based on a ratio.
	 *important This funciton only works with values based on token supply and NOT reflection supply.
	 */
	function _calculateFee(uint256 amount, uint8 fee)
		private
		pure
		returns (uint256)
	{
		return (amount * fee) / 100;
	}

	/**
	 *@dev Returns the final amount for the tax.
	 *important This function only works with values based on token supply and NOT reflection supply.
	 */
	function _calculateTaxFee(uint256 amount) private view returns (uint256) {
		return _calculateFee(amount, taxFee);
	}

	/**
	 *@dev Returns the final amount for the liquidity tax.
	 *important This function only works with values based on token supply and NOT reflection supply.
	 */
	function _calculateLiquidityFee(uint256 amount)
		private
		view
		returns (uint256)
	{
		return _calculateFee(amount, liquidityFee);
	}

	/**
	 *@dev Updates the value of the total fees paid and reduces the reflection supply to reward all holders.
	 */
	function _reflectFee(uint256 tokenFee) private {
		_reflectionSupply -= _reflectionFromToken(tokenFee);
		_totalTokenFees += tokenFee;
	}

	/**
	 *@dev Stores the liquidity fee in the contract's address
	 */
	function _takeLiquidity(uint256 amount) private {
		_reflectionBalance[address(this)] =
			_reflectionBalance[address(this)] +
			_reflectionFromToken(amount);
		if (_isExcludedFromRewards[address(this)])
			_tokenBalance[address(this)] =
				_tokenBalance[address(this)] +
				amount;
	}

	/**
	 *@dev This is used to recieve ETH from pancackeSwapv2Router when swaping.
	 */
	receive() external payable {}

	// Transfer between Excluded -> Not Excluded
	function _transferFromExcluded(
		address sender,
		address recipient,
		uint256 amount
	) private {
		// Because this account comes from a excluded account. We need to reduce its balance in tokens and reflections.
		_tokenBalance[sender] = _tokenBalance[sender] - amount;
		_reflectionBalance[sender] =
			_reflectionBalance[sender] -
			_reflectionFromToken(amount);

		// Calculates transaction fee
		uint256 tTax = _calculateTaxFee(amount);

		// Calculates the liquidity fee
		uint256 lFee = _calculateLiquidityFee(amount);

		uint256 finalAmount = amount - tTax - lFee;

		// Since the recipient is not excluded. We only need to update its reflection balance.
		_reflectionBalance[recipient] =
			_reflectionBalance[recipient] +
			_reflectionFromToken(finalAmount);

		_takeLiquidity(lFee);
		_reflectFee(tTax);

		emit Transfer(sender, recipient, finalAmount);
	}

	// Transfer between Not Exluded -> Excluded
	function _transferToExcluded(
		address sender,
		address recipient,
		uint256 amount
	) private {
		// Because this account comes from a non excluded account. We only need to reduce it's reflections.
		_reflectionBalance[sender] =
			_reflectionBalance[sender] -
			_reflectionFromToken(amount);

		// Calculates transaction fee
		uint256 tTax = _calculateTaxFee(amount);

		// Calculates the liquidity fee
		uint256 lFee = _calculateLiquidityFee(amount);

		uint256 finalAmount = amount - tTax - lFee;

		// Since the recipient is excluded. We need to update both his/her reflections and tokens.
		_tokenBalance[recipient] = _tokenBalance[recipient] + finalAmount;
		_reflectionBalance[recipient] =
			_reflectionBalance[recipient] +
			_reflectionFromToken(finalAmount);

		_takeLiquidity(lFee);
		_reflectFee(tTax);

		emit Transfer(sender, recipient, finalAmount);
	}

	// Transfer between Not Exluded -> Not Excluded
	function _transferStandard(
		address sender,
		address recipient,
		uint256 amount
	) private {
		// Because this account comes from a non excluded account. We only need to reduce it's reflections.
		_reflectionBalance[sender] =
			_reflectionBalance[sender] -
			_reflectionFromToken(amount);

		// Calculates transaction fee
		uint256 tTax = _calculateTaxFee(amount);

		// Calculates the liquidity fee
		uint256 lFee = _calculateLiquidityFee(amount);

		uint256 finalAmount = amount - tTax - lFee;

		// Since the recipient is also not excluded. We only need to update his reflections.
		_reflectionBalance[recipient] =
			_reflectionBalance[recipient] +
			_reflectionFromToken(finalAmount);

		_takeLiquidity(lFee);
		_reflectFee(tTax);

		emit Transfer(sender, recipient, finalAmount);
	}

	// Transfer between Exluded -> Excluded
	function _transferBothExcluded(
		address sender,
		address recipient,
		uint256 amount
	) private {
		// Because this account comes from a excluded account. We only need to reduce it's reflections and tokens.
		_tokenBalance[sender] = _tokenBalance[sender] - amount;
		_reflectionBalance[sender] =
			_reflectionBalance[sender] -
			_reflectionFromToken(amount);

		// Calculates transaction fee
		uint256 tTax = _calculateTaxFee(amount);

		// Calculates the liquidity fee
		uint256 lFee = _calculateLiquidityFee(amount);

		uint256 finalAmount = amount - tTax - lFee;

		// Since the recipient is also  excluded. We need to update his reflections and tokens.
		_tokenBalance[recipient] = _tokenBalance[recipient] + finalAmount;
		_reflectionBalance[recipient] =
			_reflectionBalance[recipient] +
			_reflectionFromToken(finalAmount);

		_takeLiquidity(lFee);
		_reflectFee(tTax);

		emit Transfer(sender, recipient, finalAmount);
	}

	/**
	 *@dev Allows a user to transfer his reflections to another user. It taxes the sender by the tax fee while inflating the all tokens value.
	 */
	function _transferToken(
		address sender,
		address recipient,
		uint256 amount,
		bool removeFees
	) private {
		// If this is a feeless transaction. Remove all fees and store them.
		if (removeFees) removeAllFees();

		if (
			_isExcludedFromRewards[sender] && !_isExcludedFromRewards[recipient]
		) {
			_transferFromExcluded(sender, recipient, amount);
		} else if (
			!_isExcludedFromRewards[sender] && _isExcludedFromRewards[recipient]
		) {
			_transferToExcluded(sender, recipient, amount);
		} else if (
			_isExcludedFromRewards[sender] && _isExcludedFromRewards[recipient]
		) {
			_transferBothExcluded(sender, recipient, amount);
		} else {
			_transferStandard(sender, recipient, amount);
		}

		// Restores all fees if they were disabled.
		if (removeFees) restoreAllFees();
	}

	/**
	 *@dev buys ETH with tokens stored in this contract
	 */
	function _swapTokensForEth(uint256 tokenAmount) private {
		// generate the uniswap pair path of token -> weth
		address[] memory path = new address[](2);
		path[0] = address(this);
		path[1] = uniswapV2Router.WETH();

		_approve(address(this), address(uniswapV2Router), tokenAmount);

		// make the swap
		uniswapV2Router.swapExactTokensForETHSupportingFeeOnTransferTokens(
			tokenAmount,
			0, // accept any amount of ETH
			path,
			address(this),
			block.timestamp
		);
	}

	/**
	 *@dev Adds equal amount of eth and tokens to the ETH liquidity pool
	 */
	function _addLiquidity(uint256 tokenAmount, uint256 ethAmount) private {
		// approve token transfer to cover all possible scenarios
		_approve(address(this), address(uniswapV2Router), tokenAmount);

		// add the liquidity
		uniswapV2Router.addLiquidityETH{ value: ethAmount }(
			address(this),
			tokenAmount,
			0, // slippage is unavoidable
			0, // slippage is unavoidable
			owner(),
			block.timestamp
		);
	}

	function _swapAndLiquefy() private lockTheSwap {
		// split the contract token balance into halves
		uint256 half = _numberTokensSellToAddToLiquidity / 2;
		uint256 otherHalf = _numberTokensSellToAddToLiquidity - half;

		uint256 initialETHContractBalance = address(this).balance;

		// Buys ETH at current token price
		_swapTokensForEth(half);

		// This is to make sure we are only using ETH derived from the liquidity fee
		uint256 ethBought = address(this).balance - initialETHContractBalance;

		// Add liquidity to the pool
		_addLiquidity(otherHalf, ethBought);

		emit SwapAndLiquefy(half, ethBought, otherHalf);
	}

	/**
	 *@dev This function first adds liquidity to the pool, then transfers tokens between accounts
	 */
	function _transfer(
		address sender,
		address recipient,
		uint256 amount
	) private {
		require(
			sender != address(0),
			"ERC20: Sender cannot be the zero address"
		);
		require(
			recipient != address(0),
			"ERC20: Recipient cannot be the zero address"
		);
		require(amount > 0, "Transfer amount must be greater than zero");
		if (sender != owner() && recipient != owner())
			require(
				amount <= maxTxAmount,
				"Transfer amount exceeds the maxTxAmount."
			);

		// If trading is disabled only the owner can transfer tokens.
		if (sender != owner() && !isTradingEnabled) {
			require(isTradingEnabled, "Trading is currently disabled!");
		}

		// Condition 1: Make sure the contract has the enough tokens to liquefy
		// Condition 2: We are not in a liquefication event
		// Condition 3: Liquification is enabled
		// Condition 4: It is not the uniswapPair that is sending tokens
		if (
			balanceOf(address(this)) >= _numberTokensSellToAddToLiquidity &&
			!swapAndLiquifyingInProgress &&
			isSwapAndLiquifyingEnabled &&
			sender != uniswapV2WETHPair
		) _swapAndLiquefy();

		_transferToken(
			sender,
			recipient,
			amount,
			_isExcludedFromFees[sender] || _isExcludedFromFees[recipient]
		);
	}

	/**
	 *@dev Gives allowance to an account
	 */
	function _approve(
		address owner,
		address beneficiary,
		uint256 amount
	) private {
		require(
			beneficiary != address(0),
			"The burn address is not allowed to receive approval for allowances."
		);
		require(
			owner != address(0),
			"The burn address is not allowed to approve allowances."
		);

		_allowances[owner][beneficiary] = amount;
		emit Approval(owner, beneficiary, amount);
	}

	function transfer(address recipient, uint256 amount)
		public
		override
		returns (bool)
	{
		_transfer(_msgSender(), recipient, amount);
		return true;
	}

	function approve(address beneficiary, uint256 amount)
		public
		override
		returns (bool)
	{
		_approve(_msgSender(), beneficiary, amount);
		return true;
	}

	function enableTrading() external onlyOwner() {
		isTradingEnabled = true;
	}

	/**
	 *@dev It allows an account to transfer it's allowance to any other account;
	 */
	function transferFrom(
		address provider,
		address beneficiary,
		uint256 amount
	) public override returns (bool) {
		_transfer(provider, beneficiary, amount);
		_approve(
			provider,
			_msgSender(),
			_allowances[provider][_msgSender()] - amount
		);
		return true;
	}

	/**
	 *@dev Shows the allowance of a beneficiary in tokens.
	 */
	function allowance(address owner, address beneficiary)
		public
		view
		override
		returns (uint256)
	{
		return _allowances[owner][beneficiary];
	}

	/**
	 *@dev Increases the allowance of a beneficiary
	 */
	function increaseAllowance(address beneficiary, uint256 amount)
		external
		returns (bool)
	{
		_approve(
			_msgSender(),
			beneficiary,
			_allowances[_msgSender()][beneficiary] + amount
		);
		return true;
	}

	/**
	 *@dev Decreases the allowance of a beneficiary
	 */
	function decreaseAllowance(address beneficiary, uint256 amount)
		external
		returns (bool)
	{
		_approve(
			_msgSender(),
			beneficiary,
			_allowances[_msgSender()][beneficiary] - amount
		);
		return true;
	}
}
