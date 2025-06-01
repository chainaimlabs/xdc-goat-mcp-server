// src/server/xdc.ts - XDC Network MCP Server (Corrected)

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createWalletClient, http, createPublicClient, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";

// Define XDC Network configuration
const xdcMainnet = defineChain({
    id: 50,
    name: 'XDC Network',
    nativeCurrency: {
        decimals: 18,
        name: 'XDC',
        symbol: 'XDC',
    },
    rpcUrls: {
        default: {
            http: ['https://rpc.xinfin.network'],
        },
    },
    blockExplorers: {
        default: {
            name: 'XDC Explorer',
            url: 'https://explorer.xinfin.network',
        },
    },
});

// Define XDC testnet (Apothem)
const xdcTestnet = defineChain({
    id: 51,
    name: 'XDC Apothem Testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'TXDC',
        symbol: 'TXDC',
    },
    rpcUrls: {
        default: {
            http: ['https://rpc.apothem.network'],
        },
    },
    blockExplorers: {
        default: {
            name: 'XDC Apothem Explorer',
            url: 'https://explorer.apothem.network',
        },
    },
});

// Create the MCP server
const server = new McpServer({
    name: "xdc-mcp-server",
    version: "1.0.0",
});

async function setupXDCTools() {
    try {
        // Ensure private key is provided
        if (!process.env.WALLET_PRIVATE_KEY) {
            throw new Error("WALLET_PRIVATE_KEY environment variable is required");
        }

        // Choose network based on environment variable
        const useTestnet = process.env.XDC_TESTNET === "true";
        const selectedChain = useTestnet ? xdcTestnet : xdcMainnet;

        console.log(`Using ${selectedChain.name} (Chain ID: ${selectedChain.id})`);

        // Create account from private key
        const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`);
        
        // Create viem clients for XDC
        const walletClient = createWalletClient({
            account,
            chain: selectedChain,
            transport: http(),
        });

        const publicClient = createPublicClient({
            chain: selectedChain,
            transport: http(),
        });

        // Add XDC balance checking tool
        server.tool(
            "get_xdc_balance",
            {
                address: z.string().describe("XDC address to check balance for")
            },
            async (args) => {
                try {
                    const balance = await publicClient.getBalance({
                        address: args.address as `0x${string}`,
                    });
                    
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `XDC Balance: ${balance} wei (${Number(balance) / 1e18} XDC)`,
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Error getting XDC balance: ${error instanceof Error ? error.message : String(error)}`,
                            },
                        ],
                        isError: true,
                    };
                }
            }
        );

        // Add XDC sending tool
        server.tool(
            "send_xdc",
            {
                to: z.string().describe("Recipient XDC address"),
                amount: z.string().describe("Amount in XDC (e.g., '10.5')")
            },
            async (args) => {
                try {
                    const amountWei = BigInt(Math.floor(parseFloat(args.amount) * 1e18));
                    
                    const hash = await walletClient.sendTransaction({
                        to: args.to as `0x${string}`,
                        value: amountWei,
                    });
                    
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `XDC transfer successful!\nTo: ${args.to}\nAmount: ${args.amount} XDC\nTransaction hash: ${hash}`,
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Error sending XDC: ${error instanceof Error ? error.message : String(error)}`,
                            },
                        ],
                        isError: true,
                    };
                }
            }
        );

        // Add wallet info tool
        server.tool(
            "get_xdc_wallet_info",
            {},
            async () => {
                try {
                    const balance = await publicClient.getBalance({
                        address: account.address,
                    });

                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `XDC Wallet Info:\nAddress: ${account.address}\nBalance: ${Number(balance) / 1e18} XDC\nChain: ${selectedChain.name}\nChain ID: ${selectedChain.id}\nRPC: ${selectedChain.rpcUrls.default.http[0]}`,
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Error getting wallet info: ${error instanceof Error ? error.message : String(error)}`,
                            },
                        ],
                        isError: true,
                    };
                }
            }
        );

        // Add XDC network info tool
        server.tool(
            "get_xdc_network_info",
            {},
            async () => {
                try {
                    const blockNumber = await publicClient.getBlockNumber();
                    const gasPrice = await publicClient.getGasPrice();

                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `XDC Network Info:\nNetwork: ${selectedChain.name}\nChain ID: ${selectedChain.id}\nRPC URL: ${selectedChain.rpcUrls.default.http[0]}\nExplorer: ${selectedChain.blockExplorers?.default.url}\nCurrent Block: ${blockNumber}\nGas Price: ${Number(gasPrice) / 1e9} Gwei\nNative Currency: ${selectedChain.nativeCurrency.symbol}`,
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Error getting network info: ${error instanceof Error ? error.message : String(error)}`,
                            },
                        ],
                        isError: true,
                    };
                }
            }
        );

        // Add transaction receipt tool
        server.tool(
            "get_xdc_transaction_receipt",
            {
                hash: z.string().describe("Transaction hash to look up")
            },
            async (args) => {
                try {
                    const receipt = await publicClient.getTransactionReceipt({
                        hash: args.hash as `0x${string}`,
                    });
                    
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `XDC Transaction Receipt:\nHash: ${receipt.transactionHash}\nStatus: ${receipt.status === 'success' ? 'Success' : 'Failed'}\nBlock Number: ${receipt.blockNumber}\nGas Used: ${receipt.gasUsed}\nFrom: ${receipt.from}\nTo: ${receipt.to}\nTransaction Fee: ${Number(receipt.gasUsed * receipt.effectiveGasPrice) / 1e18} XDC`,
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Error getting transaction receipt: ${error instanceof Error ? error.message : String(error)}`,
                            },
                        ],
                        isError: true,
                    };
                }
            }
        );

        console.log(`Registered 5 XDC tools with MCP server for ${selectedChain.name}`);
    } catch (error) {
        console.error("Error setting up XDC tools:", error);
        process.exit(1);
    }
}

// Setup tools and start server
async function main() {
    await setupXDCTools();
    
    // Connect to stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.log("XDC MCP server is running...");
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down XDC MCP server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Shutting down XDC MCP server...');
    process.exit(0);
});

main().catch((error) => {
    console.error("Failed to start XDC MCP server:", error);
    process.exit(1);
});