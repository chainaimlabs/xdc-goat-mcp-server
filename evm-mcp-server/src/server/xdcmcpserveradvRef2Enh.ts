import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
// GOAT SDK imports
import { getOnChainTools } from "@goat-sdk/adapter-model-context-protocol";
import { viem } from "@goat-sdk/wallet-viem";
import { createWalletClient, http, parseEther, formatEther, parseUnits, formatUnits, custom, WalletClient, PublicClient, Address, Hash, SendTransactionParameters, WriteContractParameters, EstimateGasParameters, DeployContractParameters } from "viem";
import { privateKeyToAccount, Account } from "viem/accounts";
import { createPublicClient } from "viem";
import 'dotenv/config';

// Type definitions
interface BrowserWallet {
    address: Address;
    chainId: number;
    isConnected: boolean;
    provider?: {
        isMetaMask?: boolean;
        isXDCPay?: boolean;
        chainId: string;
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
}

interface ChainConfig {
    id: number;
    name: string;
    network: string;
    nativeCurrency: { name: string; symbol: string; decimals: number };
    rpcUrls: {
        default: { http: string[] };
        public: { http: string[] };
    };
    blockExplorers: {
        default: { name: string; url: string };
    };
}

// Global state with proper typing
let browserWallet: BrowserWallet | null = null;
console.log(' env  PK  ', process.env.WALLET_PRIVATE_KEY);
console.log(' env  RPC  ', process.env.RPC_PROVIDER_URL);

// XDC Network Configurations
const XDC_MAINNET: ChainConfig = {
    id: 50,
    name: "XDC Network",
    network: "xdc",
    nativeCurrency: { name: "XDC", symbol: "XDC", decimals: 18 },
    rpcUrls: {
        default: { http: ["https://rpc.xinfin.network"] },
        public: { http: ["https://rpc.xinfin.network"] }
    },
    blockExplorers: {
        default: { name: "XDC Network Explorer", url: "https://xdc.network" }
    }
};

const XDC_TESTNET: ChainConfig = {
    id: 51,
    name: "XDC Apothem Testnet",
    network: "xdc-testnet",
    nativeCurrency: { name: "TXDC", symbol: "TXDC", decimals: 18 },
    rpcUrls: {
        default: { http: ["https://erpc.apothem.network"] },
        public: { http: ["https://erpc.apothem.network"] }
    },
    blockExplorers: {
        default: { name: "Apothem Explorer", url: "https://testnet.xdcscan.com/" }
    }
};

// Utility functions
function getChainConfig(network: "mainnet" | "testnet"): ChainConfig {
    return network === "testnet" ? XDC_TESTNET : XDC_MAINNET;
}

// Helper function to ensure hash is properly typed
function ensureHash(hash: string): Hash {
    return hash as Hash;
}

// Helper function to ensure address is properly typed
function ensureAddress(address: string): Address {
    if (!address.startsWith('0x')) {
        throw new Error(`Invalid address format: ${address}. Address must start with 0x`);
    }
    return address as Address;
}

// Helper function to ensure private key is properly typed
function ensurePrivateKey(privateKey: string): `0x${string}` {
    if (!privateKey.startsWith('0x')) {
        return `0x${privateKey}` as `0x${string}`;
    }
    return privateKey as `0x${string}`;
}

// Create wallet client with private key (like evmserver.ts)
const privateKey = process.env.WALLET_PRIVATE_KEY;
let mainWalletClient: WalletClient | null = null;
let goatTools: any = null; // Use any type to avoid interface issues

if (privateKey) {
    const formattedPrivateKey = ensurePrivateKey(privateKey);
    const account = privateKeyToAccount(formattedPrivateKey);
    mainWalletClient = createWalletClient({
        account: account,
        transport: http(process.env.RPC_PROVIDER_URL || "https://erpc.apothem.network"),
        chain: XDC_TESTNET, // Default to testnet, can be changed
    });
    console.log("Wallet Address:", account.address);
    console.log("Chain:", XDC_TESTNET.name);
}

// Function to create wallet client from browser wallet or private key
async function createDynamicWalletClient(network: "mainnet" | "testnet", usePrivateKey: boolean = true): Promise<WalletClient | null> {
    const chain = getChainConfig(network);
    
    if (usePrivateKey && privateKey) {
        const formattedPrivateKey = ensurePrivateKey(privateKey);
        const account = privateKeyToAccount(formattedPrivateKey);
        const walletClient = createWalletClient({
            account: account,
            transport: http(chain.rpcUrls.default.http[0]),
            chain: chain,
        });
        return walletClient;
    }
    else if (browserWallet && browserWallet.provider) {
        // Create wallet client from browser wallet
        const walletClient = createWalletClient({
            account: browserWallet.address,
            transport: custom(browserWallet.provider),
            chain: chain,
        });
        return walletClient;
    }
    return null;
}

// Function to get GOAT tools for a specific network/wallet
async function getGoatToolsForNetwork(network: "mainnet" | "testnet", usePrivateKey: boolean = true): Promise<any> {
    const walletClient = await createDynamicWalletClient(network, usePrivateKey);
    if (!walletClient) {
        throw new Error("No wallet client available");
    }

    return await getOnChainTools({
        wallet: viem(walletClient),
        plugins: [],
    });
}

// Create MCP Server
const server = new McpServer({
    name: "XDC-GOAT-MCP-Server-Enhanced",
    version: "1.2.0"
});

// Initialize GOAT tools and register them using server.tool mechanism
async function initializeGoatTools(): Promise<void> {
    if (privateKey && mainWalletClient) {
        try {
            goatTools = await getOnChainTools({
                wallet: viem(mainWalletClient),
                plugins: [],
            });
            console.log("GOAT SDK tools initialized successfully");

            // Get available tools from GOAT SDK
            const { listOfTools, toolHandler } = goatTools;
            const availableTools = listOfTools();
            console.log(`Found ${availableTools.length} GOAT tools to register...`);

            // Register each GOAT tool using server.tool mechanism
            availableTools.forEach((tool: any) => {
                const toolName = `goat_${tool.name}`;
                console.log(`Registering GOAT tool: ${toolName}`);

                // Create a zod schema based on the tool's input schema
                const schemaParams: Record<string, z.ZodTypeAny> = {};
                
                if (tool.inputSchema && tool.inputSchema.properties) {
                    Object.keys(tool.inputSchema.properties).forEach(key => {
                        const prop = tool.inputSchema.properties[key];
                        if (prop.type === 'string') {
                            schemaParams[key] = z.string().optional().describe(prop.description || '');
                        }
                        else if (prop.type === 'number') {
                            schemaParams[key] = z.number().optional().describe(prop.description || '');
                        }
                        else if (prop.type === 'boolean') {
                            schemaParams[key] = z.boolean().optional().describe(prop.description || '');
                        }
                        else {
                            schemaParams[key] = z.any().optional().describe(prop.description || '');
                        }
                    });
                }
                else {
                    // Default schema for tools without specific input schema
                    schemaParams.input = z.any().optional().describe("Tool input parameters");
                }

                server.tool(toolName, schemaParams, async (args: Record<string, unknown>) => {
                    try {
                        console.log(`Executing GOAT tool: ${tool.name} with args:`, args);
                        const result = await toolHandler(tool.name, args);
                        return {
                            content: [{
                                type: "text",
                                text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                            }]
                        };
                    }
                    catch (error) {
                        console.error(`Error in GOAT tool ${tool.name}:`, error);
                        return {
                            content: [{
                                type: "text",
                                text: `Error executing GOAT tool '${tool.name}': ${error instanceof Error ? error.message : String(error)}`
                            }]
                        };
                    }
                });
            });

            console.log("All GOAT tools registered successfully");
        }
        catch (error) {
            console.error("Error initializing GOAT tools:", error);
        }
    }
    else {
        console.log("No private key found - GOAT tools not initialized");
    }
}

// Wallet Management Tools
server.tool("get_wallet_info", {
    network: z.enum(["mainnet", "testnet"]).optional().describe("XDC network (defaults to testnet)")
}, async ({ network = "testnet" }) => {
    try {
        if (privateKey) {
            const formattedPrivateKey = ensurePrivateKey(privateKey);
            const account = privateKeyToAccount(formattedPrivateKey);
            const chain = getChainConfig(network);
            const publicClient = createPublicClient({
                chain,
                transport: http()
            });

            try {
                const balance = await publicClient.getBalance({ address: account.address });
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            source: "Environment Private Key",
                            address: account.address,
                            network: chain.name,
                            chainId: chain.id,
                            balance: formatEther(balance) + " XDC",
                            isConnected: true,
                            goatIntegration: !!goatTools
                        }, null, 2)
                    }]
                };
            }
            catch (balanceError) {
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            source: "Environment Private Key",
                            address: account.address,
                            network: chain.name,
                            chainId: chain.id,
                            isConnected: true,
                            goatIntegration: !!goatTools,
                            note: "Could not fetch balance - network might be unavailable"
                        }, null, 2)
                    }]
                };
            }
        }
        else if (browserWallet) {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        source: "Browser Wallet",
                        address: browserWallet.address,
                        chainId: browserWallet.chainId,
                        network: browserWallet.chainId === 50 ? "XDC Mainnet" : "XDC Testnet",
                        isConnected: browserWallet.isConnected,
                        goatIntegration: true
                    }, null, 2)
                }]
            };
        }
        else {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        message: "No wallet configured",
                        instructions: [
                            "Set WALLET_PRIVATE_KEY environment variable, or",
                            "Use simulate_browser_wallet_connection to connect a browser wallet"
                        ]
                    }, null, 2)
                }]
            };
        }
    }
    catch (error) {
        return {
            content: [{
                type: "text",
                text: `Error getting wallet info: ${error instanceof Error ? error.message : String(error)}`
            }]
        };
    }
});

