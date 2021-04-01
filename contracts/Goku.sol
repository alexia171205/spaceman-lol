// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./interfaces/IERC20.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IUniswapV2Factory.sol";
import "./lib/Context.sol";
import "./lib/Ownable.sol";
import "./lib/Address.sol";
import "./GokuMetaData.sol";

contract Goku is Ownable, GokuMetaData {
	event SwapAndLiquefy(
		uint256 tokensSwapped,
		uint256 ethReceived,
		uint256 tokensIntoLiqudity
	);

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
	 *@dev The liquidity fee users will incur upon selling tokens. 5 percent of the principal.
	 */
	uint8 public liquidityFee = 5;

	/**
	 *@dev The wallet which holds the account balance in reflections.
	 */
	mapping(address => uint256) private _reflectionBalance;

	/**
	 *@dev The address of this contract.
	 */
	address private _contractAddress;

	/**
	 *@dev Contains the allowances a parent account has provided to children accounts in reflections;
	 */
	mapping(address => mapping(address => uint256)) private _allowances;

	/**
	 *@dev A maximum amount that can be transfered at once. Which is equivalent to 1% of the total supply.
	 */
	uint256 public maxTxAmount = 10000000 * 10**6 * 10**9;

	/**
	 *@dev Number of tokens needed to provide liquidity to the pool
	 */
	uint256 private _numberTokensSellToAddToLiquidity = 500000 * 10**6 * 10**9;

	/**
	 *@dev State indicating that we are in a liquefaction process to prevent stacking liquefaction events.
	 */
	bool swapAndLiquefactionInProgress;

	/**
	 *@dev Variable to allow the owner to enable or disable liquefaction  events
	 */
	bool public isSwapAndLiquefactionEnabled = true;

	IUniswapV2Router02 public immutable uniswapV2Router;
	address public immutable uniswapV2WETHPair;

	constructor(address _factory) {
		/**
		 *@dev Stores the address of the contract upon it's creation.
		 */
		_contractAddress = address(this);

		/**
		 *@dev Gives all the reflection to the deplyer (the first owner) of the contract upon creation.
		 */
		_reflectionBalance[_msgSender()] = _reflectionSupply;

		// Tells solidity this address follows the IUniswapV2Router interface
		IUniswapV2Router02 _uniswapV2Router = IUniswapV2Router02(_factory);

		// Creates a pair between our token and WETH and saves the address in a state variable
		uniswapV2WETHPair = IUniswapV2Factory(_uniswapV2Router.factory())
			.createPair(address(this), _uniswapV2Router.WETH());

		// Saves the UniswapV2Router in a state variable
		uniswapV2Router = _uniswapV2Router;
	}

	/**
	 *@dev Tell the contract we are swapping
	 */
	modifier lockTheSwap {
		swapAndLiquefactionInProgress = true;
		_;
		swapAndLiquefactionInProgress = false;
	}

	/**
	 *@dev check if the address is this contract address.
	 */
	function _isThis(address x) private view returns (bool) {
		require(x.isContract(), "This address needs to be a contract");
		return x == _contractAddress;
	}

	/**
	 *@dev Returns the rate betweenthe total reflections and the total tokens.
	 */
	function _getRate() private view returns (uint256) {
		return _reflectionSupply / _tokenSupply;
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
	 *@dev Updates the value of the total fees paid and reduces the reflection supply to reward all holders.
	 */
	function _reflectFee(uint256 tokenFee) private {
		_reflectionSupply -= _reflectionFromToken(tokenFee);
		_totalTokenFees += tokenFee;
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
	 *@dev returns the total supply of tokens.
	 */
	function totalSupply() external view override returns (uint256) {
		return _tokenSupply;
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
	 *@dev returns the total tokens a user holds. It first finds the reflections and converts to tokens to reflect the rewards the user has accrued over time.
	 */
	function balanceOf(address account) public view override returns (uint256) {
		return _tokenFromReflection(_reflectionBalance[account]);
	}

	/**
	 *@dev This is used to recieve ETH from pancackeSwapv2Router when swaping.
	 */
	receive() external payable {}

	/**
	 *@dev Stores the liquidity fee in the contract's address
	 */
	function _takeLiquidity(uint256 amount) private {
		_reflectionBalance[address(this)] =
			_reflectionBalance[address(this)] +
			(amount * _getRate());
	}

	/**
	 *@dev Allows a user to transfer his reflections to another user. It taxes the sender by the tax fee while inflating the all tokens value.
	 */
	function _transferToken(
		address sender,
		address recipient,
		uint256 amount
	) private {
		// Takes money from sender
		_reflectionBalance[sender] =
			_reflectionBalance[sender] -
			_reflectionFromToken(amount);

		// Calculates transaction fee
		uint256 tFee = _calculateTaxFee(amount);

		// Calculates the liquidity fee
		uint256 lFee = _calculateLiquidityFee(amount);

		// Final amount for the recipient
		uint256 finalAmount = amount - tFee - lFee;

		// Sends the final amount to the recipient
		_reflectionBalance[recipient] =
			_reflectionBalance[recipient] +
			_reflectionFromToken(finalAmount);

		// Stores the liquidityFee in the contract
		_takeLiquidity(_reflectionFromToken(liquidityFee));

		// Rewards all users with the transaction fee
		_reflectFee(taxFee);

		emit Transfer(sender, recipient, finalAmount);
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

		// Condition 1: Make sure the contract has the enough tokens to liquefy
		// Condition 2: We are not in a liquefication event
		// Condition 3: Liquification is enabled
		// Condition 4: It is not the uniswapPair that is sending tokens
		if (
			balanceOf(address(this)) >= _numberTokensSellToAddToLiquidity &&
			!swapAndLiquefactionInProgress &&
			isSwapAndLiquefactionEnabled &&
			sender != uniswapV2WETHPair
		) _swapAndLiquefy();

		_transferToken(sender, recipient, amount);
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
			"The burn address is not allowed to make this operation"
		);
		require(
			owner != address(0),
			"The burn address is not allowed to make this operation"
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
