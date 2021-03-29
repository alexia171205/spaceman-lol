// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./interfaces/IERC20.sol";
import "./interfaces/IPancackeSwapRouter.sol";
import "./lib/Context.sol";
import "./lib/Ownable.sol";
import "./lib/Address.sol";
import "./GokuMetaData.sol";

contract Goku is Ownable, GokuMetaData {
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
	 *@dev The wallet which holds the account balance in reflections.
	 */
	mapping(address => uint256) private _reflectionBalance;

	/**
	 *@dev The address of this contract.
	 */
	address private _contractAddress;

	constructor() {
		/**
		 *@dev Stores the address of the contract upon it's creation.
		 */
		_contractAddress = address(this);

		/**
		 *@dev Gives all the reflection to the deplyer (the first owner) of the contract upon creation.
		 */
		_reflectionBalance[_msgSender()] = _reflectionSupply;
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
	 *@important This funciton only works with values based on token supply and NOT reflection supply.
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
	 *@important This funciton only works with values based on token supply and NOT reflection supply.
	 */
	function _calculateTaxFee(uint256 amount) private view returns (uint256) {
		return _calculateFee(amount, taxFee);
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
	 *@dev Returns the final tax amount and the amount after the tax has been applied.
	 *@important This funciton only works with values based on token supply and NOT reflection supply.
	 */
	function _calculateTax(uint256 amount)
		private
		view
		returns (uint256, uint256)
	{
		uint256 tax = _calculateTaxFee(amount);
		uint256 finalAmount = amount - tax;
		return (tax, finalAmount);
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
	 *@dev returns the total tokens a user holds. It first finds the reflections and converts to tokens to reflect the rewards the user has accrued over time.
	 */
	function balanceOf(address account)
		external
		view
		override
		returns (uint256)
	{
		return _tokenFromReflection(_reflectionBalance[account]);
	}

	/**
	 *@dev This is used to recieve ETH from pancackeSwapv2Router when swaping.
	 */
	receive() external payable {}

	/**
	 *@dev Allows a user to transfer his reflections to another user. It taxes the sender by the tax fee while inflating the all tokens value.
	 */
	function _transfer(
		address sender,
		address recipient,
		uint256 amount
	) private {
		_reflectionBalance[sender] =
			_reflectionBalance[sender] -
			_reflectionFromToken(amount);

		(uint256 tax, uint256 afterTaxAmount) = _calculateTax(amount);

		_reflectionBalance[recipient] =
			_reflectionBalance[recipient] +
			_reflectionFromToken(afterTaxAmount);

		_reflectFee(tax);

		emit Transfer(sender, recipient, afterTaxAmount);
	}

	function transfer(address recipient, uint256 amount)
		public
		override
		returns (bool)
	{
		_transfer(_msgSender(), recipient, amount);
		return true;
	}

	function approve(address spender, uint256 amount)
		public
		override
		returns (bool)
	{
		return true;
	}

	function transferFrom(
		address sender,
		address recipient,
		uint256 amount
	) public override returns (bool) {
		return true;
	}

	function allowance(address owner, address spender)
		public
		view
		override
		returns (uint256)
	{
		return 0;
	}
}
