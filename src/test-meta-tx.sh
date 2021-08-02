#!/usr/bin/env bash
truffle test ./test/EIP712MetaTransaction.test.js \
          ./contracts//lib/LibEIP712MetaTransaction.sol \
          ./contracts/TestContract.sol
