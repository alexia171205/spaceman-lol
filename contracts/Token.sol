// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./interfaces/IERC20.sol";
import "./interfaces/IPancackeSwapRouter.sol";
import "./lib/Context.sol";
import "./lib/Ownable.sol";
import "./lib/Address.sol";
import "./TokenMetaData.sol";

contract Token is Ownable, TokeMetaData {
	/**
	 *@dev Adds the Address library utility methods to the type {address}.
	 */
	using Address for address;

	uint256 private constant MAX_INT_VALUE = type(uint256).max;
	uint256 private _tokenSupply = 1000000000 * 10**6 * 10**9;
	uint256 private _reflectionSupply = (MAX_INT_VALUE -
		(MAX_INT_VALUE % _tokenSupply));
	uint256 private _totalTokenFees;

	uint8 public taxFee = 5;

	/**
	 *@dev The wallet which holds the account balance after taxes have been applied.
	 */
	mapping(address => uint256) private _reflectionBalance;

	/**
	 *@dev Maximum number in uint256.
	 */
	uint256 private constant MAX_INT_TYPE = type(uint256).max;

	address private _contractAddress;

	constructor() {
		_contractAddress = address(this);

		/**
		 *@dev Gives all the reflection to the owner of the contract
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
	 *@dev Returns the rate that converts reflection to tokens with inflation.
	 */
	function _getRate() private view returns (uint256) {
		return _reflectionSupply / _tokenSupply;
	}

	/**
	 *@dev Calculates a fee final amount based on a ratio.
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

	function _reflectFee(uint256 tokenFee) private {
		_reflectionSupply -= _tokenFromReflection(tokenFee);
		_totalTokenFees += tokenFee;
	}

	/**
	 *@dev Returns the final tax amount and the amount after the tax has been applied. It works with reflection and token nomination.
	 */
	function _calculateTax(uint256 amount)
		private
		view
		returns (uint256, uint256)
	{
		uint256 tax = _calculateTaxFee(amount);
		uint256 finalAmount = amount - tax;
		return (taxFee, finalAmount);
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
	 *@dev returns the total supply of the token.
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

	function balanceOf(address account)
		external
		view
		override
		returns (uint256)
	{
		return _tokenFromReflection(_reflectionBalance[account]);
	}

	/**
	 *@dev to recieve ETH from pancackeSwapv2Router when swaping
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
