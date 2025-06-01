
// src/server/evmmcpserver.ts - Fully corrected implementation

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createWalletClient, http, createPublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { z } from "zod";

// Create the MCP server
const server = new McpServer({
    name: "simple-evm-mcp-server",
    version: "1.0.0",
});

async function setupBasicTools() {
    try {
        // Ensure private key is provided
        if (!process.env.WALLET_PRIVATE_KEY) {
            throw new Error("WALLET_PRIVATE_KEY environment variable is required");
        }

        // Create account from private key
        const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`);
        
        // Create viem clients
        const walletClient = createWalletClient({
            account,
            chain: baseSepolia,
            transport: http(),
        });

        const publicClient = createPublicClient({
            chain: baseSepolia,
            transport: http(),
        });

        // Add ETH balance checking tool - CORRECTED
        server.tool(
            "get_eth_balance",
            {
                address: z.string().describe("Ethereum address to check balance for")
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
                                text: `ETH Balance: ${balance} wei (${Number(balance) / 1e18} ETH)`,
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Error getting balance: ${error instanceof Error ? error.message : String(error)}`,
                            },
                        ],
                        isError: true,
                    };
                }
            }
        );

        // Add ETH sending tool - CORRECTED
        server.tool(
            "send_eth",
            {
                to: z.string().describe("Recipient address"),
                amount: z.string().describe("Amount in ETH (e.g., '0.1')")
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
                                text: `ETH transfer successful!\nTo: ${args.to}\nAmount: ${args.amount} ETH\nTransaction hash: ${hash}`,
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Error sending ETH: ${error instanceof Error ? error.message : String(error)}`,
                            },
                        ],
                        isError: true,
                    };
                }
            }
        );

        // Add wallet info tool
        server.tool(
            "get_wallet_info",
            {},
            async () => {
                try {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Wallet Address: ${account.address}\nChain: ${baseSepolia.name}\nChain ID: ${baseSepolia.id}`,
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

        // Add gas price tool
        server.tool(
            "get_gas_price",
            {},
            async () => {
                try {
                    const gasPrice = await publicClient.getGasPrice();
                    
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Current Gas Price: ${gasPrice} wei (${Number(gasPrice) / 1e9} Gwei)`,
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Error getting gas price: ${error instanceof Error ? error.message : String(error)}`,
                            },
                        ],
                        isError: true,
                    };
                }
            }
        );

        // Add transaction receipt tool
        server.tool(
            "get_transaction_receipt",
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
                                text: `Transaction Receipt:\nHash: ${receipt.transactionHash}\nStatus: ${receipt.status === 'success' ? 'Success' : 'Failed'}\nBlock Number: ${receipt.blockNumber}\nGas Used: ${receipt.gasUsed}\nFrom: ${receipt.from}\nTo: ${receipt.to}`,
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

        console.log("Registered 5 basic EVM tools with MCP server");
    } catch (error) {
        console.error("Error setting up basic EVM tools:", error);
        process.exit(1);
    }
}

// Setup tools and start server
async function main() {
    await setupBasicTools();
    
    // Connect to stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.log("Simple EVM MCP server is running...");
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down Simple EVM MCP server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Shutting down Simple EVM MCP server...');
    process.exit(0);
});

main().catch((error) => {
    console.error("Failed to start Simple EVM MCP server:", error);
    process.exit(1);
});