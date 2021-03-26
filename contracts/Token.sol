// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ERC20.sol";
import "./lib/Ownable.sol";
import "./lib/Address.sol";

contract Token is Ownable, ERC20 {
	using Address for address;

	constructor() {}
}