server.tool("list_available_goat_tools", {
    showDetails: z.boolean().optional().describe("Show detailed information about each tool")
}, async ({ showDetails = false }) => {
    try {
        if (!goatTools) {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        message: "GOAT tools not initialized",
                        reason: privateKey ? "GOAT SDK not loaded" : "No private key configured",
                        instruction: "Set WALLET_PRIVATE_KEY environment variable and restart"
                    }, null, 2)
                }]
            };
        }

        const { listOfTools } = goatTools;
        const availableTools = listOfTools();

        if (showDetails) {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        message: "Available GOAT SDK Tools (Detailed)",
                        totalCount: availableTools.length,
                        tools: availableTools.map((tool: any) => ({
                            name: tool.name,
                            serverToolName: `goat_${tool.name}`,
                            description: tool.description,
                            inputSchema: tool.inputSchema
                        }))
                    }, null, 2)
                }]
            };
        }
        else {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        message: "Available GOAT SDK Tools",
                        totalCount: availableTools.length,
                        toolNames: availableTools.map((tool: any) => `goat_${tool.name}`),
                        note: "Use 'list_available_goat_tools' with showDetails=true for more information"
                    }, null, 2)
                }]
            };
        }
    }
    catch (error) {
        return {
            content: [{
                type: "text",
                text: `Error listing GOAT tools: ${error instanceof Error ? error.message : String(error)}`
            }]
        };
    }
});

