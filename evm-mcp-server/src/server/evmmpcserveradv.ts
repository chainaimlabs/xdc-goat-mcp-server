// src/server/evm-advanced-v3.ts - Advanced EVM MCP Server v3 with NFT, DeFi & RWA

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createWalletClient, http, createPublicClient, parseEther, formatEther, parseUnits, formatUnits, encodeFunctionData, decodeFunctionResult } from "viem";
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

// Create the advanced MCP server
const server = new McpServer({
    name: "advanced-evm-v3-server",
    version: "3.0.0",
});

// ERC20 ABI
const ERC20_ABI = [
    { constant: true, inputs: [{ name: "_owner", type: "address" }], name: "balanceOf", outputs: [{ name: "balance", type: "uint256" }], type: "function" },
    { constant: false, inputs: [{ name: "_to", type: "address" }, { name: "_value", type: "uint256" }], name: "transfer", outputs: [{ name: "", type: "bool" }], type: "function" },
    { constant: true, inputs: [], name: "decimals", outputs: [{ name: "", type: "uint8" }], type: "function" },
    { constant: true, inputs: [], name: "symbol", outputs: [{ name: "", type: "string" }], type: "function" },
    { constant: true, inputs: [], name: "name", outputs: [{ name: "", type: "string" }], type: "function" },
    { constant: true, inputs: [], name: "totalSupply", outputs: [{ name: "", type: "uint256" }], type: "function" },
] as const;

