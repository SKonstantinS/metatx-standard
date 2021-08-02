//SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "./lib/LibEIP712MetaTransaction.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract TestContract {
    using SafeMath for uint256;

    string public quote;
    address public owner;

    mapping(address => uint256) private nonces;
    bytes32 internal domainSeparator;

    event MetaTransactionExecuted(address userAddress, address payable relayerAddress, bytes functionSignature);

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
        bytes4 destinationFunctionSig = LibEIP712MetaTransaction.convertBytesToBytes4(functionSignature);
        require(destinationFunctionSig != msg.sig, "functionSignature can not be of executeMetaTransaction method");
        LibEIP712MetaTransaction.MetaTransaction memory metaTx = LibEIP712MetaTransaction.MetaTransaction({
        nonce : nonces[userAddress],
        from : userAddress,
        functionSignature : functionSignature
        });
        require(LibEIP712MetaTransaction.verify(userAddress, metaTx, domainSeparator, sigR, sigS, sigV), "Signer and signature do not match");
        nonces[userAddress] = nonces[userAddress].add(1);
        // Append userAddress at the end to extract it from calling context
        (bool success, bytes memory returnData) = address(this).call(abi.encodePacked(functionSignature, userAddress));

        require(success, "Function call not successful");
        emit MetaTransactionExecuted(userAddress, msg.sender, functionSignature);
        return returnData;
    }

    function getNonce(address user) external view returns (uint256 nonce) {
        nonce = nonces[user];
    }

    function msgSender() internal view returns(address sender) {
        return LibEIP712MetaTransaction._msgSender();
    }
}