server.tool("get_goat_tool_info", {
    toolName: z.string().describe("Name of the GOAT tool (without goat_ prefix)")
}, async ({ toolName }) => {
    try {
        if (!goatTools) {
            return {
                content: [{
                    type: "text",
                    text: "Error: GOAT tools not initialized. Set WALLET_PRIVATE_KEY and restart."
                }]
            };
        }

        const { listOfTools } = goatTools;
        const availableTools = listOfTools();
        const tool = availableTools.find((t: any) => t.name === toolName);

        if (!tool) {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        error: "Tool not found",
                        requestedTool: toolName,
                        availableTools: availableTools.map((t: any) => t.name),
                        note: "Use list_available_goat_tools to see all available tools"
                    }, null, 2)
                }]
            };
        }

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    toolName: tool.name,
                    serverToolName: `goat_${tool.name}`,
                    description: tool.description,
                    inputSchema: tool.inputSchema,
                    usage: `Call the tool directly using: goat_${tool.name}`
                }, null, 2)
            }]
        };
    }
    catch (error) {
        return {
            content: [{
                type: "text",
                text: `Error getting tool info: ${error instanceof Error ? error.message : String(error)}`
            }]
        };
    }
});

// Browser Wallet Detection and Connection Tools
server.tool("detect_browser_wallets", {
    // No parameters needed for detection
}, async () => {
    try {
        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    message: "Browser wallet detection (simulated for Node.js environment)",
                    note: "In browser environment, this would check window.ethereum, window.xdc, etc.",
                    detectionInstructions: [
                        "1. Check if window.ethereum exists (MetaMask, etc.)",
                        "2. Check if window.xdc exists (XDCPay)",
                        "3. Check provider.isMetaMask, provider.isXDCPay properties",
                        "4. Use eth_requestAccounts to connect",
                        "5. Use eth_chainId to verify network"
                    ],
                    supportedWallets: ["MetaMask", "XDCPay", "BlockWallet", "Trust Wallet", "Coinbase Wallet"],
                    requiredChainIds: {
                        mainnet: XDC_MAINNET.id,
                        testnet: XDC_TESTNET.id
                    }
                }, null, 2)
            }]
        };
    }
    catch (error) {
        return {
            content: [{
                type: "text",
                text: `Error detecting browser wallets: ${error instanceof Error ? error.message : String(error)}`
            }]
        };
    }
});

server.tool("simulate_browser_wallet_connection", {
    address: z.string().describe("Wallet address to simulate connection with"),
    chainId: z.number().describe("Chain ID (50 for mainnet, 51 for testnet)"),
    providerType: z.enum(["metamask", "xdcpay", "generic"]).optional().describe("Type of wallet provider")
}, async ({ address, chainId, providerType = "generic" }) => {
    try {
        // Simulate browser wallet connection for testing
        browserWallet = {
            address: ensureAddress(address),
            chainId,
            isConnected: true,
            provider: {
                // Simulate provider object
                isMetaMask: providerType === "metamask",
                isXDCPay: providerType === "xdcpay",
                chainId: `0x${chainId.toString(16)}`,
                request: async (args: { method: string; params?: unknown[] }) => {
                    // Simulate provider methods
                    if (args.method === "eth_accounts") {
                        return [address];
                    }
                    if (args.method === "eth_chainId") {
                        return `0x${chainId.toString(16)}`;
                    }
                    return null;
                }
            }
        };

        const network = chainId === 50 ? "mainnet" : "testnet";
        const chainConfig = getChainConfig(network);

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    message: "Browser wallet connection simulated successfully",
                    address: browserWallet.address,
                    chainId: browserWallet.chainId,
                    network: chainConfig.name,
                    providerType,
                    isConnected: true,
                    goatIntegrationReady: true,
                    note: "You can now use GOAT tools with walletSource: 'browser'"
                }, null, 2)
            }]
        };
    }
    catch (error) {
        return {
            content: [{
                type: "text",
                text: `Error simulating connection: ${error instanceof Error ? error.message : String(error)}`
            }]
        };
    }
});