// ERC721 (NFT) ABI
const ERC721_ABI = [
    { constant: true, inputs: [{ name: "_owner", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], type: "function" },
    { constant: true, inputs: [{ name: "_tokenId", type: "uint256" }], name: "ownerOf", outputs: [{ name: "", type: "address" }], type: "function" },
    { constant: false, inputs: [{ name: "_from", type: "address" }, { name: "_to", type: "address" }, { name: "_tokenId", type: "uint256" }], name: "transferFrom", outputs: [], type: "function" },
    { constant: true, inputs: [{ name: "_tokenId", type: "uint256" }], name: "tokenURI", outputs: [{ name: "", type: "string" }], type: "function" },
    { constant: true, inputs: [], name: "name", outputs: [{ name: "", type: "string" }], type: "function" },
    { constant: true, inputs: [], name: "symbol", outputs: [{ name: "", type: "string" }], type: "function" },
    { constant: true, inputs: [], name: "totalSupply", outputs: [{ name: "", type: "uint256" }], type: "function" },
    { constant: false, inputs: [{ name: "_to", type: "address" }, { name: "_tokenId", type: "uint256" }], name: "approve", outputs: [], type: "function" },
    { constant: false, inputs: [{ name: "_operator", type: "address" }, { name: "_approved", type: "bool" }], name: "setApprovalForAll", outputs: [], type: "function" },
] as const;

// ERC1155 (Multi-Token) ABI
const ERC1155_ABI = [
    { constant: true, inputs: [{ name: "_owner", type: "address" }, { name: "_id", type: "uint256" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], type: "function" },
    { constant: true, inputs: [{ name: "_owners", type: "address[]" }, { name: "_ids", type: "uint256[]" }], name: "balanceOfBatch", outputs: [{ name: "", type: "uint256[]" }], type: "function" },
    { constant: false, inputs: [{ name: "_from", type: "address" }, { name: "_to", type: "address" }, { name: "_id", type: "uint256" }, { name: "_amount", type: "uint256" }, { name: "_data", type: "bytes" }], name: "safeTransferFrom", outputs: [], type: "function" },
    { constant: true, inputs: [{ name: "_id", type: "uint256" }], name: "uri", outputs: [{ name: "", type: "string" }], type: "function" },
    { constant: false, inputs: [{ name: "_operator", type: "address" }, { name: "_approved", type: "bool" }], name: "setApprovalForAll", outputs: [], type: "function" },
] as const;

// ERC3643 (T-REX Security Token) ABI - Simplified
const ERC3643_ABI = [
    { constant: true, inputs: [{ name: "_userAddress", type: "address" }], name: "isVerified", outputs: [{ name: "", type: "bool" }], type: "function" },
    { constant: true, inputs: [], name: "identityRegistry", outputs: [{ name: "", type: "address" }], type: "function" },
    { constant: true, inputs: [], name: "compliance", outputs: [{ name: "", type: "address" }], type: "function" },
    { constant: false, inputs: [{ name: "_to", type: "address" }, { name: "_amount", type: "uint256" }], name: "transfer", outputs: [{ name: "", type: "bool" }], type: "function" },
    { constant: true, inputs: [{ name: "_from", type: "address" }, { name: "_to", type: "address" }, { name: "_amount", type: "uint256" }], name: "canTransfer", outputs: [{ name: "", type: "bool" }], type: "function" },
] as const;

// ERC6960 (Dual Layer Token) ABI - Simplified
const ERC6960_ABI = [
    { constant: true, inputs: [{ name: "_account", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], type: "function" },
    { constant: true, inputs: [{ name: "_account", type: "address" }], name: "anchorBalanceOf", outputs: [{ name: "", type: "uint256" }], type: "function" },
    { constant: false, inputs: [{ name: "_amount", type: "uint256" }], name: "anchor", outputs: [], type: "function" },
    { constant: false, inputs: [{ name: "_amount", type: "uint256" }], name: "weigh", outputs: [], type: "function" },
    { constant: true, inputs: [], name: "totalAnchored", outputs: [{ name: "", type: "uint256" }], type: "function" },
] as const;

// Uniswap V3 Pool ABI - Simplified for price queries
const UNISWAP_V3_POOL_ABI = [
    { constant: true, inputs: [], name: "slot0", outputs: [{ name: "sqrtPriceX96", type: "uint160" }, { name: "tick", type: "int24" }, { name: "observationIndex", type: "uint16" }, { name: "observationCardinality", type: "uint16" }, { name: "observationCardinalityNext", type: "uint16" }, { name: "feeProtocol", type: "uint8" }, { name: "unlocked", type: "bool" }], type: "function" },
    { constant: true, inputs: [], name: "liquidity", outputs: [{ name: "", type: "uint128" }], type: "function" },
    { constant: true, inputs: [], name: "token0", outputs: [{ name: "", type: "address" }], type: "function" },
    { constant: true, inputs: [], name: "token1", outputs: [{ name: "", type: "address" }], type: "function" },
    { constant: true, inputs: [], name: "fee", outputs: [{ name: "", type: "uint24" }], type: "function" },
] as const;

async function setupAdvancedEVMv3Tools() {
    try {
        if (!process.env.WALLET_PRIVATE_KEY) {
            throw new Error("WALLET_PRIVATE_KEY environment variable is required");
        }

        const networkName = (process.env.NETWORK || 'base-sepolia') as keyof typeof NETWORKS;
        const selectedChain = NETWORKS[networkName];
        
        if (!selectedChain) {
            throw new Error(`Unsupported network: ${networkName}`);
        }

        console.log(`Setting up Advanced EVM v3 tools for ${selectedChain.name} (Chain ID: ${selectedChain.id})`);

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

        // Add all advanced tools
        await addBasicEVMTools(server, walletClient, publicClient, selectedChain, account);
        await addNFTTools(server, walletClient, publicClient, selectedChain, account);
        await addDeFiTools(server, walletClient, publicClient, selectedChain, account);
        await addRWATools(server, walletClient, publicClient, selectedChain, account);
        await addAdvancedTokenTools(server, walletClient, publicClient, selectedChain, account);

        console.log(`Registered all advanced tools with EVM MCP Server v3`);
    } catch (error) {
        console.error("Error setting up Advanced EVM v3 tools:", error);
        process.exit(1);
    }
}

async function addBasicEVMTools(server: any, walletClient: any, publicClient: any, chain: any, account: any) {
    // Native balance and transfer (same as before)
    server.tool("get_native_balance", { address: z.string().describe("Address to check balance for") },
        async (args: { address: string }) => {
            try {
                const balance = await publicClient.getBalance({ address: args.address as `0x${string}` });
                return { content: [{ type: "text" as const, text: `Native Balance: ${formatEther(balance)} ${chain.nativeCurrency.symbol}` }] };
            } catch (error) {
                return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
            }
        });

    server.tool("send_native_token", { to: z.string(), amount: z.string() },
        async (args: { to: string; amount: string }) => {
            try {
                const hash = await walletClient.sendTransaction({ to: args.to as `0x${string}`, value: parseEther(args.amount) });
                return { content: [{ type: "text" as const, text: `Transfer successful! Hash: ${hash}` }] };
            } catch (error) {
                return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
            }
        });
}

async function addNFTTools(server: any, walletClient: any, publicClient: any, chain: any, account: any) {
    // ERC721 NFT Tools
    server.tool(
        "get_nft_balance",
        {
            contractAddress: z.string().describe("NFT contract address"),
            ownerAddress: z.string().describe("Owner address")
        },
        async (args: { contractAddress: string; ownerAddress: string }) => {
            try {
                const balance = await publicClient.readContract({
                    address: args.contractAddress as `0x${string}`,
                    abi: ERC721_ABI,
                    functionName: 'balanceOf',
                    args: [args.ownerAddress as `0x${string}`],
                });

                const [name, symbol] = await Promise.all([
                    publicClient.readContract({ address: args.contractAddress as `0x${string}`, abi: ERC721_ABI, functionName: 'name' }),
                    publicClient.readContract({ address: args.contractAddress as `0x${string}`, abi: ERC721_ABI, functionName: 'symbol' })
                ]);

                return {
                    content: [{
                        type: "text" as const,
                        text: `🖼️ NFT Balance:\n📊 Count: ${balance}\n🏷️ Collection: ${name} (${symbol})\n📍 Contract: ${args.contractAddress}\n👤 Owner: ${args.ownerAddress}`
                    }]
                };
            } catch (error) {
                return { content: [{ type: "text" as const, text: `Error getting NFT balance: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
            }
        }
    );

    server.tool(
        "get_nft_metadata",
        {
            contractAddress: z.string().describe("NFT contract address"),
            tokenId: z.string().describe("Token ID")
        },
        async (args: { contractAddress: string; tokenId: string }) => {
            try {
                const [owner, tokenURI] = await Promise.all([
                    publicClient.readContract({
                        address: args.contractAddress as `0x${string}`,
                        abi: ERC721_ABI,
                        functionName: 'ownerOf',
                        args: [BigInt(args.tokenId)],
                    }),
                    publicClient.readContract({
                        address: args.contractAddress as `0x${string}`,
                        abi: ERC721_ABI,
                        functionName: 'tokenURI',
                        args: [BigInt(args.tokenId)],
                    })
                ]);

                return {
                    content: [{
                        type: "text" as const,
                        text: `🖼️ NFT Metadata:\n🆔 Token ID: ${args.tokenId}\n👤 Owner: ${owner}\n🔗 Token URI: ${tokenURI}\n📍 Contract: ${args.contractAddress}\n🔍 Explorer: ${chain.blockExplorers?.default?.url}/token/${args.contractAddress}?a=${args.tokenId}`
                    }]
                };
            } catch (error) {
                return { content: [{ type: "text" as const, text: `Error getting NFT metadata: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
            }
        }
    );

    server.tool(
        "transfer_nft",
        {
            contractAddress: z.string().describe("NFT contract address"),
            to: z.string().describe("Recipient address"),
            tokenId: z.string().describe("Token ID to transfer")
        },
        async (args: { contractAddress: string; to: string; tokenId: string }) => {
            try {
                const hash = await walletClient.writeContract({
                    address: args.contractAddress as `0x${string}`,
                    abi: ERC721_ABI,
                    functionName: 'transferFrom',
                    args: [account.address, args.to as `0x${string}`, BigInt(args.tokenId)],
                });

                return {
                    content: [{
                        type: "text" as const,
                        text: `🚀 NFT Transfer Successful!\n🆔 Token ID: ${args.tokenId}\n📍 To: ${args.to}\n🔗 Tx Hash: ${hash}\n🔍 Explorer: ${chain.blockExplorers?.default?.url}/tx/${hash}`
                    }]
                };
            } catch (error) {
                return { content: [{ type: "text" as const, text: `Error transferring NFT: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
            }
        }
    );

    // ERC1155 Multi-Token Tools
    server.tool(
        "get_erc1155_balance",
        {
            contractAddress: z.string().describe("ERC1155 contract address"),
            ownerAddress: z.string().describe("Owner address"),
            tokenId: z.string().describe("Token ID")
        },
        async (args: { contractAddress: string; ownerAddress: string; tokenId: string }) => {
            try {
                const balance = await publicClient.readContract({
                    address: args.contractAddress as `0x${string}`,
                    abi: ERC1155_ABI,
                    functionName: 'balanceOf',
                    args: [args.ownerAddress as `0x${string}`, BigInt(args.tokenId)],
                });

                const uri = await publicClient.readContract({
                    address: args.contractAddress as `0x${string}`,
                    abi: ERC1155_ABI,
                    functionName: 'uri',
                    args: [BigInt(args.tokenId)],
                });

                return {
                    content: [{
                        type: "text" as const,
                        text: `🎨 ERC1155 Balance:\n📊 Balance: ${balance}\n🆔 Token ID: ${args.tokenId}\n🔗 URI: ${uri}\n📍 Contract: ${args.contractAddress}\n👤 Owner: ${args.ownerAddress}`
                    }]
                };
            } catch (error) {
                return { content: [{ type: "text" as const, text: `Error getting ERC1155 balance: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
            }
        }
    );

    server.tool(
        "transfer_erc1155",
        {
            contractAddress: z.string().describe("ERC1155 contract address"),
            to: z.string().describe("Recipient address"),
            tokenId: z.string().describe("Token ID"),
            amount: z.string().describe("Amount to transfer")
        },
        async (args: { contractAddress: string; to: string; tokenId: string; amount: string }) => {
            try {
                const hash = await walletClient.writeContract({
                    address: args.contractAddress as `0x${string}`,
                    abi: ERC1155_ABI,
                    functionName: 'safeTransferFrom',
                    args: [account.address, args.to as `0x${string}`, BigInt(args.tokenId), BigInt(args.amount), '0x'],
                });

                return {
                    content: [{
                        type: "text" as const,
                        text: `🚀 ERC1155 Transfer Successful!\n🆔 Token ID: ${args.tokenId}\n💰 Amount: ${args.amount}\n📍 To: ${args.to}\n🔗 Tx Hash: ${hash}`
                    }]
                };
            } catch (error) {
                return { content: [{ type: "text" as const, text: `Error transferring ERC1155: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
            }
        }
    );

    // NFT Collection Analytics
    server.tool(
        "analyze_nft_collection",
        {
            contractAddress: z.string().describe("NFT contract address")
        },
        async (args: { contractAddress: string }) => {
            try {
                const [name, symbol, totalSupply] = await Promise.all([
                    publicClient.readContract({ address: args.contractAddress as `0x${string}`, abi: ERC721_ABI, functionName: 'name' }),
                    publicClient.readContract({ address: args.contractAddress as `0x${string}`, abi: ERC721_ABI, functionName: 'symbol' }),
                    publicClient.readContract({ address: args.contractAddress as `0x${string}`, abi: ERC721_ABI, functionName: 'totalSupply' }).catch(() => 'Unknown')
                ]);

                return {
                    content: [{
                        type: "text" as const,
                        text: `📊 NFT Collection Analysis:\n🏷️ Name: ${name}\n🎯 Symbol: ${symbol}\n📈 Total Supply: ${totalSupply}\n📍 Contract: ${args.contractAddress}\n🌐 Network: ${chain.name}\n🔍 Explorer: ${chain.blockExplorers?.default?.url}/token/${args.contractAddress}`
                    }]
                };
            } catch (error) {
                return { content: [{ type: "text" as const, text: `Error analyzing collection: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
            }
        }
    );
}

async function addDeFiTools(server: any, walletClient: any, publicClient: any, chain: any, account: any) {
    // Token Price from Uniswap V3
    server.tool(
        "get_token_price_uniswap",
        {
            poolAddress: z.string().describe("Uniswap V3 pool address"),
            token0Address: z.string().optional().describe("Token0 address (optional)"),
            token1Address: z.string().optional().describe("Token1 address (optional)")
        },
        async (args: { poolAddress: string; token0Address?: string; token1Address?: string }) => {
            try {
                const [slot0, liquidity, token0, token1, fee] = await Promise.all([
                    publicClient.readContract({ address: args.poolAddress as `0x${string}`, abi: UNISWAP_V3_POOL_ABI, functionName: 'slot0' }),
                    publicClient.readContract({ address: args.poolAddress as `0x${string}`, abi: UNISWAP_V3_POOL_ABI, functionName: 'liquidity' }),
                    publicClient.readContract({ address: args.poolAddress as `0x${string}`, abi: UNISWAP_V3_POOL_ABI, functionName: 'token0' }),
                    publicClient.readContract({ address: args.poolAddress as `0x${string}`, abi: UNISWAP_V3_POOL_ABI, functionName: 'token1' }),
                    publicClient.readContract({ address: args.poolAddress as `0x${string}`, abi: UNISWAP_V3_POOL_ABI, functionName: 'fee' })
                ]);

                const sqrtPriceX96 = (slot0 as any)[0];
                const tick = (slot0 as any)[1];

                // Calculate price from sqrtPriceX96
                const price = (Number(sqrtPriceX96) / (2 ** 96)) ** 2;

                return {
                    content: [{
                        type: "text" as const,
                        text: `💹 Uniswap V3 Pool Info:\n💰 Price: ${price.toFixed(8)}\n📊 Tick: ${tick}\n💧 Liquidity: ${liquidity}\n🪙 Token0: ${token0}\n🪙 Token1: ${token1}\n💸 Fee: ${Number(fee) / 10000}%\n📍 Pool: ${args.poolAddress}`
                    }]
                };
            } catch (error) {
                return { content: [{ type: "text" as const, text: `Error getting pool info: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
            }
        }
    );

    // ERC20 Token Analysis
    server.tool(
        "analyze_erc20_token",
        {
            tokenAddress: z.string().describe("ERC20 token address")
        },
        async (args: { tokenAddress: string }) => {
            try {
                const [name, symbol, decimals, totalSupply] = await Promise.all([
                    publicClient.readContract({ address: args.tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'name' }),
                    publicClient.readContract({ address: args.tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol' }),
                    publicClient.readContract({ address: args.tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals' }),
                    publicClient.readContract({ address: args.tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'totalSupply' })
                ]);

                const formattedSupply = formatUnits(totalSupply as bigint, decimals as number);

                return {
                    content: [{
                        type: "text" as const,
                        text: `🪙 ERC20 Token Analysis:\n🏷️ Name: ${name}\n🎯 Symbol: ${symbol}\n📐 Decimals: ${decimals}\n📊 Total Supply: ${formattedSupply}\n📍 Contract: ${args.tokenAddress}\n🌐 Network: ${chain.name}\n🔍 Explorer: ${chain.blockExplorers?.default?.url}/token/${args.tokenAddress}`
                    }]
                };
            } catch (error) {
                return { content: [{ type: "text" as const, text: `Error analyzing token: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
            }
        }
    );

    // DeFi Portfolio Tracker
    server.tool(
        "get_defi_portfolio",
        {
            address: z.string().optional().describe("Address to analyze (uses connected wallet if not provided)"),
            tokenAddresses: z.array(z.string()).optional().describe("Array of token addresses to check")
        },
        async (args: { address?: string; tokenAddresses?: string[] }) => {
            try {
                const targetAddress = (args.address || account.address) as `0x${string}`;
                const tokenAddresses = args.tokenAddresses || [];

                const nativeBalance = await publicClient.getBalance({ address: targetAddress });
                const portfolio = [`${chain.nativeCurrency.symbol}: ${formatEther(nativeBalance)}`];

                for (const tokenAddr of tokenAddresses) {
                    try {
                        const [balance, symbol, decimals] = await Promise.all([
                            publicClient.readContract({ address: tokenAddr as `0x${string}`, abi: ERC20_ABI, functionName: 'balanceOf', args: [targetAddress] }),
                            publicClient.readContract({ address: tokenAddr as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol' }),
                            publicClient.readContract({ address: tokenAddr as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals' })
                        ]);

                        const formattedBalance = formatUnits(balance as bigint, decimals as number);
                        portfolio.push(`${symbol}: ${formattedBalance}`);
                    } catch {
                        portfolio.push(`${tokenAddr}: Error reading balance`);
                    }
                }

                return {
                    content: [{
                        type: "text" as const,
                        text: `📊 DeFi Portfolio:\n👤 Address: ${targetAddress}\n💰 Holdings:\n${portfolio.map(p => `• ${p}`).join('\n')}\n🌐 Network: ${chain.name}`
                    }]
                };
            } catch (error) {
                return { content: [{ type: "text" as const, text: `Error getting portfolio: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
            }
        }
    );
}

async function addRWATools(server: any, walletClient: any, publicClient: any, chain: any, account: any) {
    // ERC3643 Security Token Tools
    server.tool(
        "check_erc3643_compliance",
        {
            tokenAddress: z.string().describe("ERC3643 security token address"),
            userAddress: z.string().describe("User address to check compliance")
        },
        async (args: { tokenAddress: string; userAddress: string }) => {
            try {
                const [isVerified, identityRegistry, compliance] = await Promise.all([
                    publicClient.readContract({
                        address: args.tokenAddress as `0x${string}`,
                        abi: ERC3643_ABI,
                        functionName: 'isVerified',
                        args: [args.userAddress as `0x${string}`]
                    }),
                    publicClient.readContract({
                        address: args.tokenAddress as `0x${string}`,
                        abi: ERC3643_ABI,
                        functionName: 'identityRegistry'
                    }),
                    publicClient.readContract({
                        address: args.tokenAddress as `0x${string}`,
                        abi: ERC3643_ABI,
                        functionName: 'compliance'
                    })
                ]);

                return {
                    content: [{
                        type: "text" as const,
                        text: `🏛️ ERC3643 Compliance Check:\n${isVerified ? '✅' : '❌'} Verified: ${isVerified}\n🆔 Identity Registry: ${identityRegistry}\n📋 Compliance Module: ${compliance}\n👤 User: ${args.userAddress}\n🪙 Token: ${args.tokenAddress}`
                    }]
                };
            } catch (error) {
                return { content: [{ type: "text" as const, text: `Error checking compliance: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
            }
        }
    );

    server.tool(
        "check_transfer_eligibility",
        {
            tokenAddress: z.string().describe("ERC3643 token address"),
            from: z.string().describe("Sender address"),
            to: z.string().describe("Recipient address"),
            amount: z.string().describe("Transfer amount")
        },
        async (args: { tokenAddress: string; from: string; to: string; amount: string }) => {
            try {
                const canTransfer = await publicClient.readContract({
                    address: args.tokenAddress as `0x${string}`,
                    abi: ERC3643_ABI,
                    functionName: 'canTransfer',
                    args: [args.from as `0x${string}`, args.to as `0x${string}`, BigInt(args.amount)]
                });

                return {
                    content: [{
                        type: "text" as const,
                        text: `🔍 Transfer Eligibility Check:\n${canTransfer ? '✅ Allowed' : '❌ Blocked'} Transfer Status: ${canTransfer}\n📤 From: ${args.from}\n📥 To: ${args.to}\n💰 Amount: ${args.amount}\n🪙 Token: ${args.tokenAddress}`
                    }]
                };
            } catch (error) {
                return { content: [{ type: "text" as const, text: `Error checking transfer eligibility: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
            }
        }
    );

    // ERC6960 Dual Layer Token Tools
    server.tool(
        "get_erc6960_balances",
        {
            tokenAddress: z.string().describe("ERC6960 dual layer token address"),
            accountAddress: z.string().describe("Account address to check")
        },
        async (args: { tokenAddress: string; accountAddress: string }) => {
            try {
                const [balance, anchorBalance, totalAnchored] = await Promise.all([
                    publicClient.readContract({
                        address: args.tokenAddress as `0x${string}`,
                        abi: ERC6960_ABI,
                        functionName: 'balanceOf',
                        args: [args.accountAddress as `0x${string}`]
                    }),
                    publicClient.readContract({
                        address: args.tokenAddress as `0x${string}`,
                        abi: ERC6960_ABI,
                        functionName: 'anchorBalanceOf',
                        args: [args.accountAddress as `0x${string}`]
                    }),
                    publicClient.readContract({
                        address: args.tokenAddress as `0x${string}`,
                        abi: ERC6960_ABI,
                        functionName: 'totalAnchored'
                    })
                ]);

                return {
                    content: [{
                        type: "text" as const,
                        text: `⚖️ ERC6960 Dual Layer Balances:\n💰 Regular Balance: ${formatEther(balance as bigint)}\n⚓ Anchored Balance: ${formatEther(anchorBalance as bigint)}\n📊 Total Anchored (Global): ${formatEther(totalAnchored as bigint)}\n👤 Account: ${args.accountAddress}\n🪙 Token: ${args.tokenAddress}`
                    }]
                };
            } catch (error) {
                return { content: [{ type: "text" as const, text: `Error getting dual layer balances: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
            }
        }
    );

    server.tool(
        "anchor_erc6960_tokens",
        {
            tokenAddress: z.string().describe("ERC6960 token address"),
            amount: z.string().describe("Amount to anchor")
        },
        async (args: { tokenAddress: string; amount: string }) => {
            try {
                const hash = await walletClient.writeContract({
                    address: args.tokenAddress as `0x${string}`,
                    abi: ERC6960_ABI,
                    functionName: 'anchor',
                    args: [parseEther(args.amount)]
                });

                return {
                    content: [{
                        type: "text" as const,
                        text: `⚓ Tokens Anchored Successfully!\n💰 Amount: ${args.amount}\n🔗 Tx Hash: ${hash}\n🪙 Token: ${args.tokenAddress}\n🔍 Explorer: ${chain.blockExplorers?.default?.url}/tx/${hash}`
                    }]
                };
            } catch (error) {
                return { content: [{ type: "text" as const, text: `Error anchoring tokens: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
            }
        }
    );

    // RWA Asset Tokenization Tools
    server.tool(
        "analyze_rwa_token",
        {
            tokenAddress: z.string().describe("RWA token address"),
            tokenStandard: z.enum(["ERC20", "ERC721", "ERC1155", "ERC3643", "ERC6960"]).describe("Token standard")
        },
        async (args: { tokenAddress: string; tokenStandard: string }) => {
            try {
                let analysis = `🏢 RWA Token Analysis:\n📍 Contract: ${args.tokenAddress}\n📋 Standard: ${args.tokenStandard}\n🌐 Network: ${chain.name}\n`;

                if (args.tokenStandard === "ERC3643") {
                    try {
                        const [identityRegistry, compliance] = await Promise.all([
                            publicClient.readContract({ address: args.tokenAddress as `0x${string}`, abi: ERC3643_ABI, functionName: 'identityRegistry' }),
                            publicClient.readContract({ address: args.tokenAddress as `0x${string}`, abi: ERC3643_ABI, functionName: 'compliance' })
                        ]);
                        analysis += `\n🔒 Security Token Features:\n• Identity Registry: ${identityRegistry}\n• Compliance Module: ${compliance}\n• KYC/AML Required: Yes\n• Transfer Restrictions: Yes`;
                    } catch {}
                }

                if (args.tokenStandard === "ERC6960") {
                    try {
                        const totalAnchored = await publicClient.readContract({ address: args.tokenAddress as `0x${string}`, abi: ERC6960_ABI, functionName: 'totalAnchored' });
                        analysis += `\n⚖️ Dual Layer Features:\n• Total Anchored: ${formatEther(totalAnchored as bigint)}\n• Anchor/Weigh Mechanism: Available\n• Yield Generation: Potential`;
                    } catch {}
                }

                analysis += `\n\n💡 RWA Use Cases:\n• Real Estate Tokenization\n• Commodity Tokenization\n• Securities & Bonds\n• Art & Collectibles\n• Infrastructure Assets\n\n🔍 Explorer: ${chain.blockExplorers?.default?.url}/token/${args.tokenAddress}`;

                return { content: [{ type: "text" as const, text: analysis }] };
            } catch (error) {
                return { content: [{ type: "text" as const, text: `Error analyzing RWA token: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
            }
        }
    );
}

async function addAdvancedTokenTools(server: any, walletClient: any, publicClient: any, chain: any, account: any) {
    // Multi-standard token detector
    server.tool(
        "detect_token_standard",
        {
            contractAddress: z.string().describe("Contract address to analyze")
        },
        async (args: { contractAddress: string }) => {
            try {
                const standards: string[] = [];
                const features: string[] = [];

                // Check ERC20
                try {
                    await publicClient.readContract({ address: args.contractAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'totalSupply' });
                    standards.push("ERC20");
                    features.push("Fungible Token");
                } catch {}

                // Check ERC721
                try {
                    await publicClient.readContract({ address: args.contractAddress as `0x${string}`, abi: ERC721_ABI, functionName: 'name' });
                    standards.push("ERC721");
                    features.push("Non-Fungible Token (NFT)");
                } catch {}

                // Check ERC1155
                try {
                    await publicClient.readContract({ address: args.contractAddress as `0x${string}`, abi: ERC1155_ABI, functionName: 'uri', args: [1n] });
                    standards.push("ERC1155");
                    features.push("Multi-Token Standard");
                } catch {}

                // Check ERC3643
                try {
                    await publicClient.readContract({ address: args.contractAddress as `0x${string}`, abi: ERC3643_ABI, functionName: 'identityRegistry' });
                    standards.push("ERC3643");
                    features.push("Security Token (T-REX)");
                } catch {}

                // Check ERC6960
                try {
                    await publicClient.readContract({ address: args.contractAddress as `0x${string}`, abi: ERC6960_ABI, functionName: 'totalAnchored' });
                    standards.push("ERC6960");
                    features.push("Dual Layer Token");
                } catch {}

                return {
                    content: [{
                        type: "text" as const,
                        text: `🔍 Token Standard Detection:\n📍 Contract: ${args.contractAddress}\n📋 Standards: ${standards.length > 0 ? standards.join(', ') : 'None detected'}\n🎯 Features: ${features.length > 0 ? features.join(', ') : 'Standard contract'}\n🌐 Network: ${chain.name}\n\n${standards.length === 0 ? '❌ No recognized token standards found' : '✅ Token standards detected successfully'}`
                    }]
                };
            } catch (error) {
                return { content: [{ type: "text" as const, text: `Error detecting standards: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
            }
        }
    );

    // Advanced contract interaction
    server.tool(
        "call_contract_function",
        {
            contractAddress: z.string().describe("Contract address"),
            functionName: z.string().describe("Function name to call"),
            functionAbi: z.string().describe("Function ABI as JSON string"),
            args: z.array(z.any()).optional().describe("Function arguments array"),
            isWriteFunction: z.boolean().optional().describe("Whether this is a write function (requires gas)")
        },
        async (args: { contractAddress: string; functionName: string; functionAbi: string; args?: any[]; isWriteFunction?: boolean }) => {
            try {
                const abi = JSON.parse(args.functionAbi);
                const contractArgs = args.args || [];

                if (args.isWriteFunction) {
                    const hash = await walletClient.writeContract({
                        address: args.contractAddress as `0x${string}`,
                        abi: [abi],
                        functionName: args.functionName,
                        args: contractArgs,
                    });

                    return {
                        content: [{
                            type: "text" as const,
                            text: `🔧 Contract Write Function Called:\n📍 Contract: ${args.contractAddress}\n⚙️ Function: ${args.functionName}\n🔗 Tx Hash: ${hash}\n🔍 Explorer: ${chain.blockExplorers?.default?.url}/tx/${hash}`
                        }]
                    };
                } else {
                    const result = await publicClient.readContract({
                        address: args.contractAddress as `0x${string}`,
                        abi: [abi],
                        functionName: args.functionName,
                        args: contractArgs,
                    });

                    return {
                        content: [{
                            type: "text" as const,
                            text: `🔍 Contract Read Function Result:\n📍 Contract: ${args.contractAddress}\n⚙️ Function: ${args.functionName}\n📊 Result: ${JSON.stringify(result, null, 2)}`
                        }]
                    };
                }
            } catch (error) {
                return { content: [{ type: "text" as const, text: `Error calling contract function: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
            }
        }
    );

    // Cross-chain asset bridge detector
    server.tool(
        "detect_bridged_assets",
        {
            tokenAddresses: z.array(z.string()).describe("Array of token addresses to check for bridge patterns")
        },
        async (args: { tokenAddresses: string[] }) => {
            try {
                const bridgePatterns: { [key: string]: string[] } = {};

                for (const tokenAddr of args.tokenAddresses) {
                    try {
                        const [name, symbol] = await Promise.all([
                            publicClient.readContract({ address: tokenAddr as `0x${string}`, abi: ERC20_ABI, functionName: 'name' }),
                            publicClient.readContract({ address: tokenAddr as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol' })
                        ]);

                        const patterns = [];
                        const nameStr = String(name).toLowerCase();
                        const symbolStr = String(symbol).toLowerCase();

                        if (nameStr.includes('wrapped') || symbolStr.startsWith('w')) patterns.push('Wrapped Asset');
                        if (nameStr.includes('bridged') || nameStr.includes('bridge')) patterns.push('Bridge Token');
                        if (symbolStr.includes('.e') || symbolStr.includes('av')) patterns.push('Avalanche Bridge');
                        if (symbolStr.includes('poly') || nameStr.includes('polygon')) patterns.push('Polygon Bridge');
                        if (nameStr.includes('arbitrum') || symbolStr.includes('arb')) patterns.push('Arbitrum Bridge');
                        if (nameStr.includes('optimism') || symbolStr.includes('op')) patterns.push('Optimism Bridge');

                        if (patterns.length > 0) {
                            bridgePatterns[tokenAddr] = patterns;
                        }
                    } catch {}
                }

                const analysis = Object.entries(bridgePatterns).map(([addr, patterns]) => 
                    `• ${addr}: ${patterns.join(', ')}`
                ).join('\n');

                return {
                    content: [{
                        type: "text" as const,
                        text: `🌉 Bridge Asset Detection:\n${analysis.length > 0 ? analysis : '❌ No bridge patterns detected'}\n\n🔍 Checked ${args.tokenAddresses.length} tokens\n🌐 Network: ${chain.name}`
                    }]
                };
            } catch (error) {
                return { content: [{ type: "text" as const, text: `Error detecting bridge assets: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
            }
        }
    );

    // Advanced portfolio analytics
    server.tool(
        "get_advanced_portfolio_analytics",
        {
            address: z.string().optional().describe("Address to analyze"),
            includeNFTs: z.boolean().optional().describe("Include NFT analysis"),
            includeDeFi: z.boolean().optional().describe("Include DeFi position analysis")
        },
        async (args: { address?: string; includeNFTs?: boolean; includeDeFi?: boolean }) => {
            try {
                const targetAddress = (args.address || account.address) as `0x${string}`;
                let analytics = `📊 Advanced Portfolio Analytics:\n👤 Address: ${targetAddress}\n🌐 Network: ${chain.name}\n\n`;

                // Basic balance
                const nativeBalance = await publicClient.getBalance({ address: targetAddress });
                analytics += `💰 Native Balance: ${formatEther(nativeBalance)} ${chain.nativeCurrency.symbol}\n`;

                // Transaction count (activity indicator)
                const txCount = await publicClient.getTransactionCount({ address: targetAddress });
                analytics += `📊 Transaction Count: ${txCount}\n`;
                analytics += `🎯 Activity Level: ${txCount > 1000 ? 'Very High' : txCount > 100 ? 'High' : txCount > 10 ? 'Medium' : 'Low'}\n\n`;

                if (args.includeNFTs) {
                    analytics += `🖼️ NFT Analysis:\n• Requires specific NFT contract addresses for detailed analysis\n• Use 'get_nft_balance' for specific collections\n\n`;
                }

                if (args.includeDeFi) {
                    analytics += `💹 DeFi Analysis:\n• Requires token contract addresses for detailed analysis\n• Use 'get_defi_portfolio' with token addresses\n• Check for LP tokens, staking positions, and yield farming\n\n`;
                }

                analytics += `🔍 Explorer: ${chain.blockExplorers?.default?.url}/address/${targetAddress}`;

                return { content: [{ type: "text" as const, text: analytics }] };
            } catch (error) {
                return { content: [{ type: "text" as const, text: `Error getting analytics: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
            }
        }
    );
}

// Setup tools and start server
async function main() {
    await setupAdvancedEVMv3Tools();
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.log("Advanced EVM MCP Server v3 is running...");
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down Advanced EVM MCP Server v3...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Shutting down Advanced EVM MCP Server v3...');
    process.exit(0);
});

main().catch((error) => {
    console.error("Failed to start Advanced EVM MCP Server v3:", error);
    process.exit(1);
});