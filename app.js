const AqfrNetworkClient = require('aqfr.network.client');
const RippleAPI = require('ripple-lib').RippleAPI;
var express = require("express");
var bodyParser = require('body-parser');
var url = require('url');
const fetch = require('node-fetch');

var app = express();
var port = process.env.PORT || 5050;

const api = new RippleAPI({
    server: 'wss://s.altnet.rippletest.net:51233' // Test Net
});

api.connect().then(async () => {
    console.log('Connected to rippled');

});

// api.connect();

const marketCoordinatorAccount = api.generateAddress();

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

var borrowers = new Map();
var lenders = new Map();
var matches = new Map();

app.listen(port, () => {
    console.log("Server running on port:", port);
});



app.get("/api/account/:address", async (req, res, next) => {
    var address = req.params.address // should be a multi-sign account_address from ledger
    console.log(address)
    result = await api.getAccountInfo(address);
    console.log(result);
    res.json(result);
});


app.post("/api/account", async (req, res, next) => {
    result = await api.generateAddress();
    res.json(result);
});


app.post("/transfer", async (req, res, next) => {
    // Continuing after connecting to the API
    let sender = req.body.sender;
    let amount = req.body.amount;
    let restaurant = req.body.restaurant;

    console.log(sender)

    async function doPrepare(sender, amount, restaurant) {
        console.log("preparing transaction")
        // sender = "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe"
        // restaurant = "rUCzEr6jrEyMpjhs4wSdQdz4g8Y382NxfM"
        const preparedTx = await api.prepareTransaction({
            "TransactionType": "Payment",
            "Account": sender,
            "Amount": api.xrpToDrops(amount), // Same as "Amount": "22000000"
            "Destination": restaurant
        }, {
            // Expire this transaction if it doesn't execute within ~5 minutes:
            "maxLedgerVersionOffset": 75
        })
        const maxLedgerVersion = preparedTx.instructions.maxLedgerVersion
        // res.write("Prepared transaction instructions:" + preparedTx.txJSON)
        // res.write("\n")
        console.log("Prepared transaction instructions:", preparedTx.txJSON)
        // res.write("Transaction cost:"+ preparedTx.instructions.fee+ "XRP")
        // res.write("\n")
        console.log("Transaction cost:" ,preparedTx.instructions.fee,  "XRP")
        // res.write("Transaction expires after ledger:"+ maxLedgerVersion)
        // res.write("\n")
        console.log("Transaction expires after ledger:", maxLedgerVersion)

        res.json({
            "Account": sender,
            "transaction_cost": preparedTx.instructions.fee,
            "Destination": restaurant
        })
        return preparedTx.txJSON
    }
    doPrepare(sender, amount, restaurant).then(async (txJSON) => {
        console.log("sigining process")
        const response = await api.sign(txJSON, "sn6E5iSgZT6cjuL5DKkuoQU5kNBEh")
        const txID = response.id
        // res.write("Identifying hash:" + txID)
        // res.write("\n")
        console.log("Identifying hash:", txID)
        const txBlob = response.signedTransaction
        // res.write("Signed blob:" + txBlob)
        // res.write("\n")
        console.log("Signed blob:", txBlob)
        return txBlob
    }).then(async (txBlob) => {
        console.log("submiting blob")
        const latestLedgerVersion = await api.getLedgerVersion()

        const result = await api.submit(txBlob)

        // res.write("Tentative result code:" + result.resultCode)
        // res.write("\n")
        // res.write("Tentative result message:" + result.resultMessage)
        // res.write("\n")
        console.log("Tentative result code:", result.resultCode)
        console.log("Tentative result message:", result.resultMessage)

        // Return the earliest ledger index this transaction could appear in
        // as a result of this submission, which is the first one after the
        // validated ledger at time of submission.
        return latestLedgerVersion + 1
    }).then(async () => {
        api.on('ledger', ledger => {
            console.log("Ledger version", ledger.ledgerVersion, "was just validated.")
        })
        // res.write("transfer successfully")
        // res.end()
    })
});

