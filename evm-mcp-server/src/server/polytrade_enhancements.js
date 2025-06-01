// Additional Polytrade Finance specific enhancements for your MCP server

// 1. Enhanced ERC-6960 ABI with Polytrade-specific functions
const POLYTRADE_ERC6960_EXTENDED_ABI = [
    // Your existing ERC-6960 ABI plus these Polytrade-specific functions
    {
        "inputs": [{ "name": "mainId", "type": "uint256" }, { "name": "subId", "type": "uint256" }],
        "name": "uri",
        "outputs": [{ "name": "", "type": "string" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "name": "mainId", "type": "uint256" }, { "name": "subId", "type": "uint256" }],
        "name": "exists",
        "outputs": [{ "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "name": "account", "type": "address" }, { "name": "operator", "type": "address" }],
        "name": "isApprovedForAll",
        "outputs": [{ "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "name": "operator", "type": "address" }, { "name": "approved", "type": "bool" }],
        "name": "setApprovalForAll",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;

// 2. Polytrade Marketplace ABI (for trading fractionalized assets)
const POLYTRADE_MARKETPLACE_ABI = [
    {
        "inputs": [
            { "name": "asset", "type": "address" },
            { "name": "mainId", "type": "uint256" },
            { "name": "subId", "type": "uint256" },
            { "name": "amount", "type": "uint256" },
            { "name": "pricePerToken", "type": "uint256" },
            { "name": "paymentToken", "type": "address" }
        ],
        "name": "listAsset",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "name": "listingId", "type": "uint256" },
            { "name": "amount", "type": "uint256" }
        ],
        "name": "buyAsset",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    }
] as const;

// 3. Invoice Asset ABI (Polytrade's RWA invoices)
const POLYTRADE_INVOICE_ASSET_ABI = [
    {
        "inputs": [
            { "name": "to", "type": "address" },
            { "name": "invoiceData", "type": "tuple", "components": [
                { "name": "amount", "type": "uint256" },
                { "name": "apr", "type": "uint256" },
                { "name": "dueDate", "type": "uint256" },
                { "name": "issuer", "type": "address" }
            ]},
            { "name": "uri", "type": "string" }
        ],
        "name": "createInvoice",
        "outputs": [{ "name": "mainId", "type": "uint256" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "name": "mainId", "type": "uint256" }],
        "name": "settleInvoice",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;

// 4. Additional MCP Server Tools for Polytrade Finance

// Get ERC-6960 token URI
server.tool("get_erc6960_uri", {
    contractAddress: z.string().describe("ERC-6960 contract address"),
    mainId: z.string().describe("Main ID of the token"),
    subId: z.string().describe("Sub ID of the token"),
    network: z.enum(["mainnet", "testnet"]).optional().describe("Network to use")
}, async ({ contractAddress, mainId, subId, network = "testnet" }) => {
    try {
        const chain = getChainConfig(network);
        const publicClient = createPublicClient({
            chain,
            transport: http()
        });
        
        const uri = await publicClient.readContract({
            address: ensureAddress(contractAddress),
            abi: POLYTRADE_ERC6960_EXTENDED_ABI,
            functionName: 'uri',
            args: [BigInt(mainId), BigInt(subId)]
        }) as string;
        
        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    contractAddress,
                    mainId,
                    subId,
                    uri,
                    network: chain.name
                }, null, 2)
            }]
        };
    } catch (error) {
        return {
            content: [{
                type: "text",
                text: `Error getting ERC-6960 URI: ${error instanceof Error ? error.message : String(error)}`
            }]
        };
    }
});

// Check if ERC-6960 token exists
server.tool("check_erc6960_exists", {
    contractAddress: z.string().describe("ERC-6960 contract address"),
    mainId: z.string().describe("Main ID of the token"),
    subId: z.string().describe("Sub ID of the token"),
    network: z.enum(["mainnet", "testnet"]).optional().describe("Network to use")
}, async ({ contractAddress, mainId, subId, network = "testnet" }) => {
    try {
        const chain = getChainConfig(network);
        const publicClient = createPublicClient({
            chain,
            transport: http()
        });
        
        const exists = await publicClient.readContract({
            address: ensureAddress(contractAddress),
            abi: POLYTRADE_ERC6960_EXTENDED_ABI,
            functionName: 'exists',
            args: [BigInt(mainId), BigInt(subId)]
        }) as boolean;
        
        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    contractAddress,
                    mainId,
                    subId,
                    exists,
                    network: chain.name
                }, null, 2)
            }]
        };
    } catch (error) {
        return {
            content: [{
                type: "text",
                text: `Error checking if ERC-6960 token exists: ${error instanceof Error ? error.message : String(error)}`
            }]
        };
    }
});

