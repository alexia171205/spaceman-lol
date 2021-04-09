<h1 align="center">
    <br>
    Spaceman LOL
    <br>
</h1>
<p align="center">
&nbsp;&nbsp;
  <a href="#wrench-features">Features</a>&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;
  <a href="#rocket-technologies">Technologies</a>&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;
  <a href="#information_source-how-to-use">How to use</a>&nbsp;&nbsp;
</p>

## :wrench: Features

Spaceman LOL  is a deflationary ERC20 in the [Binance Smart Chain](https://www.binance.org/en/smartChain). It offers the following functionality.

- It taxes the sender of each transaction by 10%.
  - 5% is used to reward all holders
  - 5% is used to add liquidity to the Pancake Swap Liquidity Pool
- It has a fixed supply of 1 000 000 000 000 000 with 9 decimal houses.

## :rocket: Technologies

This project was developed with the following technologies:

- [Solidity 0.8.3](https://docs.soliditylang.org/en/v0.8.3/)
- [Truffle](https://www.trufflesuite.com/)
- [Open Zeppelin Testing Environment](https://docs.openzeppelin.com/test-environment/0.1/)
- [Jest](https://jestjs.io/)
- [Yarn](https://yarnpkg.com/)

## :100: Prerequisites

This project uses the husky to enforce code quality. Therefore we recommend setting up your IDE to follow the configuration from the following files:

- .prettierrc
- .eslintrc.json

## :information_source: How To Use

```bash
# Clone this repository
$ git clone https://github.com/syllena/defi-token.git choose_a_name

# Go into the repository
$ cd choose_a_name

# Install the dependencies
$ yarn install

# Build the smart contracts abi
$ yarn build

# Run the unit tests
$ yarn test

```

### How to make a commit must be used a following rule:

`git commit -m "*type*: commit-message"`

- Where type is: [ `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test` ]
- And commit-message must be written in lower-case.

## :eyes: License

The MIT License (MIT)

Copyright (c) 2021 Jose Cerqueira
