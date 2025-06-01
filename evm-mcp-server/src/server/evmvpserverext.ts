// src/server/evm-working-extended.ts - Working Extended EVM MCP Server

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createWalletClient, http, createPublicClient, parseEther, formatEther, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, base, arbitrum, polygon, optimism, baseSepolia } from "viem/chains";
import { z } from "zod";

// Available networks
const NETWORKS = {
    ethereum: mainnet,
    base: base,
    arbitrum: arbitrum,
    polygon: polygon,
    optimism: optimism,
    'base-sepolia': baseSepolia,
};

// Common ERC20 tokens (simplified format that works)
const COMMON_TOKENS = {
    ethereum: [
        { symbol: "USDC", name: "USD Coin", decimals: 6, address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as `0x${string}` },
        { symbol: "WETH", name: "Wrapped Ether", decimals: 18, address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as `0x${string}` },
        { symbol: "DAI", name: "Dai Stablecoin", decimals: 18, address: "0x6B175474E89094C44Da98b954EedeAC495271d0F" as `0x${string}` },
    ],
    base: [
        { symbol: "USDbC", name: "USD Base Coin", decimals: 6, address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA" as `0x${string}` },
        { symbol: "cbETH", name: "Coinbase Wrapped Staked ETH", decimals: 18, address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22" as `0x${string}` },
        { symbol: "WETH", name: "Wrapped ETH", decimals: 18, address: "0x4200000000000000000000000000000000000006" as `0x${string}` },
    ],
    arbitrum: [
        { symbol: "USDC", name: "USD Coin", decimals: 6, address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as `0x${string}` },
        { symbol: "WETH", name: "Wrapped Ether", decimals: 18, address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" as `0x${string}` },
    ],
    polygon: [
        { symbol: "USDC", name: "USD Coin", decimals: 6, address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" as `0x${string}` },
        { symbol: "WETH", name: "Wrapped Ether", decimals: 18, address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619" as `0x${string}` },
    ],
    optimism: [
        { symbol: "USDC", name: "USD Coin", decimals: 6, address: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607" as `0x${string}` },
        { symbol: "WETH", name: "Wrapped Ether", decimals: 18, address: "0x4200000000000000000000000000000000000006" as `0x${string}` },
    ],
    'base-sepolia': [
        { symbol: "USDC", name: "USD Coin", decimals: 6, address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}` },
        { symbol: "WETH", name: "Wrapped ETH", decimals: 18, address: "0x4200000000000000000000000000000000000006" as `0x${string}` },
    ],
};

// Create the MCP server
const server = new McpServer({
    name: "working-extended-evm-server",
    version: "1.0.0",
});

// ERC20 ABI for token operations
const ERC20_ABI = [
    {
        constant: true,
        inputs: [{ name: "_owner", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "balance", type: "uint256" }],
        type: "function",
    },
    {
        constant: false,
        inputs: [
            { name: "_to", type: "address" },
            { name: "_value", type: "uint256" },
        ],
        name: "transfer",
        outputs: [{ name: "", type: "bool" }],
        type: "function",
    },
    {
        constant: true,
        inputs: [],
        name: "decimals",
        outputs: [{ name: "", type: "uint8" }],
        type: "function",
    },
    {
        constant: true,
        inputs: [],
        name: "symbol",
        outputs: [{ name: "", type: "string" }],
        type: "function",
    },
    {
        constant: true,
        inputs: [],
        name: "name",
        outputs: [{ name: "", type: "string" }],
        type: "function",
    },
] as const;

async function setupWorkingExtendedTools() {
    try {
        if (!process.env.WALLET_PRIVATE_KEY) {
            throw new Error("WALLET_PRIVATE_KEY environment variable is required");
        }

        // Get network from environment or default to base-sepolia
        const networkName = (process.env.NETWORK || 'base-sepolia') as keyof typeof NETWORKS;
        const selectedChain = NETWORKS[networkName];
        const networkTokens = COMMON_TOKENS[networkName] || [];
        
        if (!selectedChain) {
            throw new Error(`Unsupported network: ${networkName}`);
        }

        console.log(`Setting up working extended tools for ${selectedChain.name} (Chain ID: ${selectedChain.id})`);

        // Create account and clients
        const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`);
        
        const walletClient = createWalletClient({
            account,
            chain: selectedChain,
            transport: http(),
        });

        const publicClient = createPublicClient({
            chain: selectedChain,
            transport: http(),
        });

        // Add all the advanced EVM tools
        await addWorkingAdvancedEVMTools(server, walletClient, publicClient, selectedChain, account, networkTokens);

        console.log(`Registered all tools with Working Extended EVM MCP server`);
    } catch (error) {
        console.error("Error setting up Working Extended EVM tools:", error);
        process.exit(1);
    }
}

async function addWorkingAdvancedEVMTools(server: any, walletClient: any, publicClient: any, chain: any, account: any, tokens: any[]) {
    // Native token balance
    server.tool(
        "get_native_balance",
        {
            address: z.string().describe("Address to check balance for")
        },
        async (args: { address: string }) => {
            try {
                const balance = await publicClient.getBalance({
                    address: args.address as `0x${string}`,
                });
                
                const formattedBalance = formatEther(balance);
                
                return {
                    content: [{
                        type: "text" as const,
                        text: `Native Balance: ${formattedBalance} ${chain.nativeCurrency.symbol}\nWei: ${balance.toString()}\nNetwork: ${chain.name}`,
                    }],
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `Error getting balance: ${error instanceof Error ? error.message : String(error)}`,
                    }],
                    isError: true,
                };
            }
        }
    );

    // Send native tokens
    server.tool(
        "send_native_token",
        {
            to: z.string().describe("Recipient address"),
            amount: z.string().describe("Amount in native token (e.g., '0.1')")
        },
        async (args: { to: string; amount: string }) => {
            try {
                const value = parseEther(args.amount);
                
                const hash = await walletClient.sendTransaction({
                    to: args.to as `0x${string}`,
                    value: value,
                });
                
                return {
                    content: [{
                        type: "text" as const,
                        text: `Transfer successful!\nTo: ${args.to}\nAmount: ${args.amount} ${chain.nativeCurrency.symbol}\nTx Hash: ${hash}\nExplorer: ${chain.blockExplorers?.default?.url}/tx/${hash}`,
                    }],
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `Error sending ${chain.nativeCurrency.symbol}: ${error instanceof Error ? error.message : String(error)}`,
                    }],
                    isError: true,
                };
            }
        }
    );

    // Get ERC20 token balance
    server.tool(
        "get_token_balance",
        {
            tokenAddress: z.string().describe("Token contract address"),
            ownerAddress: z.string().describe("Owner address to check balance for")
        },
        async (args: { tokenAddress: string; ownerAddress: string }) => {
            try {
                const balance = await publicClient.readContract({
                    address: args.tokenAddress as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'balanceOf',
                    args: [args.ownerAddress as `0x${string}`],
                });

                const decimals = await publicClient.readContract({
                    address: args.tokenAddress as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'decimals',
                });

                const symbol = await publicClient.readContract({
                    address: args.tokenAddress as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'symbol',
                });

                const formattedBalance = formatUnits(balance as bigint, decimals as number);
                
                return {
                    content: [{
                        type: "text" as const,
                        text: `Token Balance: ${formattedBalance} ${symbol}\nRaw: ${balance}\nDecimals: ${decimals}\nContract: ${args.tokenAddress}`,
                    }],
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `Error getting token balance: ${error instanceof Error ? error.message : String(error)}`,
                    }],
                    isError: true,
                };
            }
        }
    );

    // Transfer ERC20 tokens
    server.tool(
        "transfer_token",
        {
            tokenAddress: z.string().describe("Token contract address"),
            to: z.string().describe("Recipient address"),
            amount: z.string().describe("Amount to transfer")
        },
        async (args: { tokenAddress: string; to: string; amount: string }) => {
            try {
                const decimals = await publicClient.readContract({
                    address: args.tokenAddress as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'decimals',
                });

                const symbol = await publicClient.readContract({
                    address: args.tokenAddress as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'symbol',
                });

                const value = parseUnits(args.amount, decimals as number);

                const hash = await walletClient.writeContract({
                    address: args.tokenAddress as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'transfer',
                    args: [args.to as `0x${string}`, value],
                });
                
                return {
                    content: [{
                        type: "text" as const,
                        text: `Token transfer successful!\nToken: ${symbol}\nTo: ${args.to}\nAmount: ${args.amount}\nTx Hash: ${hash}\nExplorer: ${chain.blockExplorers?.default?.url}/tx/${hash}`,
                    }],
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `Error transferring token: ${error instanceof Error ? error.message : String(error)}`,
                    }],
                    isError: true,
                };
            }
        }
    );

    // Get transaction details
    server.tool(
        "get_transaction",
        {
            hash: z.string().describe("Transaction hash")
        },
        async (args: { hash: string }) => {
            try {
                const tx = await publicClient.getTransaction({
                    hash: args.hash as `0x${string}`,
                });
                
                return {
                    content: [{
                        type: "text" as const,
                        text: `Transaction Details:\nHash: ${tx.hash}\nFrom: ${tx.from}\nTo: ${tx.to}\nValue: ${formatEther(tx.value)} ${chain.nativeCurrency.symbol}\nGas: ${tx.gas}\nGas Price: ${tx.gasPrice ? formatUnits(tx.gasPrice, 9) : 'N/A'} Gwei\nBlock: ${tx.blockNumber}\nNonce: ${tx.nonce}\nStatus: ${tx.blockNumber ? 'Confirmed' : 'Pending'}`,
                    }],
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `Error getting transaction: ${error instanceof Error ? error.message : String(error)}`,
                    }],
                    isError: true,
                };
            }
        }
    );

    // Get transaction receipt
    server.tool(
        "get_transaction_receipt",
        {
            hash: z.string().describe("Transaction hash")
        },
        async (args: { hash: string }) => {
            try {
                const receipt = await publicClient.getTransactionReceipt({
                    hash: args.hash as `0x${string}`,
                });
                
                return {
                    content: [{
                        type: "text" as const,
                        text: `Transaction Receipt:\nHash: ${receipt.transactionHash}\nStatus: ${receipt.status === 'success' ? '✅ Success' : '❌ Failed'}\nBlock: ${receipt.blockNumber}\nGas Used: ${receipt.gasUsed}\nEffective Gas Price: ${receipt.effectiveGasPrice ? formatUnits(receipt.effectiveGasPrice, 9) : 'N/A'} Gwei\nContract Created: ${receipt.contractAddress || 'None'}\nLogs: ${receipt.logs.length} events`,
                    }],
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `Error getting receipt: ${error instanceof Error ? error.message : String(error)}`,
                    }],
                    isError: true,
                };
            }
        }
    );

    // Get block information
    server.tool(
        "get_block_info",
        {
            blockNumber: z.string().optional().describe("Block number (latest if not provided)")
        },
        async (args: { blockNumber?: string }) => {
            try {
                const block = await publicClient.getBlock({
                    blockNumber: args.blockNumber ? BigInt(args.blockNumber) : undefined,
                    includeTransactions: true,
                });
                
                return {
                    content: [{
                        type: "text" as const,
                        text: `Block Information:\nNumber: ${block.number}\nHash: ${block.hash}\nTimestamp: ${new Date(Number(block.timestamp) * 1000).toISOString()}\nTransactions: ${block.transactions.length}\nGas Used: ${block.gasUsed} / ${block.gasLimit} (${(Number(block.gasUsed) / Number(block.gasLimit) * 100).toFixed(2)}%)\nBase Fee: ${block.baseFeePerGas ? formatUnits(block.baseFeePerGas, 9) + ' Gwei' : 'N/A'}\nSize: ${block.size} bytes`,
                    }],
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `Error getting block info: ${error instanceof Error ? error.message : String(error)}`,
                    }],
                    isError: true,
                };
            }
        }
    );

    // Check if address is a contract
    server.tool(
        "is_contract",
        {
            address: z.string().describe("Address to check")
        },
        async (args: { address: string }) => {
            try {
                const code = await publicClient.getBytecode({
                    address: args.address as `0x${string}`,
                });
                
                const isContract = code && code.length > 2;
                
                return {
                    content: [{
                        type: "text" as const,
                        text: `Address Analysis:\nAddress: ${args.address}\nType: ${isContract ? '📄 Smart Contract' : '👤 Externally Owned Account (EOA)'}\nBytecode Size: ${code ? (code.length - 2) / 2 : 0} bytes\nExplorer: ${chain.blockExplorers?.default?.url}/address/${args.address}`,
                    }],
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `Error checking address: ${error instanceof Error ? error.message : String(error)}`,
                    }],
                    isError: true,
                };
            }
        }
    );

    // Get gas information
    server.tool(
        "get_gas_info",
        {},
        async () => {
            try {
                const gasPrice = await publicClient.getGasPrice();
                const block = await publicClient.getBlock();
                
                return {
                    content: [{
                        type: "text" as const,
                        text: `Gas Information:\nCurrent Gas Price: ${formatUnits(gasPrice, 9)} Gwei\nBase Fee: ${block.baseFeePerGas ? formatUnits(block.baseFeePerGas, 9) + ' Gwei' : 'N/A'}\nNetwork Utilization: ${(Number(block.gasUsed) / Number(block.gasLimit) * 100).toFixed(2)}%\n\nEstimated Costs (at current gas price):\n• Simple Transfer: ~${formatEther(gasPrice * 21000n)} ${chain.nativeCurrency.symbol}\n• Token Transfer: ~${formatEther(gasPrice * 65000n)} ${chain.nativeCurrency.symbol}\n• Contract Interaction: ~${formatEther(gasPrice * 150000n)} ${chain.nativeCurrency.symbol}`,
                    }],
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `Error getting gas info: ${error instanceof Error ? error.message : String(error)}`,
                    }],
                    isError: true,
                };
            }
        }
    );

    // Estimate gas for transaction
    server.tool(
        "estimate_gas",
        {
            to: z.string().describe("Recipient address"),
            value: z.string().optional().describe("Value to send"),
            data: z.string().optional().describe("Transaction data (hex)")
        },
        async (args: { to: string; value?: string; data?: string }) => {
            try {
                const gasEstimate = await publicClient.estimateGas({
                    account: account.address,
                    to: args.to as `0x${string}`,
                    value: args.value ? parseEther(args.value) : undefined,
                    data: args.data as `0x${string}` || undefined,
                });
                
                const gasPrice = await publicClient.getGasPrice();
                const estimatedCost = formatEther(BigInt(gasEstimate) * gasPrice);
                
                return {
                    content: [{
                        type: "text" as const,
                        text: `Gas Estimation:\nEstimated Gas: ${gasEstimate.toString()} units\nCurrent Gas Price: ${formatUnits(gasPrice, 9)} Gwei\nEstimated Cost: ${estimatedCost} ${chain.nativeCurrency.symbol}`,
                    }],
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `Error estimating gas: ${error instanceof Error ? error.message : String(error)}`,
                    }],
                    isError: true,
                };
            }
        }
    );

    // Get network information
    server.tool(
        "get_network_info",
        {},
        async () => {
            try {
                const [blockNumber, gasPrice] = await Promise.all([
                    publicClient.getBlockNumber(),
                    publicClient.getGasPrice()
                ]);
                
                return {
                    content: [{
                        type: "text" as const,
                        text: `Network Information:\n🌐 Name: ${chain.name}\n🔢 Chain ID: ${chain.id}\n📦 Latest Block: ${blockNumber}\n⛽ Gas Price: ${formatUnits(gasPrice, 9)} Gwei\n💰 Native Currency: ${chain.nativeCurrency.symbol}\n🔗 RPC: ${chain.rpcUrls.default.http[0]}\n🔍 Explorer: ${chain.blockExplorers?.default?.url || 'N/A'}\n🪙 Available Tokens: ${tokens.length}`,
                    }],
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `Error getting network info: ${error instanceof Error ? error.message : String(error)}`,
                    }],
                    isError: true,
                };
            }
        }
    );

    // Get wallet information
    server.tool(
        "get_wallet_info",
        {},
        async () => {
            try {
                const [balance, nonce] = await Promise.all([
                    publicClient.getBalance({ address: account.address }),
                    publicClient.getTransactionCount({ address: account.address })
                ]);
                
                return {
                    content: [{
                        type: "text" as const,
                        text: `Wallet Information:\n👤 Address: ${account.address}\n💰 Balance: ${formatEther(balance)} ${chain.nativeCurrency.symbol}\n📊 Nonce: ${nonce}\n🌐 Network: ${chain.name} (${chain.id})\n🔍 Explorer: ${chain.blockExplorers?.default?.url}/address/${account.address}`,
                    }],
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `Error getting wallet info: ${error instanceof Error ? error.message : String(error)}`,
                    }],
                    isError: true,
                };
            }
        }
    );

    // Get all token balances for wallet
    server.tool(
        "get_all_token_balances",
        {
            address: z.string().optional().describe("Address to check (uses connected wallet if not provided)")
        },
        async (args: { address?: string }) => {
            try {
                const targetAddress = (args.address || account.address) as `0x${string}`;
                const balances = [];
                
                // Get native balance
                const nativeBalance = await publicClient.getBalance({ address: targetAddress });
                balances.push(`${chain.nativeCurrency.symbol}: ${formatEther(nativeBalance)}`);
                
                // Get token balances
                for (const token of tokens) {
                    try {
                        const balance = await publicClient.readContract({
                            address: token.address,
                            abi: ERC20_ABI,
                            functionName: 'balanceOf',
                            args: [targetAddress],
                        });
                        
                        const formattedBalance = formatUnits(balance as bigint, token.decimals);
                        if (parseFloat(formattedBalance) > 0) {
                            balances.push(`${token.symbol}: ${formattedBalance}`);
                        } else {
                            balances.push(`${token.symbol}: 0`);
                        }
                    } catch {
                        balances.push(`${token.symbol}: Error reading balance`);
                    }
                }
                
                return {
                    content: [{
                        type: "text" as const,
                        text: `Token Balances for ${targetAddress}:\n${balances.join('\n')}\n\nNetwork: ${chain.name}\nExplorer: ${chain.blockExplorers?.default?.url}/address/${targetAddress}`,
                    }],
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `Error getting token balances: ${error instanceof Error ? error.message : String(error)}`,
                    }],
                    isError: true,
                };
            }
        }
    );

    // List available tokens
    server.tool(
        "list_available_tokens",
        {},
        async () => {
            try {
                const tokenList = tokens.map((token, index) => 
                    `${index + 1}. ${token.name} (${token.symbol})\n   Address: ${token.address}\n   Decimals: ${token.decimals}`
                ).join('\n\n');
                
                return {
                    content: [{
                        type: "text" as const,
                        text: `Available Tokens on ${chain.name}:\n\n${tokenList}\n\nTotal: ${tokens.length} tokens\nNote: These are commonly used tokens. Other tokens can be accessed using their contract addresses.`,
                    }],
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `Error listing tokens: ${error instanceof Error ? error.message : String(error)}`,
                    }],
                    isError: true,
                };
            }
        }
    );
}

// Setup tools and start server
async function main() {
    await setupWorkingExtendedTools();
    
    // Connect to stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.log("Working Extended EVM MCP server is running...");
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down Working Extended EVM MCP server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Shutting down Working Extended EVM MCP server...');
    process.exit(0);
});

main().catch((error) => {
    console.error("Failed to start Working Extended EVM MCP server:", error);
    process.exit(1);
});