// List ERC-6960 asset on Polytrade Marketplace
server.tool("list_erc6960_on_marketplace", {
    marketplaceAddress: z.string().describe("Polytrade Marketplace contract address"),
    assetAddress: z.string().describe("ERC-6960 asset contract address"),
    mainId: z.string().describe("Main ID of the token"),
    subId: z.string().describe("Sub ID of the token"),
    amount: z.string().describe("Amount to list"),
    pricePerToken: z.string().describe("Price per token in wei"),
    paymentToken: z.string().describe("Payment token address"),
    network: z.enum(["mainnet", "testnet"]).optional().describe("Network to use"),
    gasLimit: z.string().optional().describe("Gas limit for the transaction")
}, async ({ marketplaceAddress, assetAddress, mainId, subId, amount, pricePerToken, paymentToken, network = "testnet", gasLimit }) => {
    try {
        if (!walletManager.getCurrentWallet()) {
            walletManager.restoreLastActiveWallet();
        }
        
        const currentWallet = walletManager.getCurrentWallet();
        if (!currentWallet) {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        error: "No active wallet",
                        instruction: "Use switch_to_seller to activate a wallet for listing"
                    })
                }]
            };
        }
        
        const walletClient = await createDynamicWalletClient(network);
        if (!walletClient || !walletClient.account) {
            throw new Error("Failed to create wallet client or missing account");
        }
        
        const chain = getChainConfig(network);
        const publicClient = createPublicClient({
            chain,
            transport: http()
        });
        
        const writeParams: WriteContractParameters = {
            address: ensureAddress(marketplaceAddress),
            abi: POLYTRADE_MARKETPLACE_ABI,
            functionName: 'listAsset',
            args: [
                ensureAddress(assetAddress),
                BigInt(mainId),
                BigInt(subId),
                BigInt(amount),
                BigInt(pricePerToken),
                ensureAddress(paymentToken)
            ],
            gas: gasLimit ? BigInt(gasLimit) : undefined,
            chain,
            account: walletClient.account
        };
        
        const hash = await walletClient.writeContract(writeParams);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: ensureHash(hash) });
        
        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    success: true,
                    operation: "List ERC-6960 asset on Polytrade Marketplace",
                    transactionHash: hash,
                    blockNumber: receipt.blockNumber.toString(),
                    gasUsed: receipt.gasUsed.toString(),
                    status: receipt.status === "success" ? "Success" : "Failed",
                    details: {
                        assetAddress,
                        mainId,
                        subId,
                        amount,
                        pricePerToken,
                        paymentToken
                    },
                    network: chain.name,
                    wallet: currentWallet.name,
                    explorerUrl: `${chain.blockExplorers.default.url}/tx/${hash}`
                }, null, 2)
            }]
        };
    } catch (error) {
        return {
            content: [{
                type: "text",
                text: `Error listing ERC-6960 asset on marketplace: ${error instanceof Error ? error.message : String(error)}`
            }]
        };
    }
});