server.tool("switch_wallet_network", {
    network: z.enum(["mainnet", "testnet"]).describe("Network to switch to"),
    walletSource: z.enum(["private_key", "browser"]).optional().describe("Wallet source")
}, async ({ network, walletSource = "private_key" }) => {
    try {
        const chainConfig = getChainConfig(network);

        if (walletSource === "browser" && browserWallet) {
            // Update browser wallet network
            browserWallet.chainId = chainConfig.id;
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        message: "Browser wallet network switched (simulated)",
                        network: chainConfig.name,
                        chainId: chainConfig.id,
                        address: browserWallet.address,
                        note: "In real browser, this would call wallet_switchEthereumChain"
                    }, null, 2)
                }]
            };
        }
        else if (walletSource === "private_key" && privateKey) {
            // For private key wallet, we just acknowledge the network preference
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        message: "Network preference updated for private key wallet",
                        network: chainConfig.name,
                        chainId: chainConfig.id,
                        note: "Private key wallet will use specified network for subsequent operations"
                    }, null, 2)
                }]
            };
        }
        else {
            return {
                content: [{
                    type: "text",
                    text: `Error: No ${walletSource} wallet available`
                }]
            };
        }
    }
    catch (error) {
        return {
            content: [{
                type: "text",
                text: `Error switching network: ${error instanceof Error ? error.message : String(error)}`
            }]
        };
    }
});

