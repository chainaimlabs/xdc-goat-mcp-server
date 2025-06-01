// src/server/xdc-complete.ts - Complete Working XDC Extended MCP Server

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createWalletClient, http, createPublicClient, parseEther, formatEther, parseUnits, formatUnits, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";

// XDC Network configurations
const XDC_NETWORKS = {
    mainnet: defineChain({
        id: 50,
        name: 'XDC Network',
        nativeCurrency: { decimals: 18, name: 'XDC', symbol: 'XDC' },
        rpcUrls: { default: { http: ['https://rpc.xinfin.network'] } },
        blockExplorers: { default: { name: 'XDC Explorer', url: 'https://explorer.xinfin.network' } },
    }),
    testnet: defineChain({
        id: 51,
        name: 'XDC Apothem Testnet',
        nativeCurrency: { decimals: 18, name: 'TXDC', symbol: 'TXDC' },
        rpcUrls: { default: { http: ['https://rpc.apothem.network'] } },
        blockExplorers: { default: { name: 'XDC Apothem Explorer', url: 'https://explorer.apothem.network' } },
    }),
};

// XDC ecosystem tokens
const XDC_TOKENS = {
    mainnet: [
        { symbol: "WXDC", name: "Wrapped XDC", decimals: 18, address: "0x951857744785E80e2De051c32EE7b25f9c458C42" as `0x${string}` },
        { symbol: "USDT", name: "Tether USD", decimals: 6, address: "0xD4B5f10D61916Bd6E0860144a91Ac658dE8a1437" as `0x${string}` },
        { symbol: "USDC", name: "USD Coin", decimals: 6, address: "0xD10Cc63531a514BBa7789682E487Add1f15A51E2" as `0x${string}` },
        { symbol: "WBTC", name: "Wrapped Bitcoin", decimals: 8, address: "0x3833ddF0f7a5B83b67bee21Dc25b9A92bBE76A5F" as `0x${string}` },
        { symbol: "WETH", name: "Wrapped Ethereum", decimals: 18, address: "0x3F006299eC88985c18F2cC48cC3CaafECFE9e2F8" as `0x${string}` },
    ],
    testnet: [
        { symbol: "WXDC", name: "Wrapped XDC", decimals: 18, address: "0x951857744785E80e2De051c32EE7b25f9c458C42" as `0x${string}` },
        { symbol: "TUSDT", name: "Test Tether USD", decimals: 6, address: "0xD4B5f10D61916Bd6E0860144a91Ac658dE8a1437" as `0x${string}` },
    ]
};