// Create Polytrade Invoice (RWA tokenization)
server.tool("create_polytrade_invoice", {
    invoiceContractAddress: z.string().describe("Polytrade Invoice Asset contract address"),
    to: z.string().describe("Recipient address"),
    amount: z.string().describe("Invoice amount"),
    apr: z.string().describe("Annual Percentage Rate (in basis points, e.g., 500 = 5%)"),
    dueDate: z.string().describe("Due date (Unix timestamp)"),
    issuer: z.string().describe("Invoice issuer address"),
    uri: z.string().describe("Invoice metadata URI"),
    network: z.enum(["mainnet", "testnet"]).optional().describe("Network to use"),
    gasLimit: z.string().optional().describe("Gas limit for the transaction")
}, async ({ invoiceContractAddress, to, amount, apr, dueDate, issuer, uri, network = "testnet", gasLimit }) => {
    try {
        if (!walletManager.getCurrentWallet()) {
            walletManager.restoreLastActiveWallet();
        }
        
        const currentWallet = walletManager.getCurrentWallet();
        if (!currentWallet) {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        error: "No active wallet",
                        instruction: "Use switch_to_seller to activate a wallet for invoice creation"
                    })
                }]
            };
        }
        
        const walletClient = await createDynamicWalletClient(network);
        if (!walletClient || !walletClient.account) {
            throw new Error("Failed to create wallet client or missing account");
        }
        
        const chain = getChainConfig(network);
        const publicClient = createPublicClient({
            chain,
            transport: http()
        });
        
        const invoiceData = {
            amount: BigInt(amount),
            apr: BigInt(apr),
            dueDate: BigInt(dueDate),
            issuer: ensureAddress(issuer)
        };
        
        const writeParams: WriteContractParameters = {
            address: ensureAddress(invoiceContractAddress),
            abi: POLYTRADE_INVOICE_ASSET_ABI,
            functionName: 'createInvoice',
            args: [ensureAddress(to), invoiceData, uri],
            gas: gasLimit ? BigInt(gasLimit) : undefined,
            chain,
            account: walletClient.account
        };
        
        const hash = await walletClient.writeContract(writeParams);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: ensureHash(hash) });
        
        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    success: true,
                    operation: "Create Polytrade Invoice Asset",
                    transactionHash: hash,
                    blockNumber: receipt.blockNumber.toString(),
                    gasUsed: receipt.gasUsed.toString(),
                    status: receipt.status === "success" ? "Success" : "Failed",
                    details: {
                        recipient: to,
                        invoiceAmount: amount,
                        apr: `${Number(apr) / 100}%`,
                        dueDate: new Date(Number(dueDate) * 1000).toISOString(),
                        issuer,
                        metadataURI: uri
                    },
                    network: chain.name,
                    wallet: currentWallet.name,
                    explorerUrl: `${chain.blockExplorers.default.url}/tx/${hash}`
                }, null, 2)
            }]
        };
    } catch (error) {
        return {
            content: [{
                type: "text",
                text: `Error creating Polytrade invoice: ${error instanceof Error ? error.message : String(error)}`
            }]
        };
    }
});

// 5. Polytrade Finance contract addresses (these would need to be updated with actual deployed addresses)
const POLYTRADE_CONTRACTS = {
    // XDC Mainnet
    mainnet: {
        marketplace: "0x...", // Polytrade Marketplace contract
        invoiceAsset: "0x...", // Invoice Asset contract
        propertyAsset: "0x...", // Property Asset contract
        wrappedAsset: "0x...", // Wrapped Asset contract
        feeManager: "0x..." // Fee Manager contract
    },
    // XDC Testnet
    testnet: {
        marketplace: "0x...", // Polytrade Marketplace contract
        invoiceAsset: "0x...", // Invoice Asset contract  
        propertyAsset: "0x...", // Property Asset contract
        wrappedAsset: "0x...", // Wrapped Asset contract
        feeManager: "0x..." // Fee Manager contract
    }
};

// 6. Helper function to get Polytrade contract addresses
function getPolytradeContractAddress(contractType: string, network: "mainnet" | "testnet"): string {
    const contracts = POLYTRADE_CONTRACTS[network];
    const address = contracts[contractType as keyof typeof contracts];
    if (!address || address === "0x...") {
        throw new Error(`${contractType} contract address not configured for ${network}`);
    }
    return address;
}