// Standard Token Contract ABIs with proper stateMutability
const ERC20_ABI = [
    {
        "inputs": [{ "name": "_owner", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "name": "balance", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "name": "_to", "type": "address" }, { "name": "_value", "type": "uint256" }],
        "name": "transfer",
        "outputs": [{ "name": "", "type": "bool" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "name",
        "outputs": [{ "name": "", "type": "string" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [{ "name": "", "type": "string" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [{ "name": "", "type": "uint8" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "totalSupply",
        "outputs": [{ "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "name": "_spender", "type": "address" }, { "name": "_value", "type": "uint256" }],
        "name": "approve",
        "outputs": [{ "name": "", "type": "bool" }],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;

// ERC-721 NFT ABI with proper stateMutability
const ERC721_ABI = [
    {
        "inputs": [{ "name": "to", "type": "address" }, { "name": "tokenId", "type": "uint256" }],
        "name": "mint",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "name": "to", "type": "address" }, { "name": "uri", "type": "string" }],
        "name": "safeMint",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "name": "owner", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "name": "tokenId", "type": "uint256" }],
        "name": "ownerOf",
        "outputs": [{ "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "name": "tokenId", "type": "uint256" }],
        "name": "tokenURI",
        "outputs": [{ "name": "", "type": "string" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "name": "from", "type": "address" }, { "name": "to", "type": "address" }, { "name": "tokenId", "type": "uint256" }],
        "name": "transferFrom",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "name": "to", "type": "address" }, { "name": "approved", "type": "bool" }],
        "name": "setApprovalForAll",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;

// Transaction Execution Tools
server.tool("send_native_token", {
    to: z.string().describe("Recipient address"),
    amount: z.string().describe("Amount to send (in XDC/TXDC)"),
    network: z.enum(["mainnet", "testnet"]).optional().describe("Network to use"),
    gasLimit: z.string().optional().describe("Gas limit for the transaction"),
    gasPrice: z.string().optional().describe("Gas price in Gwei")
}, async ({ to, amount, network = "testnet", gasLimit, gasPrice }) => {
    try {
        if (!privateKey) {
            return {
                content: [{
                    type: "text",
                    text: "Error: No private key configured. Set WALLET_PRIVATE_KEY environment variable."
                }]
            };
        }

        const walletClient = await createDynamicWalletClient(network, true);
        if (!walletClient || !walletClient.account) {
            throw new Error("Failed to create wallet client or missing account");
        }

        const chain = getChainConfig(network);
        const publicClient = createPublicClient({
            chain,
            transport: http()
        });

        // Prepare transaction parameters with proper typing
        const txParams: SendTransactionParameters = {
            account: walletClient.account,
            to: ensureAddress(to),
            value: parseEther(amount),
            chain
        };

        if (gasLimit) {
            txParams.gas = BigInt(gasLimit);
        }
        if (gasPrice) {
            txParams.gasPrice = parseUnits(gasPrice, 9); // Convert Gwei to wei
        }

        // Estimate gas if not provided
        if (!gasLimit) {
            try {
                const estimateParams: EstimateGasParameters = {
                    to: ensureAddress(to),
                    value: parseEther(amount),
                };
                const estimatedGas = await publicClient.estimateGas(estimateParams);
                txParams.gas = estimatedGas;
            }
            catch (error) {
                console.warn("Gas estimation failed, using default");
                txParams.gas = BigInt(21000);
            }
        }

        // Send transaction
        const hash = await walletClient.sendTransaction(txParams);

        // Wait for transaction receipt
        const receipt = await publicClient.waitForTransactionReceipt({ hash: ensureHash(hash) });

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    success: true,
                    transactionHash: hash,
                    blockNumber: receipt.blockNumber.toString(),
                    gasUsed: receipt.gasUsed.toString(),
                    status: receipt.status === "success" ? "Success" : "Failed",
                    from: receipt.from,
                    to: receipt.to,
                    amount: `${amount} ${chain.nativeCurrency.symbol}`,
                    network: chain.name,
                    explorerUrl: `${chain.blockExplorers.default.url}/tx/${hash}`
                }, null, 2)
            }]
        };
    }
    catch (error) {
        return {
            content: [{
                type: "text",
                text: `Error sending transaction: ${error instanceof Error ? error.message : String(error)}`
            }]
        };
    }
});

server.tool("send_erc20_token", {
    tokenAddress: z.string().describe("ERC-20 token contract address"),
    to: z.string().describe("Recipient address"),
    amount: z.string().describe("Amount to send"),
    network: z.enum(["mainnet", "testnet"]).optional().describe("Network to use"),
    gasLimit: z.string().optional().describe("Gas limit for the transaction")
}, async ({ tokenAddress, to, amount, network = "testnet", gasLimit }) => {
    try {
        if (!privateKey) {
            return {
                content: [{
                    type: "text",
                    text: "Error: No private key configured. Set WALLET_PRIVATE_KEY environment variable."
                }]
            };
        }

        const walletClient = await createDynamicWalletClient(network, true);
        if (!walletClient || !walletClient.account) {
            throw new Error("Failed to create wallet client or missing account");
        }

        const chain = getChainConfig(network);
        const publicClient = createPublicClient({
            chain,
            transport: http()
        });

        // Get token decimals
        const decimals = await publicClient.readContract({
            address: ensureAddress(tokenAddress),
            abi: ERC20_ABI,
            functionName: 'decimals'
        }) as number;

        const symbol = await publicClient.readContract({
            address: ensureAddress(tokenAddress),
            abi: ERC20_ABI,
            functionName: 'symbol'
        }) as string;

        // Prepare transaction with proper typing
        const writeParams: WriteContractParameters = {
            address: ensureAddress(tokenAddress),
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [ensureAddress(to), parseUnits(amount, decimals)],
            gas: gasLimit ? BigInt(gasLimit) : undefined,
            chain,
            account: walletClient.account!
        };

        const hash = await walletClient.writeContract(writeParams);

        // Wait for transaction receipt
        const receipt = await publicClient.waitForTransactionReceipt({ hash: ensureHash(hash) });

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    success: true,
                    transactionHash: hash,
                    blockNumber: receipt.blockNumber.toString(),
                    gasUsed: receipt.gasUsed.toString(),
                    status: receipt.status === "success" ? "Success" : "Failed",
                    from: receipt.from,
                    to: receipt.to,
                    tokenAddress,
                    amount: `${amount} ${symbol}`,
                    network: chain.name,
                    explorerUrl: `${chain.blockExplorers.default.url}/tx/${hash}`
                }, null, 2)
            }]
        };
    }
    catch (error) {
        return {
            content: [{
                type: "text",
                text: `Error sending ERC-20 token: ${error instanceof Error ? error.message : String(error)}`
            }]
        };
    }
});