// Create the MCP server
const server = new McpServer({
    name: "complete-xdc-extended-server",
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

async function setupCompleteXDCTools() {
    try {
        if (!process.env.WALLET_PRIVATE_KEY) {
            throw new Error("WALLET_PRIVATE_KEY environment variable is required");
        }

        // Determine network
        const isTestnet = process.env.XDC_TESTNET === "true";
        const networkName = isTestnet ? 'testnet' : 'mainnet';
        const selectedChain = XDC_NETWORKS[networkName];
        const networkTokens = XDC_TOKENS[networkName];

        console.log(`Setting up Complete XDC tools for ${selectedChain.name} (Chain ID: ${selectedChain.id})`);

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

        // Add all XDC tools
        await addCompleteXDCTools(server, walletClient, publicClient, selectedChain, account, networkTokens);

        console.log(`Registered all tools with Complete XDC MCP server`);
    } catch (error) {
        console.error("Error setting up Complete XDC tools:", error);
        process.exit(1);
    }
}

async function addCompleteXDCTools(server: any, walletClient: any, publicClient: any, chain: any, account: any, tokens: any[]) {
    // XDC balance operations
    server.tool(
        "get_xdc_balance",
        {
            address: z.string().describe("XDC address to check balance for")
        },
        async (args: { address: string }) => {
            try {
                const balance = await publicClient.getBalance({
                    address: args.address as `0x${string}`,
                });
                
                const formattedBalance = formatEther(balance);
                const usdValue = await estimateXDCUSDValue(formattedBalance);
                
                return {
                    content: [{
                        type: "text" as const,
                        text: `XDC Balance for ${args.address}:\n💰 ${formattedBalance} ${chain.nativeCurrency.symbol}\n💵 ${usdValue}\n🔢 Wei: ${balance.toString()}\n🌐 Network: ${chain.name}\n🔍 Explorer: ${chain.blockExplorers?.default.url}/address/${args.address}`,
                    }],
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `Error getting XDC balance: ${error instanceof Error ? error.message : String(error)}`,
                    }],
                    isError: true,
                };
            }
        }
    );

    // Send XDC with advanced options
    server.tool(
        "send_xdc_advanced",
        {
            to: z.string().describe("Recipient XDC address"),
            amount: z.string().describe("Amount in XDC"),
            gasLimit: z.string().optional().describe("Custom gas limit"),
            gasPrice: z.string().optional().describe("Custom gas price in Gwei")
        },
        async (args: { to: string; amount: string; gasLimit?: string; gasPrice?: string }) => {
            try {
                const value = parseEther(args.amount);
                
                const txParams: any = {
                    to: args.to as `0x${string}`,
                    value: value,
                };

                if (args.gasLimit) {
                    txParams.gas = BigInt(args.gasLimit);
                }

                if (args.gasPrice) {
                    txParams.gasPrice = parseUnits(args.gasPrice, 9);
                }
                
                const hash = await walletClient.sendTransaction(txParams);
                
                return {
                    content: [{
                        type: "text" as const,
                        text: `🚀 XDC Transfer Successful!\n📍 To: ${args.to}\n💰 Amount: ${args.amount} ${chain.nativeCurrency.symbol}\n🔗 Transaction Hash: ${hash}\n🔍 Explorer: ${chain.blockExplorers?.default.url}/tx/${hash}\n⏱️ Status: Pending confirmation`,
                    }],
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `Error sending XDC: ${error instanceof Error ? error.message : String(error)}`,
                    }],
                    isError: true,
                };
            }
        }
    );

    // Get ERC20 token balance on XDC
    server.tool(
        "get_xdc_token_balance",
        {
            tokenAddress: z.string().describe("Token contract address"),
            ownerAddress: z.string().describe("Owner address to check balance for")
        },
        async (args: { tokenAddress: string; ownerAddress: string }) => {
            try {
                const [balance, decimals, symbol, name] = await Promise.all([
                    publicClient.readContract({
                        address: args.tokenAddress as `0x${string}`,
                        abi: ERC20_ABI,
                        functionName: 'balanceOf',
                        args: [args.ownerAddress as `0x${string}`],
                    }),
                    publicClient.readContract({
                        address: args.tokenAddress as `0x${string}`,
                        abi: ERC20_ABI,
                        functionName: 'decimals',
                    }),
                    publicClient.readContract({
                        address: args.tokenAddress as `0x${string}`,
                        abi: ERC20_ABI,
                        functionName: 'symbol',
                    }),
                    publicClient.readContract({
                        address: args.tokenAddress as `0x${string}`,
                        abi: ERC20_ABI,
                        functionName: 'name',
                    })
                ]);

                const formattedBalance = formatUnits(balance as bigint, decimals as number);
                
                return {
                    content: [{
                        type: "text" as const,
                        text: `🪙 Token Balance:\n📊 ${formattedBalance} ${symbol}\n🏷️ Token: ${name}\n📍 Contract: ${args.tokenAddress}\n👤 Owner: ${args.ownerAddress}\n🔢 Raw Balance: ${balance}\n📐 Decimals: ${decimals}`,
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

    // Transfer ERC20 tokens on XDC
    server.tool(
        "transfer_xdc_token",
        {
            tokenAddress: z.string().describe("Token contract address"),
            to: z.string().describe("Recipient address"),
            amount: z.string().describe("Amount to transfer")
        },
        async (args: { tokenAddress: string; to: string; amount: string }) => {
            try {
                const [decimals, symbol] = await Promise.all([
                    publicClient.readContract({
                        address: args.tokenAddress as `0x${string}`,
                        abi: ERC20_ABI,
                        functionName: 'decimals',
                    }),
                    publicClient.readContract({
                        address: args.tokenAddress as `0x${string}`,
                        abi: ERC20_ABI,
                        functionName: 'symbol',
                    })
                ]);

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
                        text: `🚀 Token Transfer Successful!\n🪙 Token: ${symbol}\n📍 To: ${args.to}\n💰 Amount: ${args.amount}\n🔗 Tx Hash: ${hash}\n🔍 Explorer: ${chain.blockExplorers?.default.url}/tx/${hash}`,
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

    // XDC transaction analyzer
    server.tool(
        "analyze_xdc_transaction",
        {
            hash: z.string().describe("Transaction hash to analyze")
        },
        async (args: { hash: string }) => {
            try {
                const [tx, receipt] = await Promise.all([
                    publicClient.getTransaction({ hash: args.hash as `0x${string}` }),
                    publicClient.getTransactionReceipt({ hash: args.hash as `0x${string}` })
                ]);
                
                const txFee = BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice);
                const txFeeXDC = formatEther(txFee);
                
                return {
                    content: [{
                        type: "text" as const,
                        text: `🔍 XDC Transaction Analysis:\n` +
                              `🔗 Hash: ${tx.hash}\n` +
                              `${receipt.status === 'success' ? '✅ Status: Success' : '❌ Status: Failed'}\n` +
                              `📦 Block: ${tx.blockNumber}\n` +
                              `👤 From: ${tx.from}\n` +
                              `📍 To: ${tx.to}\n` +
                              `💰 Value: ${formatEther(tx.value)} ${chain.nativeCurrency.symbol}\n` +
                              `⛽ Gas Used: ${receipt.gasUsed} / ${tx.gas}\n` +
                              `💸 Gas Price: ${formatUnits(tx.gasPrice || 0n, 9)} Gwei\n` +
                              `💳 Transaction Fee: ${txFeeXDC} ${chain.nativeCurrency.symbol}\n` +
                              `🔢 Nonce: ${tx.nonce}\n` +
                              `📊 Data Size: ${tx.input ? (tx.input.length - 2) / 2 : 0} bytes\n` +
                              `🔍 Explorer: ${chain.blockExplorers?.default.url}/tx/${args.hash}`,
                    }],
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `Error analyzing transaction: ${error instanceof Error ? error.message : String(error)}`,
                    }],
                    isError: true,
                };
            }
        }
    );

    // XDC network statistics
    server.tool(
        "get_xdc_network_stats",
        {},
        async () => {
            try {
                const [blockNumber, gasPrice, balance] = await Promise.all([
                    publicClient.getBlockNumber(),
                    publicClient.getGasPrice(),
                    publicClient.getBalance({ address: account.address })
                ]);
                
                const block = await publicClient.getBlock({ blockNumber });
                const utilization = block ? (Number(block.gasUsed) / Number(block.gasLimit) * 100).toFixed(2) : 'N/A';
                
                return {
                    content: [{
                        type: "text" as const,
                        text: `📊 XDC Network Statistics:\n` +
                              `🌐 Network: ${chain.name}\n` +
                              `🆔 Chain ID: ${chain.id}\n` +
                              `📦 Latest Block: ${blockNumber}\n` +
                              `⏱️ Block Time: ~2 seconds\n` +
                              `⛽ Gas Price: ${formatUnits(gasPrice, 9)} Gwei\n` +
                              `📈 Network Utilization: ${utilization}%\n` +
                              `💰 Your Balance: ${formatEther(balance)} ${chain.nativeCurrency.symbol}\n` +
                              `🔗 RPC: ${chain.rpcUrls.default.http[0]}\n` +
                              `🔍 Explorer: ${chain.blockExplorers?.default.url}\n` +
                              `🤝 Consensus: XDPoS (Delegated Proof of Stake)\n` +
                              `🌟 Features: Enterprise-focused, ISO 20022 compliant`,
                    }],
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `Error getting network stats: ${error instanceof Error ? error.message : String(error)}`,
                    }],
                    isError: true,
                };
            }
        }
    );

    // XDC DeFi ecosystem overview
    server.tool(
        "get_xdc_defi_ecosystem",
        {},
        async () => {
            try {
                return {
                    content: [{
                        type: "text" as const,
                        text: `🏦 XDC DeFi Ecosystem Overview:\n\n` +
                              `💱 DEXs (Decentralized Exchanges):\n` +
                              `• XinFin DEX - Native decentralized exchange\n` +
                              `• Globiance DEX - Multi-asset trading platform\n` +
                              `• XDC DEX - Community-driven exchange\n\n` +
                              `💰 Lending & Borrowing:\n` +
                              `• XDC Lend - Decentralized lending protocol\n` +
                              `• BlockFi integration - Institutional lending\n\n` +
                              `🌉 Cross-Chain Bridges:\n` +
                              `• XDC Bridge - Ethereum <-> XDC\n` +
                              `• Binance Bridge - BSC <-> XDC\n` +
                              `• Polygon Bridge - MATIC <-> XDC\n\n` +
                              `📊 Analytics & Tools:\n` +
                              `• XDC Observatory - Network analytics\n` +
                              `• XinFin Explorer - Blockchain explorer\n` +
                              `• DeFi Pulse XDC - TVL tracking\n\n` +
                              `🏢 Enterprise Solutions:\n` +
                              `• Trade Finance - Supply chain financing\n` +
                              `• Cross-border Payments - Fast & cheap\n` +
                              `• ISO 20022 Compliance - Banking standard\n` +
                              `• Regulatory Compliance - Enterprise ready\n\n` +
                              `🔗 Learn More: https://xinfin.org/`,
                    }],
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `Error getting DeFi ecosystem info: ${error instanceof Error ? error.message : String(error)}`,
                    }],
                    isError: true,
                };
            }
        }
    );

    // XDC wallet portfolio
    server.tool(
        "get_xdc_portfolio",
        {
            address: z.string().optional().describe("Address to check (uses connected wallet if not provided)")
        },
        async (args: { address?: string }) => {
            try {
                const targetAddress = (args.address || account.address) as `0x${string}`;
                
                const [balance, nonce] = await Promise.all([
                    publicClient.getBalance({ address: targetAddress }),
                    publicClient.getTransactionCount({ address: targetAddress })
                ]);
                
                const xdcBalance = formatEther(balance);
                const usdValue = await estimateXDCUSDValue(xdcBalance);
                
                // Get token balances
                const tokenBalances = [];
                for (const token of tokens) {
                    try {
                        const tokenBalance = await publicClient.readContract({
                            address: token.address,
                            abi: ERC20_ABI,
                            functionName: 'balanceOf',
                            args: [targetAddress],
                        });
                        
                        const formattedBalance = formatUnits(tokenBalance as bigint, token.decimals);
                        if (parseFloat(formattedBalance) > 0) {
                            tokenBalances.push(`${token.symbol}: ${formattedBalance}`);
                        }
                    } catch {
                        tokenBalances.push(`${token.symbol}: Error reading balance`);
                    }
                }
                
                return {
                    content: [{
                        type: "text" as const,
                        text: `📊 XDC Portfolio Summary:\n` +
                              `👤 Address: ${targetAddress}\n` +
                              `🌐 Network: ${chain.name}\n\n` +
                              `💰 Holdings:\n` +
                              `• XDC: ${xdcBalance} (${usdValue})\n` +
                              `${tokenBalances.length > 0 ? tokenBalances.map(bal => `• ${bal}`).join('\n') : '• No token balances found'}\n\n` +
                              `📊 Activity:\n` +
                              `• Transactions: ${nonce}\n` +
                              `• Account Type: ${nonce > 0 ? 'Active' : 'New'}\n\n` +
                              `🔗 Links:\n` +
                              `• Explorer: ${chain.blockExplorers?.default.url}/address/${targetAddress}\n` +
                              `• Network RPC: ${chain.rpcUrls.default.http[0]}`,
                    }],
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `Error getting portfolio: ${error instanceof Error ? error.message : String(error)}`,
                    }],
                    isError: true,
                };
            }
        }
    );

    // XDC gas price tracker and estimator
    server.tool(
        "get_xdc_gas_tracker",
        {},
        async () => {
            try {
                const gasPrice = await publicClient.getGasPrice();
                const gasPriceGwei = formatUnits(gasPrice, 9);
                
                // Estimate costs for common operations
                const transferCost = gasPrice * 21000n;
                const erc20TransferCost = gasPrice * 65000n;
                const contractDeployCost = gasPrice * 2000000n;
                const swapCost = gasPrice * 150000n;
                
                return {
                    content: [{
                        type: "text" as const,
                        text: `⛽ XDC Gas Price Tracker:\n` +
                              `💸 Current Gas Price: ${gasPriceGwei} Gwei\n\n` +
                              `📊 Estimated Transaction Costs:\n` +
                              `• XDC Transfer: ${formatEther(transferCost)} XDC (~${(parseFloat(formatEther(transferCost)) * 0.045).toFixed(4)})\n` +
                              `• Token Transfer: ${formatEther(erc20TransferCost)} XDC (~${(parseFloat(formatEther(erc20TransferCost)) * 0.045).toFixed(4)})\n` +
                              `• Token Swap: ${formatEther(swapCost)} XDC (~${(parseFloat(formatEther(swapCost)) * 0.045).toFixed(4)})\n` +
                              `• Contract Deploy: ${formatEther(contractDeployCost)} XDC (~${(parseFloat(formatEther(contractDeployCost)) * 0.045).toFixed(4)})\n\n` +
                              `🔧 Gas Limits (recommended):\n` +
                              `• Simple Transfer: 21,000\n` +
                              `• Token Transfer: 65,000\n` +
                              `• Token Swap: 150,000\n` +
                              `• Smart Contract Call: 100,000-500,000\n` +
                              `• Contract Deployment: 2,000,000+\n\n` +
                              `💡 XDC typically has very low gas fees compared to Ethereum!`,
                    }],
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `Error getting gas tracker: ${error instanceof Error ? error.message : String(error)}`,
                    }],
                    isError: true,
                };
            }
        }
    );

    // XDC address analyzer
    server.tool(
        "analyze_xdc_address",
        {
            address: z.string().describe("XDC address to analyze")
        },
        async (args: { address: string }) => {
            try {
                const [balance, nonce, code] = await Promise.all([
                    publicClient.getBalance({ address: args.address as `0x${string}` }),
                    publicClient.getTransactionCount({ address: args.address as `0x${string}` }),
                    publicClient.getBytecode({ address: args.address as `0x${string}` })
                ]);
                
                const isContract = code && code.length > 2;
                const accountAge = nonce > 0 ? 'Active (has sent transactions)' : 'New (no transactions sent)';
                
                return {
                    content: [{
                        type: "text" as const,
                        text: `🔍 XDC Address Analysis:\n` +
                              `📍 Address: ${args.address}\n` +
                              `📄 Type: ${isContract ? 'Smart Contract' : 'Externally Owned Account (EOA)'}\n` +
                              `💰 XDC Balance: ${formatEther(balance)} ${chain.nativeCurrency.symbol}\n` +
                              `📊 Transaction Count: ${nonce}\n` +
                              `👤 Account Status: ${accountAge}\n` +
                              `💻 Bytecode Size: ${code ? (code.length - 2) / 2 : 0} bytes\n` +
                              `🌐 Network: ${chain.name}\n` +
                              `🔍 Explorer: ${chain.blockExplorers?.default.url}/address/${args.address}\n\n` +
                              `${isContract ? '🤖 This is a smart contract address' : '👤 This is a regular wallet address'}`,
                    }],
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `Error analyzing address: ${error instanceof Error ? error.message : String(error)}`,
                    }],
                    isError: true,
                };
            }
        }
    );

    // XDC block explorer
    server.tool(
        "get_xdc_block_info",
        {
            blockNumber: z.string().optional().describe("Block number (latest if not provided)")
        },
        async (args: { blockNumber?: string }) => {
            try {
                const block = await publicClient.getBlock({
                    blockNumber: args.blockNumber ? BigInt(args.blockNumber) : undefined,
                    includeTransactions: true,
                });
                
                const utilization = (Number(block.gasUsed) / Number(block.gasLimit) * 100).toFixed(2);
                const blockTime = new Date(Number(block.timestamp) * 1000);
                
                return {
                    content: [{
                        type: "text" as const,
                        text: `📦 XDC Block Information:\n` +
                              `🔢 Number: ${block.number}\n` +
                              `🔗 Hash: ${block.hash}\n` +
                              `⏰ Timestamp: ${blockTime.toISOString()}\n` +
                              `📊 Transactions: ${Array.isArray(block.transactions) ? block.transactions.length : 'N/A'}\n` +
                              `⛽ Gas Used: ${block.gasUsed} / ${block.gasLimit} (${utilization}%)\n` +
                              `💸 Base Fee: ${block.baseFeePerGas ? formatUnits(block.baseFeePerGas, 9) + ' Gwei' : 'N/A'}\n` +
                              `📏 Size: ${block.size} bytes\n` +
                              `⚡ Validator: ${block.miner || 'N/A'}\n` +
                              `🔍 Explorer: ${chain.blockExplorers?.default.url}/block/${block.number}`,
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

    // XDC validator and staking info
    server.tool(
        "get_xdc_validators_info",
        {},
        async () => {
            try {
                return {
                    content: [{
                        type: "text" as const,
                        text: `🏛️ XDC Network Validators & Staking:\n\n` +
                              `⚡ Consensus Mechanism: XDPoS (XinFin Delegated Proof of Stake)\n` +
                              `🎯 Active Validators: 108 Master Nodes\n` +
                              `⏱️ Block Time: ~2 seconds\n` +
                              `💰 Staking Requirement: 10,000,000 XDC minimum\n` +
                              `🗳️ Validator Selection: Stake-based + Reputation\n\n` +
                              `🌟 Key Features:\n` +
                              `• Energy Efficient: Low carbon footprint\n` +
                              `• Fast Finality: Near-instant transaction confirmation\n` +
                              `• Democratic: Community-driven validator selection\n` +
                              `• Enterprise Ready: Built-in compliance features\n` +
                              `• Interoperable: Cross-chain compatibility\n\n` +
                              `📊 Network Performance:\n` +
                              `• TPS: 2,000+ transactions per second\n` +
                              `• Finality: 2-4 seconds\n` +
                              `• Uptime: 99.9%+ network availability\n\n` +
                              `🔗 Learn More:\n` +
                              `• XinFin.org: https://xinfin.org/\n` +
                              `• Validator Guide: https://xinfin.org/masternode\n` +
                              `• Staking Portal: https://master.xinfin.network/`,
                    }],
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `Error getting validator info: ${error instanceof Error ? error.message : String(error)}`,
                    }],
                    isError: true,
                };
            }
        }
    );

    // List available XDC tokens
    server.tool(
        "list_xdc_tokens",
        {},
        async () => {
            try {
                const tokenList = tokens.map((token, index) => 
                    `${index + 1}. ${token.name} (${token.symbol})\n   📍 Address: ${token.address}\n   📐 Decimals: ${token.decimals}`
                ).join('\n\n');
                
                return {
                    content: [{
                        type: "text" as const,
                        text: `🪙 Available Tokens on ${chain.name}:\n\n${tokenList}\n\n📊 Total: ${tokens.length} tokens\n💡 Note: These are commonly used tokens. Other tokens can be accessed using their contract addresses.\n\n🔍 Token Explorer: ${chain.blockExplorers?.default.url}`,
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

    // XDC network comparison
    server.tool(
        "compare_xdc_with_other_networks",
        {},
        async () => {
            try {
                return {
                    content: [{
                        type: "text" as const,
                        text: `⚖️ XDC Network vs Other Blockchains:\n\n` +
                              `📊 Performance Comparison:\n` +
                              `┌─────────────┬─────────┬──────────┬─────────────┐\n` +
                              `│ Network     │ TPS     │ Finality │ Avg Gas Fee │\n` +
                              `├─────────────┼─────────┼──────────┼─────────────┤\n` +
                              `│ XDC Network │ 2,000+  │ 2-4 sec  │ ~$0.00001   │\n` +
                              `│ Ethereum    │ 15      │ 6+ min   │ ~$5-50      │\n` +
                              `│ BSC         │ 100     │ 3-5 sec  │ ~$0.20      │\n` +
                              `│ Polygon     │ 7,000   │ 2-3 sec  │ ~$0.01      │\n` +
                              `│ Arbitrum    │ 4,000   │ 1-2 sec  │ ~$0.50      │\n` +
                              `└─────────────┴─────────┴──────────┴─────────────┘\n\n` +
                              `🌟 XDC Unique Advantages:\n` +
                              `• 🏢 Enterprise Focus: Built for institutional use\n` +
                              `• 📋 ISO 20022 Compliance: Banking standard support\n` +
                              `• 🌍 Trade Finance: Supply chain & cross-border payments\n` +
                              `• ⚡ Energy Efficient: XDPoS consensus\n` +
                              `• 🔒 Regulatory Ready: Compliance-first approach\n` +
                              `• 💰 Ultra-low Fees: Fraction of Ethereum costs\n` +
                              `• 🚀 Fast Finality: 2-second block times\n\n` +
                              `🎯 Best Use Cases:\n` +
                              `• Cross-border payments\n` +
                              `• Supply chain finance\n` +
                              `• Trade finance applications\n` +
                              `• DeFi with regulatory compliance\n` +
                              `• Enterprise blockchain solutions`,
                    }],
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `Error getting comparison: ${error instanceof Error ? error.message : String(error)}`,
                    }],
                    isError: true,
                };
            }
        }
    );
}

// Helper function to estimate XDC USD value
async function estimateXDCUSDValue(xdcAmount: string): Promise<string> {
    try {
        // Mock XDC price - in production, you'd call CoinGecko or similar API
        const mockPrice = process.env.XDC_USD_PRICE ? parseFloat(process.env.XDC_USD_PRICE) : 0.045;
        const usdValue = parseFloat(xdcAmount) * mockPrice;
        return `~${usdValue.toFixed(4)} USD`;
    } catch {
        return "USD value unavailable";
    }
}

// Setup tools and start server
async function main() {
    await setupCompleteXDCTools();
    
    // Connect to stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.log("Complete XDC Extended MCP server is running...");
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down Complete XDC Extended MCP server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Shutting down Complete XDC Extended MCP server...');
    process.exit(0);
});

main().catch((error) => {
    console.error("Failed to start Complete XDC Extended MCP server:", error);
    process.exit(1);
});