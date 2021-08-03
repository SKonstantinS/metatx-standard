//SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "./lib/LibEIP712MetaTransaction.sol";

contract TestContract {

    string public quote;
    address public owner;

    mapping(address => uint256) private nonces;
    bytes32 internal domainSeparator;

    function initialize(string memory name, string memory version) external {
        domainSeparator = LibEIP712MetaTransaction.setDomainSeparator(name, version);
    }

    function setQuote(string memory newQuote) public {
        quote = newQuote;
        owner = msgSender();
    }

    function getQuote() view public returns (string memory currentQuote, address currentOwner) {
        currentQuote = quote;
        currentOwner = owner;
    }

    function executeMetaTransaction(address userAddress,
        bytes memory functionSignature, bytes32 sigR, bytes32 sigS, uint8 sigV) public payable returns (bytes memory) {
        return LibEIP712MetaTransaction._executeMetaTransaction(userAddress, nonces, domainSeparator, functionSignature, sigR, sigS, sigV);
    }

    function getNonce(address user) external view returns (uint256 nonce) {
        nonce = nonces[user];
    }

    function msgSender() internal view returns(address sender) {
        return LibEIP712MetaTransaction._msgSender();
    }
}