server.tool("mint_nft", {
    contractAddress: z.string().describe("NFT contract address"),
    to: z.string().describe("Recipient address"),
    tokenId: z.string().optional().describe("Token ID (if required by contract)"),
    tokenURI: z.string().optional().describe("Token URI/metadata URL"),
    network: z.enum(["mainnet", "testnet"]).optional().describe("Network to use"),
    gasLimit: z.string().optional().describe("Gas limit for the transaction")
}, async ({ contractAddress, to, tokenId, tokenURI, network = "testnet", gasLimit }) => {
    try {
        if (!privateKey) {
            return {
                content: [{
                    type: "text",
                    text: "Error: No private key configured. Set WALLET_PRIVATE_KEY environment variable."
                }]
            };
        }

        const walletClient = await createDynamicWalletClient(network, true);
        if (!walletClient || !walletClient.account) {
            throw new Error("Failed to create wallet client or missing account");
        }

        const chain = getChainConfig(network);
        const publicClient = createPublicClient({
            chain,
            transport: http()
        });

        let hash: Hash;
        
        // Determine which mint function to use based on parameters
        if (tokenURI) {
            // Use safeMint with URI
            const writeParams: WriteContractParameters = {
                address: ensureAddress(contractAddress),
                abi: ERC721_ABI,
                functionName: 'safeMint',
                args: [ensureAddress(to), tokenURI],
                gas: gasLimit ? BigInt(gasLimit) : undefined,
                chain,
                account: walletClient.account!
            };
            hash = await walletClient.writeContract(writeParams);
        }
        else if (tokenId) {
            // Use mint with specific token ID
            const writeParams: WriteContractParameters = {
                address: ensureAddress(contractAddress),
                abi: ERC721_ABI,
                functionName: 'mint',
                args: [ensureAddress(to), BigInt(tokenId)],
                gas: gasLimit ? BigInt(gasLimit) : undefined,
                chain,
                account: walletClient.account!
            };
            hash = await walletClient.writeContract(writeParams);
        }
        else {
            return {
                content: [{
                    type: "text",
                    text: "Error: Either tokenId or tokenURI must be provided for minting"
                }]
            };
        }

        // Wait for transaction receipt
        const receipt = await publicClient.waitForTransactionReceipt({ hash: ensureHash(hash) });

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    success: true,
                    transactionHash: hash,
                    blockNumber: receipt.blockNumber.toString(),
                    gasUsed: receipt.gasUsed.toString(),
                    status: receipt.status === "success" ? "Success" : "Failed",
                    from: receipt.from,
                    contractAddress,
                    recipient: to,
                    tokenId: tokenId || "Generated by contract",
                    tokenURI: tokenURI || "N/A",
                    network: chain.name,
                    explorerUrl: `${chain.blockExplorers.default.url}/tx/${hash}`
                }, null, 2)
            }]
        };
    }
    catch (error) {
        return {
            content: [{
                type: "text",
                text: `Error minting NFT: ${error instanceof Error ? error.message : String(error)}`
            }]
        };
    }
});

server.tool("deploy_simple_nft_contract", {
    name: z.string().describe("NFT collection name"),
    symbol: z.string().describe("NFT collection symbol"),
    network: z.enum(["mainnet", "testnet"]).optional().describe("Network to deploy on"),
    gasLimit: z.string().optional().describe("Gas limit for deployment")
}, async ({ name, symbol, network = "testnet", gasLimit }) => {
    try {
        if (!privateKey) {
            return {
                content: [{
                    type: "text",
                    text: "Error: No private key configured. Set WALLET_PRIVATE_KEY environment variable."
                }]
            };
        }

        const walletClient = await createDynamicWalletClient(network, true);
        if (!walletClient || !walletClient.account) {
            throw new Error("Failed to create wallet client or missing account");
        }

        // Simple ERC-721 contract bytecode (this is a basic example)
        const contractBytecode = "0x608060405234801561001057600080fd5b50604051610c38380380610c388339818101604052810190610032919061007a565b818181600090805190602001906100499291906100ed565b5080600190805190602001906100609291906100ed565b50505050505061019b565b600080fd5b600080fd5b600080fd5b600080fd5b6000610088826100fd565b9050919050565b6000819050919050565b6100a28161008f565b81146100ad57600080fd5b50565b6000815190506100bf81610099565b92915050565b6000602082840312156100db576100da610070565b5b60006100e9848285016100b0565b91505092915050565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f1061012e57805160ff191683800117855561015c565b8280016001018555821561015c579182015b8281111561015b578251825591602001919060010190610140565b5b509050610169919061016d565b5090565b5b8082111561018657600081600090555060010161016e565b5090565b610a8e806101aa6000396000f3fe" as `0x${string}`;

        const chain = getChainConfig(network);
        const publicClient = createPublicClient({
            chain,
            transport: http()
        });

        // Deploy contract with proper typing
        const deployParams: DeployContractParameters = {
            abi: ERC721_ABI,
            bytecode: contractBytecode,
            args: [name, symbol],
            account: walletClient.account,
            gas: gasLimit ? BigInt(gasLimit) : undefined,
            chain
        };

        const hash = await walletClient.deployContract(deployParams);

        // Wait for transaction receipt
        const receipt = await publicClient.waitForTransactionReceipt({ hash: ensureHash(hash) });

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    success: true,
                    transactionHash: hash,
                    contractAddress: receipt.contractAddress,
                    blockNumber: receipt.blockNumber.toString(),
                    gasUsed: receipt.gasUsed.toString(),
                    status: receipt.status === "success" ? "Success" : "Failed",
                    name,
                    symbol,
                    network: chain.name,
                    explorerUrl: `${chain.blockExplorers.default.url}/tx/${hash}`,
                    note: "Contract deployed successfully. You can now mint NFTs using the mint_nft tool."
                }, null, 2)
            }]
        };
    }
    catch (error) {
        return {
            content: [{
                type: "text",
                text: `Error deploying NFT contract: ${error instanceof Error ? error.message : String(error)}`
            }]
        };
    }
});

