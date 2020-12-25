import React, { useState, useEffect } from "react";
import "./App.css";
import Button from "@material-ui/core/Button";
import {
  NotificationContainer,
  NotificationManager
} from "react-notifications";
import "react-notifications/lib/notifications.css";
import {ethers} from "ethers";
import { makeStyles } from '@material-ui/core/styles';
import Link from '@material-ui/core/Link';
import Typography from '@material-ui/core/Typography';
import { Box } from "@material-ui/core";
let sigUtil = require("eth-sig-util");
const { config } = require("./config");

const domainType = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" }
];

const metaTransactionType = [
  { name: "nonce", type: "uint256" },
  { name: "from", type: "address" },
  { name: "functionSignature", type: "bytes" }
];

let domainData = {
  name: "TestContract",
  version: "1",
  verifyingContract: config.contract.address
};

let ethersProvider, signer;
let contract, contractInterface;

const useStyles = makeStyles((theme) => ({
  root: {
    '& > * + *': {
      marginLeft: theme.spacing(2),
    },
  },
  link: {
    marginLeft: "5px"
  }
}));

function App() {
  const classes = useStyles();
  const preventDefault = (event) => event.preventDefault();
  const [quote, setQuote] = useState("This is a default quote");
  const [owner, setOwner] = useState("Default Owner Address");
  const [newQuote, setNewQuote] = useState("");
  const [selectedAddress, setSelectedAddress] = useState("");
  const [metaTxEnabled, setMetaTxEnabled] = useState(true);
  const [transactionHash, setTransactionHash] = useState("");

  useEffect(() => {
    async function init() {
      if (
        typeof window.ethereum !== "undefined" &&
        window.ethereum.isMetaMask
      ) {
        // Ethereum user detected. You can now use the provider.
          const provider = window["ethereum"];
          await provider.enable();
          if (provider.networkVersion == "42") {
            domainData.chainId = 42;

          ethersProvider = new ethers.providers.Web3Provider(provider);
          signer = ethersProvider.getSigner();

          contract = new ethers.Contract(
            config.contract.address,
            config.contract.abi,
            signer
          );
          contractInterface = new ethers.utils.Interface(config.contract.abi);
          setSelectedAddress(provider.selectedAddress);
          getQuoteFromNetwork();
          provider.on("accountsChanged", function(accounts) {
            setSelectedAddress(accounts[0]);
          });
        } else {
           showErrorMessage("Please change the network in metamask to Kovan Testnet");
        }
      } else {
        showErrorMessage("Metamask not installed");
      }
    }
    init();
  }, []);

  const onQuoteChange = event => {
    setNewQuote(event.target.value);
  };

  const onSubmitWithPrivateKey = async () => {
    if (newQuote != "" && contract) {
      setTransactionHash("");
      if (metaTxEnabled) {
        console.log("Sending meta transaction");
        let privateKey = "2ef295b86aa9d40ff8835a9fe852942ccea0b7c757fad5602dfa429bcdaea910";
        let userAddress = "0xE1E763551A85F04B4687f0035885E7F710A46aA6";
        let nonce = await contract.getNonce(userAddress);
        let functionSignature = contractInterface.encodeFunctionData("setQuote", [newQuote]);
        let message = {};
        message.nonce = parseInt(nonce);
        message.from = userAddress;
        message.functionSignature = functionSignature;

        const dataToSign = {
          types: {
            EIP712Domain: domainType,
            MetaTransaction: metaTransactionType
          },
          domain: domainData,
          primaryType: "MetaTransaction",
          message: message
        };

        const signature = sigUtil.signTypedMessage(new Buffer.from(privateKey, 'hex'), {data: dataToSign}, 'V4');
        let { r, s, v } = getSignatureParameters(signature);
        sendTransaction(userAddress, functionSignature, r, s, v);
      } else {
        console.log("Sending normal transaction");
        contract.methods
          .setQuote(newQuote)
          .send({ from: selectedAddress })
          .on("transactionHash", function(hash) {
            showInfoMessage(`Transaction sent to blockchain with hash ${hash}`);
          })
          .once("confirmation", function(confirmationNumber, receipt) {
            setTransactionHash(receipt.transactionHash);
            showSuccessMessage("Transaction confirmed");
            getQuoteFromNetwork();
          });
      }
    } else {
      showErrorMessage("Please enter the quote");
    }
  }

  const onSubmit = async event => {
    if (newQuote != "" && contract) {
      setTransactionHash("");
      if (metaTxEnabled) {
        console.log("Sending meta transaction");
        let userAddress = selectedAddress;
        let nonce = await contract.getNonce(userAddress);
        let functionSignature = contractInterface.encodeFunctionData("setQuote", [newQuote]);
        let message = {};
        message.nonce = parseInt(nonce);
        message.from = userAddress;
        message.functionSignature = functionSignature;

        const dataToSign = JSON.stringify({
          types: {
            EIP712Domain: domainType,
            MetaTransaction: metaTransactionType
          },
          domain: domainData,
          primaryType: "MetaTransaction",
          message: message
        });

        let signature = await ethersProvider.send("eth_signTypedData_v4", [userAddress, dataToSign]);

        let { r, s, v } = getSignatureParameters(signature);

        sendTransaction(userAddress, functionSignature, r, s, v);
      } else {
        console.log("Sending normal transaction");
        contract.methods
          .setQuote(newQuote)
          .send({ from: selectedAddress })
          .on("transactionHash", function(hash) {
            showInfoMessage(`Transaction sent to blockchain with hash ${hash}`);
          })
          .once("confirmation", function(confirmationNumber, receipt) {
            setTransactionHash(receipt.transactionHash);
            showSuccessMessage("Transaction confirmed");
            getQuoteFromNetwork();
          });
      }
    } else {
      showErrorMessage("Please enter the quote");
    }
  };

  const getSignatureParameters = signature => {
    if (!ethers.utils.isHexString(signature)) {
      throw new Error(
        'Given value "'.concat(signature, '" is not a valid hex string.')
      );
    }
    var r = signature.slice(0, 66);
    var s = "0x".concat(signature.slice(66, 130));
    var v = "0x".concat(signature.slice(130, 132));
    v = ethers.BigNumber.from(v).toNumber();
    if (![27, 28].includes(v)) v += 27;
    return {
      r: r,
      s: s,
      v: v
    };
  };

  const getQuoteFromNetwork = async () => {
    if (ethersProvider && contract) {
      let result = await contract.getQuote();
      console.log(result);
      if (
        result &&
        result.currentQuote != undefined &&
        result.currentOwner != undefined
      ) {
        if (result.currentQuote == "") {
          showErrorMessage("No quotes set on blockchain yet");
        } else {
          setQuote(result.currentQuote);
          setOwner(result.currentOwner);
        }
      } else {
        showErrorMessage("Not able to get quote information from Network");
      }
    }
  };

  const showErrorMessage = message => {
    NotificationManager.error(message, "Error", 5000);
  };

  const showSuccessMessage = message => {
    NotificationManager.success(message, "Message", 3000);
  };

  const showInfoMessage = message => {
    NotificationManager.info(message, "Info", 3000);
  };

  const sendTransaction = async (userAddress, functionData, r, s, v) => {
    if (ethersProvider && contract) {
      try {
        fetch(`https://localhost:80/api/v2/meta-tx/native`, {
          method: "POST",
          headers: {
            "x-api-key" : "bF4ixrvcS.7cc0c280-94cb-463f-b6bb-38d29cc9dfd2",
            'Content-Type': 'application/json;charset=utf-8'
          },
          body: JSON.stringify({
            "to": config.contract.address,
            "apiId": "efb59f09-9d9e-490a-bfea-4dc4ef76c02b",
            "params": [userAddress, functionData, r, s, v],
            "from": userAddress
          })
        })
        .then(response=>response.json())
        .then(async function(result) {
          console.log(result);
          showInfoMessage(`Transaction sent by relayer with hash ${result.txHash}`);

          let receipt = await ethersProvider.waitForTransaction(result.txHash);
          console.log(receipt);
          setTransactionHash(receipt.transactionHash);
          showSuccessMessage("Transaction confirmed on chain");
          getQuoteFromNetwork();
        }).catch(function(error) {
	        console.log(error)
	      });
      } catch (error) {
        console.log(error);
      }
    }
  };

  return (
    <div className="App">
      <section className="main">
        <div className="mb-wrap mb-style-2">
          <blockquote cite="http://www.gutenberg.org/ebboks/11">
            <p>{quote}</p>
          </blockquote>
        </div>

        <div className="mb-attribution">
          <p className="mb-author">{owner}</p>
          {selectedAddress.toLowerCase() === owner.toLowerCase() && (
            <cite className="owner">You are the owner of the quote</cite>
          )}
          {selectedAddress.toLowerCase() !== owner.toLowerCase() && (
            <cite>You are not the owner of the quote</cite>
          )}
        </div>
      </section>
      <section>
        {transactionHash !== "" && <Box className={classes.root} mt={2} p={2}>
          <Typography>
            Check your transaction hash
            <Link href={`https://mumbai-explorer.matic.today/tx/${transactionHash}`} target="_blank"
            className={classes.link}>
              here
            </Link>
          </Typography>
        </Box>}
      </section>
      <section>
        <div className="submit-container">
          <div className="submit-row">
            <input
              type="text"
              placeholder="Enter your quote"
              onChange={onQuoteChange}
              value={newQuote}
            />
            <Button variant="contained" color="primary" onClick={onSubmit}>
              Submit
            </Button>
            <Button variant="contained" color="primary" onClick={onSubmitWithPrivateKey} style={{marginLeft: "10px"}}>
              Submit (using private key)
            </Button>
          </div>
        </div>
      </section>
      <NotificationContainer />
    </div>
  );
}

export default App;