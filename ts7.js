const { Command } = require('commander');
const { Connection, SystemProgram, Transaction, sendAndConfirmTransaction, Keypair, ComputeBudgetProgram, PublicKey } = require("@solana/web3.js");
const bs58 = require("bs58");

const HeliusURL = "https://mainnet.helius-rpc.com/?api-key=API_KEY";
const connection = new Connection(HeliusURL);

const program = new Command();
program.parse(process.argv);

const FROM_SECRET_KEY_BASE58 = "****"; // Replace with your own secret key in base58 format
const FROM_PRIVATE_KEY = bs58.decode(FROM_SECRET_KEY_BASE58);
const SOL_AMOUNT = 0.001; // Amount of SOL to send

(async () => {
    try {
        // Check RPC connection
        const version = await connection.getVersion();
        console.log("Connected to Solana RPC version:", version['solana-core']);

        // Get recipient address from user input
        const recipient = await promptRecipientAddress();
        const toPubkey = new PublicKey(recipient);

        // Call your function here
        await sendTransactionWithPriorityFee("VeryHigh", toPubkey); // Choose between "Min", "Low", "Medium", "High", "VeryHigh", "UnsafeMax"

    } catch (error) {
        console.error("Error:", error);
    }
})();

async function promptRecipientAddress() {
    return new Promise((resolve, reject) => {
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        readline.question("Enter recipient address: ", (address) => {
            readline.close();
            resolve(address.trim());
        });
    });
}

async function getPriorityFeeEstimate(priorityLevel, transaction) {
    const response = await fetch(HeliusURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: "1",
            method: "getPriorityFeeEstimate",
            params: [
                {
                    transaction: bs58.encode(transaction.serialize()), // Pass the serialized transaction in Base58
                    options: { priorityLevel: priorityLevel },
                },
            ],
        }),
    });
    const data = await response.json();
    console.log(data, 'data');
    console.log(
        "Fee in function for",
        priorityLevel,
        " :",
        data.result.priorityFeeEstimate
    );
    return data.result;
}

async function sendTransactionWithPriorityFee(priorityLevel, toPubkey) {
    const fromKeypair = Keypair.fromSecretKey(FROM_PRIVATE_KEY);

    const transaction = new Transaction();
    const transferIx = SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey,
        lamports: SOL_AMOUNT * 1000000000, // Converting SOL to lamports (1 SOL = 1,000,000,000 lamports)
    });
    transaction.add(transferIx);

    transaction.recentBlockhash = (
        await connection.getLatestBlockhash()
    ).blockhash;
    transaction.sign(fromKeypair);

    let feeEstimate = { priorityFeeEstimate: 0 };
    if (priorityLevel !== "NONE") {
        feeEstimate = await getPriorityFeeEstimate(priorityLevel, transaction);
        const computePriceIx = ComputeBudgetProgram.setComputeUnitPrice({
            // microLamports: BigInt(Math.round(feeEstimate.priorityFeeEstimate * 1e9)), // Convert SOL to lamports
            microLamports: feeEstimate.priorityFeeEstimate,
        });        
        // transaction.feePayer(fromKeypair);
        transaction.add(computePriceIx);
        // console.log(transaction);
    }

    try {
        const txid = await sendAndConfirmTransaction(connection, transaction, [
            fromKeypair,
        ]);
        console.log(`Transaction sent successfully with signature ${txid}`);
    } catch (e) {
        console.error(`Failed to send transaction: ${e}`);
    }
}