server.tool("estimate_gas", {
    to: z.string().describe("Transaction recipient address"),
    value: z.string().optional().describe("Value to send (in XDC/TXDC)"),
    data: z.string().optional().describe("Transaction data (for contract calls)"),
    network: z.enum(["mainnet", "testnet"]).optional().describe("Network to use")
}, async ({ to, value, data, network = "testnet" }) => {
    try {
        const chain = getChainConfig(network);
        const publicClient = createPublicClient({
            chain,
            transport: http()
        });

        const txParams: EstimateGasParameters = {
            to: ensureAddress(to),
        };

        if (value) {
            txParams.value = parseEther(value);
        }
        if (data) {
            txParams.data = data as `0x${string}`;
        }

        const estimatedGas = await publicClient.estimateGas(txParams);
        const gasPrice = await publicClient.getGasPrice();
        const estimatedCost = estimatedGas * gasPrice;

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    estimatedGas: estimatedGas.toString(),
                    gasPrice: formatEther(gasPrice) + " XDC",
                    estimatedCost: formatEther(estimatedCost) + " XDC",
                    network: chain.name,
                    note: "These are estimates and actual gas usage may vary"
                }, null, 2)
            }]
        };
    }
    catch (error) {
        return {
            content: [{
                type: "text",
                text: `Error estimating gas: ${error instanceof Error ? error.message : String(error)}`
            }]
        };
    }
});

server.tool("get_transaction_status", {
    transactionHash: z.string().describe("Transaction hash to check"),
    network: z.enum(["mainnet", "testnet"]).optional().describe("Network to use")
}, async ({ transactionHash, network = "testnet" }) => {
    try {
        const chain = getChainConfig(network);
        const publicClient = createPublicClient({
            chain,
            transport: http()
        });

        try {
            const receipt = await publicClient.getTransactionReceipt({
                hash: ensureHash(transactionHash)
            });

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        transactionHash,
                        status: receipt.status === "success" ? "Success" : "Failed",
                        blockNumber: receipt.blockNumber.toString(),
                        blockHash: receipt.blockHash,
                        gasUsed: receipt.gasUsed.toString(),
                        from: receipt.from,
                        to: receipt.to,
                        contractAddress: receipt.contractAddress,
                        network: chain.name,
                        explorerUrl: `${chain.blockExplorers.default.url}/tx/${transactionHash}`
                    }, null, 2)
                }]
            };
        }
        catch (receiptError) {
            // If receipt not found, try to get transaction details
            try {
                const tx = await publicClient.getTransaction({
                    hash: ensureHash(transactionHash)
                });

                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            transactionHash,
                            status: "Pending",
                            blockNumber: tx.blockNumber ? tx.blockNumber.toString() : "Pending",
                            from: tx.from,
                            to: tx.to,
                            value: formatEther(tx.value) + " XDC",
                            gasPrice: formatEther(tx.gasPrice || 0n) + " XDC",
                            network: chain.name,
                            note: "Transaction is pending confirmation"
                        }, null, 2)
                    }]
                };
            }
            catch (txError) {
                return {
                    content: [{
                        type: "text",
                        text: `Transaction not found: ${transactionHash}`
                    }]
                };
            }
        }
    }
    catch (error) {
        return {
            content: [{
                type: "text",
                text: `Error checking transaction status: ${error instanceof Error ? error.message : String(error)}`
            }]
        };
    }
});

// Utility tools (keeping existing ones)
server.tool("get_xdc_balance", {
    address: z.string().describe("XDC address to check balance"),
    network: z.enum(["mainnet", "testnet"]).describe("XDC network")
}, async ({ address, network }) => {
    const chain = getChainConfig(network);
    const publicClient = createPublicClient({
        chain,
        transport: http()
    });

    try {
        const balance = await publicClient.getBalance({ address: ensureAddress(address) });
        return {
            content: [{
                type: "text",
                text: `XDC Balance: ${formatEther(balance)} XDC`
            }]
        };
    }
    catch (error) {
        return {
            content: [{
                type: "text",
                text: `Error getting balance: ${error instanceof Error ? error.message : String(error)}`
            }]
        };
    }
});

server.tool("get_network_info", {
    network: z.enum(["mainnet", "testnet"]).describe("XDC network to query")
}, async ({ network }) => {
    const chainConfig = getChainConfig(network);
    const publicClient = createPublicClient({
        chain: chainConfig,
        transport: http()
    });

    try {
        const blockNumber = await publicClient.getBlockNumber();
        const gasPrice = await publicClient.getGasPrice();

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    network: chainConfig.name,
                    chainId: chainConfig.id,
                    currentBlock: blockNumber.toString(),
                    gasPrice: formatEther(gasPrice) + " XDC",
                    rpcUrl: chainConfig.rpcUrls.default.http[0],
                    explorer: chainConfig.blockExplorers.default.url
                }, null, 2)
            }]
        };
    }
    catch (error) {
        return {
            content: [{
                type: "text",
                text: `Error getting network info: ${error instanceof Error ? error.message : String(error)}`
            }]
        };
    }
});

server.tool("get_erc20_balance", {
    tokenAddress: z.string().describe("ERC-20 token contract address"),
    walletAddress: z.string().describe("Wallet address to check"),
    network: z.enum(["mainnet", "testnet"]).describe("XDC network")
}, async ({ tokenAddress, walletAddress, network }) => {
    const chain = getChainConfig(network);
    const publicClient = createPublicClient({
        chain,
        transport: http()
    });

    try {
        const [balance, decimals, symbol] = await Promise.all([
            publicClient.readContract({
                address: ensureAddress(tokenAddress),
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [ensureAddress(walletAddress)]
            }) as Promise<bigint>,
            publicClient.readContract({
                address: ensureAddress(tokenAddress),
                abi: ERC20_ABI,
                functionName: 'decimals'
            }) as Promise<number>,
            publicClient.readContract({
                address: ensureAddress(tokenAddress),
                abi: ERC20_ABI,
                functionName: 'symbol'
            }) as Promise<string>
        ]);

        const formattedBalance = formatUnits(balance, decimals);

        return {
            content: [{
                type: "text",
                text: `${symbol} Balance: ${formattedBalance} ${symbol}`
            }]
        };
    }
    catch (error) {
        return {
            content: [{
                type: "text",
                text: `Error getting ERC-20 balance: ${error instanceof Error ? error.message : String(error)}`
            }]
        };
    }
});

server.tool("get_token_info", {
    contractAddress: z.string().describe("Token contract address"),
    network: z.enum(["mainnet", "testnet"]).describe("XDC network")
}, async ({ contractAddress, network }) => {
    const chain = getChainConfig(network);
    const publicClient = createPublicClient({
        chain,
        transport: http()
    });

    try {
        const [name, symbol, decimals, totalSupply] = await Promise.all([
            publicClient.readContract({
                address: ensureAddress(contractAddress),
                abi: ERC20_ABI,
                functionName: 'name'
            }) as Promise<string>,
            publicClient.readContract({
                address: ensureAddress(contractAddress),
                abi: ERC20_ABI,
                functionName: 'symbol'
            }) as Promise<string>,
            publicClient.readContract({
                address: ensureAddress(contractAddress),
                abi: ERC20_ABI,
                functionName: 'decimals'
            }) as Promise<number>,
            publicClient.readContract({
                address: ensureAddress(contractAddress),
                abi: ERC20_ABI,
                functionName: 'totalSupply'
            }) as Promise<bigint>
        ]);

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    name,
                    symbol,
                    decimals,
                    totalSupply: formatUnits(totalSupply, decimals),
                    contractAddress
                }, null, 2)
            }]
        };
    }
    catch (error) {
        return {
            content: [{
                type: "text",
                text: `Error getting token info: ${error instanceof Error ? error.message : String(error)}`
            }]
        };
    }
});

server.tool("get_nft_info", {
    contractAddress: z.string().describe("NFT contract address"),
    tokenId: z.string().describe("Token ID to query"),
    network: z.enum(["mainnet", "testnet"]).optional().describe("XDC network")
}, async ({ contractAddress, tokenId, network = "testnet" }) => {
    const chain = getChainConfig(network);
    const publicClient = createPublicClient({
        chain,
        transport: http()
    });

    try {
        const [owner, tokenURI] = await Promise.all([
            publicClient.readContract({
                address: ensureAddress(contractAddress),
                abi: ERC721_ABI,
                functionName: 'ownerOf',
                args: [BigInt(tokenId)]
            }) as Promise<Address>,
            publicClient.readContract({
                address: ensureAddress(contractAddress),
                abi: ERC721_ABI,
                functionName: 'tokenURI',
                args: [BigInt(tokenId)]
            }) as Promise<string>
        ]);

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    contractAddress,
                    tokenId,
                    owner,
                    tokenURI,
                    network: chain.name
                }, null, 2)
            }]
        };
    }
    catch (error) {
        return {
            content: [{
                type: "text",
                text: `Error getting NFT info: ${error instanceof Error ? error.message : String(error)}`
            }]
        };
    }
});

// Start the server
async function runServer(): Promise<void> {
    // Initialize GOAT tools first
    await initializeGoatTools();

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("XDC GOAT MCP Server Enhanced running on stdio");
}

runServer().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});