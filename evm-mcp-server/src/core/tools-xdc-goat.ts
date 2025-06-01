import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createPublicClient, http, parseEther, formatEther, type Hash, type Address, WriteContractParameters } from "viem";
import { 
    WalletConfigManager, 
    type Wallet, 
    getChainConfig, 
    ensureAddress, 
    createDynamicWalletClient 
} from "./wallet_manager.js";

// Helper function to ensure hash is properly typed
function ensureHash(hash: string): Hash {
    return hash as Hash;
}

// Tool Dependencies Interface
export interface ToolDependencies {
    walletManager: WalletConfigManager;
    ensureGoatToolsForCurrentWallet: () => Promise<boolean>;
    initializeGoatTools: (forceReinit?: boolean) => Promise<boolean>;
}

// Standard Token Contract ABIs
export const ERC20_ABI = [
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

// ERC-6960 Dual Layer Token ABI (Polytrade Finance standard)
export const ERC6960_ABI = [
    {
        "inputs": [{ "name": "to", "type": "address" }, { "name": "mainId", "type": "uint256" }, { "name": "subId", "type": "uint256" }, { "name": "amount", "type": "uint256" }, { "name": "data", "type": "bytes" }],
        "name": "mint",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "name": "to", "type": "address" }, { "name": "mainIds", "type": "uint256[]" }, { "name": "subIds", "type": "uint256[]" }, { "name": "amounts", "type": "uint256[]" }, { "name": "data", "type": "bytes" }],
        "name": "mintBatch",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "name": "account", "type": "address" }, { "name": "mainId", "type": "uint256" }, { "name": "subId", "type": "uint256" }],
        "name": "balanceOf",
        "outputs": [{ "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "name": "mainId", "type": "uint256" }, { "name": "subId", "type": "uint256" }],
        "name": "uri",
        "outputs": [{ "name": "", "type": "string" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "name": "from", "type": "address" }, { "name": "to", "type": "address" }, { "name": "mainId", "type": "uint256" }, { "name": "subId", "type": "uint256" }, { "name": "amount", "type": "uint256" }, { "name": "data", "type": "bytes" }],
        "name": "safeTransferFrom",
        "outputs": [],
        "stateMutability": "nonpayable",
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

// ERC-721 ABI for NFT operations
export const ERC721_ABI = [
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
        "inputs": [],
        "name": "totalSupply",
        "outputs": [{ "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "name": "from", "type": "address" }, { "name": "to", "type": "address" }, { "name": "tokenId", "type": "uint256" }],
        "name": "transferFrom",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;

// Enhanced ERC-721A ABI for batch minting
export const ERC721A_ABI = [
    {
        "inputs": [{ "name": "to", "type": "address" }, { "name": "quantity", "type": "uint256" }],
        "name": "mint",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
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
        "inputs": [],
        "name": "totalSupply",
        "outputs": [{ "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "name": "from", "type": "address" }, { "name": "to", "type": "address" }, { "name": "tokenId", "type": "uint256" }],
        "name": "transferFrom",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;

// Main function to register all tools
export function registerAllTools(server: McpServer, deps: ToolDependencies): void {
    registerWalletTools(server, deps);
    registerNFTTools(server, deps);
    registerERC6960Tools(server, deps);
    registerETHTools(server, deps);
}

// Wallet management tools
function registerWalletTools(server: McpServer, deps: ToolDependencies): void {
    const { walletManager, initializeGoatTools } = deps;

    server.tool("switch_to_seller", {
        provider: z.enum(['metamask', 'crossmint', 'civic']).optional().describe("Wallet provider preference")
    }, async ({ provider = 'metamask' }) => {
        try {
            console.log(`🔄 Switching to seller with provider: ${provider}`);
            let target: Wallet | null = null;
            
            if (provider === 'metamask') {
                target = walletManager.getWalletByRoleAndProvider('seller', 'metamask');
            } else if (provider === 'crossmint') {
                target = walletManager.getWalletByRoleAndProvider('seller', 'crossmint');
            } else if (provider === 'civic') {
                target = walletManager.getWalletByRoleAndProvider('seller', 'civic');
            }
            
            if (!target) {
                const allSellers = walletManager.getWalletsByRole('seller');
                target = allSellers[0];
                console.log(`⚠️ ${provider} seller not found, using fallback: ${target?.name || 'none'}`);
            }
            
            if (!target) {
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            error: "No seller wallet found",
                            availableWallets: walletManager.getAllWallets().map((w: Wallet) => ({
                                name: w.name,
                                role: w.role,
                                provider: w.provider,
                                address: w.publicAddress
                            })),
                            instruction: "Set seller wallet environment variables (CAT_MM_SELLER_WALLET_PRIVATE_KEY, CM_SELLER_WALLET_PRIVATE_KEY, or CVC_SELLER_WALLET_PRIVATE_KEY)"
                        })
                    }]
                };
            }
            
            const switchSuccess = walletManager.switchWallet(target.id);
            if (!switchSuccess) {
                throw new Error(`Failed to switch to wallet ${target.id}`);
            }
            
            console.log(`✅ Switched to: ${target.name} (${target.publicAddress})`);
            
            console.log(`🔧 Reinitializing GOAT tools for new wallet...`);
            const goatInitSuccess = await initializeGoatTools(true);
            
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: true,
                        message: `Switched to seller wallet${target.provider !== provider ? ` (${provider} not available, using ${target.provider})` : ''}`,
                        wallet: {
                            name: target.name,
                            address: target.publicAddress,
                            role: target.role,
                            provider: target.provider
                        },
                        goatToolsReinitialized: goatInitSuccess,
                        readyForOperations: goatInitSuccess
                    })
                }]
            };
        } catch (error) {
            console.error('❌ Error switching to seller:', error);
            return {
                content: [{
                    type: "text",
                    text: `Error switching to seller: ${error instanceof Error ? error.message : String(error)}`
                }]
            };
        }
    });

    server.tool("switch_to_buyer", {
        provider: z.enum(['metamask', 'crossmint', 'civic']).optional().describe("Wallet provider preference")
    }, async ({ provider = 'metamask' }) => {
        try {
            console.log(`🔄 Switching to buyer with provider: ${provider}`);
            let target: Wallet | null = null;
            
            if (provider === 'metamask') {
                target = walletManager.getWalletByRoleAndProvider('buyer', 'metamask');
            } else if (provider === 'crossmint') {
                target = walletManager.getWalletByRoleAndProvider('buyer', 'crossmint');
            } else if (provider === 'civic') {
                target = walletManager.getWalletByRoleAndProvider('buyer', 'civic');
            }
            
            if (!target) {
                const allBuyers = walletManager.getWalletsByRole('buyer');
                target = allBuyers[0];
                console.log(`⚠️ ${provider} buyer not found, using fallback: ${target?.name || 'none'}`);
            }
            
            if (!target) {
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            error: "No buyer wallet found",
                            availableWallets: walletManager.getAllWallets().map((w: Wallet) => ({
                                name: w.name,
                                role: w.role,
                                provider: w.provider,
                                address: w.publicAddress
                            })),
                            instruction: "Set buyer wallet environment variables (CAT_MM_BUYER_WALLET_PRIVATE_KEY, CM_BUYER_WALLET_PRIVATE_KEY, or CVC_BUYER_WALLET_PRIVATE_KEY)"
                        })
                    }]
                };
            }
            
            const switchSuccess = walletManager.switchWallet(target.id);
            if (!switchSuccess) {
                throw new Error(`Failed to switch to wallet ${target.id}`);
            }
            
            console.log(`✅ Switched to: ${target.name} (${target.publicAddress})`);
            
            console.log(`🔧 Reinitializing GOAT tools for new wallet...`);
            const goatInitSuccess = await initializeGoatTools(true);
            
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: true,
                        message: `Switched to buyer wallet${target.provider !== provider ? ` (${provider} not available, using ${target.provider})` : ''}`,
                        wallet: {
                            name: target.name,
                            address: target.publicAddress,
                            role: target.role,
                            provider: target.provider
                        },
                        goatToolsReinitialized: goatInitSuccess,
                        readyForOperations: goatInitSuccess
                    })
                }]
            };
        } catch (error) {
            console.error('❌ Error switching to buyer:', error);
            return {
                content: [{
                    type: "text",
                    text: `Error switching to buyer: ${error instanceof Error ? error.message : String(error)}`
                }]
            };
        }
    });

    server.tool("get_current_wallet", {}, async () => {
        try {
            if (!walletManager.getCurrentWallet()) {
                walletManager.restoreLastActiveWallet();
            }
            
            const wallet = walletManager.getCurrentWallet();
            if (!wallet) {
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            error: "No active wallet",
                            instruction: "Use switch_to_seller or switch_to_buyer to activate a wallet"
                        })
                    }]
                };
            }
            
            const goatReady = await deps.ensureGoatToolsForCurrentWallet();
            
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        name: wallet.name,
                        address: wallet.publicAddress,
                        role: wallet.role,
                        provider: wallet.provider,
                        id: wallet.id,
                        goatIntegration: goatReady,
                        readyForOperations: goatReady
                    })
                }]
            };
        } catch (error) {
            return {
                content: [{
                    type: "text",
                    text: `Error getting current wallet: ${error instanceof Error ? error.message : String(error)}`
                }]
            };
        }
    });

    server.tool("list_wallets", {}, async () => {
        try {
            const wallets = walletManager.getAllWallets();
            const current = walletManager.getCurrentWallet();
            
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        total: wallets.length,
                        currentWallet: current?.id || null,
                        wallets: wallets.map((w: Wallet) => ({
                            id: w.id,
                            name: w.name,
                            role: w.role,
                            provider: w.provider,
                            address: w.publicAddress,
                            isActive: w.id === current?.id
                        })),
                        byProvider: {
                            metamask: wallets.filter((w: Wallet) => w.provider === 'metamask').length,
                            crossmint: wallets.filter((w: Wallet) => w.provider === 'crossmint').length,
                            civic: wallets.filter((w: Wallet) => w.provider === 'civic').length
                        }
                    })
                }]
            };
        } catch (error) {
            return {
                content: [{
                    type: "text",
                    text: `Error listing wallets: ${error instanceof Error ? error.message : String(error)}`
                }]
            };
        }
    });

    server.tool("get_wallet_info", {
        network: z.enum(["mainnet", "testnet"]).optional().describe("XDC network (defaults to testnet)")
    }, async ({ network = "testnet" }) => {
        try {
            if (!walletManager.getCurrentWallet()) {
                walletManager.restoreLastActiveWallet();
            }
            
            const currentWallet = walletManager.getCurrentWallet();
            if (currentWallet) {
                const chain = getChainConfig(network);
                const publicClient = createPublicClient({
                    chain,
                    transport: http()
                });
                
                const goatReady = await deps.ensureGoatToolsForCurrentWallet();
                
                try {
                    const balance = await publicClient.getBalance({ address: ensureAddress(currentWallet.publicAddress) });
                    
                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify({
                                source: "Managed Wallet",
                                name: currentWallet.name,
                                address: currentWallet.publicAddress,
                                role: currentWallet.role,
                                provider: currentWallet.provider,
                                network: chain.name,
                                chainId: chain.id,
                                balance: formatEther(balance) + " " + chain.nativeCurrency.symbol,
                                isConnected: true,
                                goatIntegration: goatReady,
                                readyForOperations: goatReady
                            }, null, 2)
                        }]
                    };
                } catch (balanceError) {
                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify({
                                source: "Managed Wallet",
                                name: currentWallet.name,
                                address: currentWallet.publicAddress,
                                role: currentWallet.role,
                                provider: currentWallet.provider,
                                network: chain.name,
                                chainId: chain.id,
                                isConnected: true,
                                goatIntegration: goatReady,
                                readyForOperations: goatReady,
                                note: "Could not fetch balance - network might be unavailable"
                            }, null, 2)
                        }]
                    };
                }
            } else {
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            message: "No wallet configured",
                            instructions: [
                                "Set role-based wallet environment variables:",
                                "- CAT_MM_SELLER_WALLET_PRIVATE_KEY for MetaMask seller operations",
                                "- CAT_MM_BUYER_WALLET_PRIVATE_KEY for MetaMask buyer operations",
                                "- CM_SELLER_WALLET_PRIVATE_KEY for Crossmint seller operations",
                                "- CVC_BUYER_WALLET_PRIVATE_KEY for Civic buyer operations",
                                "Then use switch_to_seller/switch_to_buyer to activate the appropriate wallet"
                            ]
                        }, null, 2)
                    }]
                };
            }
        } catch (error) {
            return {
                content: [{
                    type: "text",
                    text: `Error getting wallet info: ${error instanceof Error ? error.message : String(error)}`
                }]
            };
        }
    });
}

// NFT Tools (ERC-721, ERC-721A, ERC-6960)
function registerNFTTools(server: McpServer, deps: ToolDependencies): void {
    const { walletManager, ensureGoatToolsForCurrentWallet } = deps;

    server.tool("mint_nft_advanced", {
        contractAddress: z.string().describe("NFT contract address"),
        to: z.string().describe("Recipient address"),
        tokenId: z.string().optional().describe("Token ID (if required by contract)"),
        tokenURI: z.string().optional().describe("Token URI/metadata URL"),
        quantity: z.string().optional().describe("Quantity for batch minting (ERC-721A)"),
        mainId: z.string().optional().describe("Main ID for ERC-6960 dual layer tokens"),
        subId: z.string().optional().describe("Sub ID for ERC-6960 dual layer tokens"),
        amount: z.string().optional().describe("Amount for ERC-6960 tokens"),
        standard: z.enum(["erc721", "erc721a", "erc6960"]).optional().describe("Token standard to use"),
        network: z.enum(["mainnet", "testnet"]).optional().describe("Network to use"),
        gasLimit: z.string().optional().describe("Gas limit for the transaction")
    }, async ({ contractAddress, to, tokenId, tokenURI, quantity, mainId, subId, amount, standard = "erc721", network = "testnet", gasLimit }) => {
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
                            instruction: "Use switch_to_seller (for minting) to activate the appropriate wallet"
                        })
                    }]
                };
            }
            
            await ensureGoatToolsForCurrentWallet();
            
            const walletClient = await createDynamicWalletClient(walletManager, network);
            if (!walletClient || !walletClient.account) {
                throw new Error("Failed to create wallet client or missing account");
            }
            
            const chain = getChainConfig(network);
            const publicClient = createPublicClient({
                chain,
                transport: http()
            });
            
            let hash: Hash;
            let operation: string;
            
            switch (standard) {
                case "erc721a":
                    if (quantity) {
                        const writeParams: WriteContractParameters = {
                            address: ensureAddress(contractAddress),
                            abi: ERC721A_ABI,
                            functionName: 'mint',
                            args: [ensureAddress(to), BigInt(quantity)],
                            gas: gasLimit ? BigInt(gasLimit) : undefined,
                            chain,
                            account: walletClient.account
                        };
                        hash = await walletClient.writeContract(writeParams);
                        operation = `Batch mint ${quantity} ERC-721A NFTs`;
                    } else if (tokenURI) {
                        const writeParams: WriteContractParameters = {
                            address: ensureAddress(contractAddress),
                            abi: ERC721A_ABI,
                            functionName: 'safeMint',
                            args: [ensureAddress(to), tokenURI],
                            gas: gasLimit ? BigInt(gasLimit) : undefined,
                            chain,
                            account: walletClient.account
                        };
                        hash = await walletClient.writeContract(writeParams);
                        operation = "Mint ERC-721A NFT with URI";
                    } else {
                        throw new Error("ERC-721A requires either quantity for batch mint or tokenURI for single mint");
                    }
                    break;
                    
                case "erc6960":
                    if (!mainId || !subId || !amount) {
                        throw new Error("ERC-6960 requires mainId, subId, and amount");
                    }
                    const writeParams: WriteContractParameters = {
                        address: ensureAddress(contractAddress),
                        abi: ERC6960_ABI,
                        functionName: 'mint',
                        args: [ensureAddress(to), BigInt(mainId), BigInt(subId), BigInt(amount), "0x"],
                        gas: gasLimit ? BigInt(gasLimit) : undefined,
                        chain,
                        account: walletClient.account
                    };
                    hash = await walletClient.writeContract(writeParams);
                    operation = `Mint ERC-6960 token (Main: ${mainId}, Sub: ${subId}, Amount: ${amount})`;
                    break;
                    
                default: // erc721
                    if (tokenURI) {
                        const writeParams: WriteContractParameters = {
                            address: ensureAddress(contractAddress),
                            abi: ERC721_ABI,
                            functionName: 'safeMint',
                            args: [ensureAddress(to), tokenURI],
                            gas: gasLimit ? BigInt(gasLimit) : undefined,
                            chain,
                            account: walletClient.account
                        };
                        hash = await walletClient.writeContract(writeParams);
                        operation = "Mint ERC-721 NFT with URI";
                    } else if (tokenId) {
                        const writeParams: WriteContractParameters = {
                            address: ensureAddress(contractAddress),
                            abi: ERC721_ABI,
                            functionName: 'mint',
                            args: [ensureAddress(to), BigInt(tokenId)],
                            gas: gasLimit ? BigInt(gasLimit) : undefined,
                            chain,
                            account: walletClient.account
                        };
                        hash = await walletClient.writeContract(writeParams);
                        operation = `Mint ERC-721 NFT with token ID ${tokenId}`;
                    } else {
                        throw new Error("ERC-721 requires either tokenId or tokenURI");
                    }
                    break;
            }
            
            const receipt = await publicClient.waitForTransactionReceipt({ hash: ensureHash(hash) });
            
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: true,
                        operation,
                        standard,
                        transactionHash: hash,
                        blockNumber: receipt.blockNumber.toString(),
                        gasUsed: receipt.gasUsed.toString(),
                        status: receipt.status === "success" ? "Success" : "Failed",
                        from: receipt.from,
                        contractAddress,
                        recipient: to,
                        details: {
                            tokenId: tokenId || "Generated by contract",
                            tokenURI: tokenURI || "N/A",
                            quantity: quantity || "1",
                            mainId: mainId || "N/A",
                            subId: subId || "N/A",
                            amount: amount || "N/A"
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
                    text: `Error minting NFT: ${error instanceof Error ? error.message : String(error)}`
                }]
            };
        }
    });

    server.tool("mint_nft_with_active_wallet", {
        contractAddress: z.string().describe("NFT contract address"),
        to: z.string().describe("Recipient address"),
        tokenURI: z.string().optional().describe("Token URI/metadata URL"),
        tokenId: z.string().optional().describe("Token ID (if required by contract)"),
        network: z.enum(["mainnet", "testnet"]).optional().describe("Network to use")
    }, async ({ contractAddress, to, tokenURI, tokenId, network = "testnet" }) => {
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
                            instruction: "Use switch_to_seller (for minting) or switch_to_buyer (for purchasing) to activate the appropriate wallet"
                        })
                    }]
                };
            }
            
            const walletClient = await createDynamicWalletClient(walletManager, network);
            if (!walletClient || !walletClient.account) {
                throw new Error("Failed to create wallet client or missing account");
            }
            
            const chain = getChainConfig(network);
            const publicClient = createPublicClient({ chain, transport: http() });
            
            let hash: Hash;
            
            if (tokenURI) {
                const writeParams: WriteContractParameters = {
                    address: ensureAddress(contractAddress),
                    abi: ERC721_ABI,
                    functionName: 'safeMint',
                    args: [ensureAddress(to), tokenURI],
                    chain,
                    account: walletClient.account
                };
                hash = await walletClient.writeContract(writeParams);
            } else if (tokenId) {
                const writeParams: WriteContractParameters = {
                    address: ensureAddress(contractAddress),
                    abi: ERC721_ABI,
                    functionName: 'mint',
                    args: [ensureAddress(to), BigInt(tokenId)],
                    chain,
                    account: walletClient.account
                };
                hash = await walletClient.writeContract(writeParams);
            } else {
                throw new Error("Either tokenURI or tokenId required");
            }
            
            const receipt = await publicClient.waitForTransactionReceipt({ hash: ensureHash(hash) });
            
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: true,
                        hash,
                        wallet: currentWallet.name,
                        tokenId: tokenId || "Generated",
                        tokenURI: tokenURI || "N/A",
                        explorer: `${chain.blockExplorers.default.url}/tx/${hash}`
                    })
                }]
            };
        } catch (error) {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
                }]
            };
        }
    });
}

// ERC-6960 Specific Tools
function registerERC6960Tools(server: McpServer, deps: ToolDependencies): void {
    const { walletManager } = deps;

    server.tool("mint_erc6960_batch", {
        contractAddress: z.string().describe("ERC-6960 contract address"),
        to: z.string().describe("Recipient address"),
        mainIds: z.string().describe("Comma-separated main IDs"),
        subIds: z.string().describe("Comma-separated sub IDs"),
        amounts: z.string().describe("Comma-separated amounts"),
        network: z.enum(["mainnet", "testnet"]).optional().describe("Network to use"),
        gasLimit: z.string().optional().describe("Gas limit for the transaction")
    }, async ({ contractAddress, to, mainIds, subIds, amounts, network = "testnet", gasLimit }) => {
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
                            instruction: "Use switch_to_seller to activate a wallet"
                        })
                    }]
                };
            }
            
            const walletClient = await createDynamicWalletClient(walletManager, network);
            if (!walletClient || !walletClient.account) {
                throw new Error("Failed to create wallet client or missing account");
            }
            
            const chain = getChainConfig(network);
            const publicClient = createPublicClient({
                chain,
                transport: http()
            });
            
            const mainIdArray = mainIds.split(',').map(id => BigInt(id.trim()));
            const subIdArray = subIds.split(',').map(id => BigInt(id.trim()));
            const amountArray = amounts.split(',').map(amount => BigInt(amount.trim()));
            
            if (mainIdArray.length !== subIdArray.length || subIdArray.length !== amountArray.length) {
                throw new Error("MainIds, subIds, and amounts arrays must have the same length");
            }
            
            const writeParams: WriteContractParameters = {
                address: ensureAddress(contractAddress),
                abi: ERC6960_ABI,
                functionName: 'mintBatch',
                args: [ensureAddress(to), mainIdArray, subIdArray, amountArray, "0x"],
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
                        operation: "Batch mint ERC-6960 tokens",
                        transactionHash: hash,
                        blockNumber: receipt.blockNumber.toString(),
                        gasUsed: receipt.gasUsed.toString(),
                        status: receipt.status === "success" ? "Success" : "Failed",
                        from: receipt.from,
                        contractAddress,
                        recipient: to,
                        details: {
                            mainIds: mainIds,
                            subIds: subIds,
                            amounts: amounts,
                            tokenCount: mainIdArray.length
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
                    text: `Error batch minting ERC-6960 tokens: ${error instanceof Error ? error.message : String(error)}`
                }]
            };
        }
    });

    server.tool("get_erc6960_balance", {
        contractAddress: z.string().describe("ERC-6960 contract address"),
        account: z.string().describe("Account address to check"),
        mainId: z.string().describe("Main ID of the token"),
        subId: z.string().describe("Sub ID of the token"),
        network: z.enum(["mainnet", "testnet"]).optional().describe("Network to use")
    }, async ({ contractAddress, account, mainId, subId, network = "testnet" }) => {
        try {
            const chain = getChainConfig(network);
            const publicClient = createPublicClient({
                chain,
                transport: http()
            });
            
            const balance = await publicClient.readContract({
                address: ensureAddress(contractAddress),
                abi: ERC6960_ABI,
                functionName: 'balanceOf',
                args: [ensureAddress(account), BigInt(mainId), BigInt(subId)]
            }) as bigint;
            
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        account,
                        contractAddress,
                        mainId,
                        subId,
                        balance: balance.toString(),
                        network: chain.name
                    }, null, 2)
                }]
            };
        } catch (error) {
            return {
                content: [{
                    type: "text",
                    text: `Error getting ERC-6960 balance: ${error instanceof Error ? error.message : String(error)}`
                }]
            };
        }
    });

    server.tool("transfer_erc6960", {
        contractAddress: z.string().describe("ERC-6960 contract address"),
        to: z.string().describe("Recipient address"),
        mainId: z.string().describe("Main ID of the token"),
        subId: z.string().describe("Sub ID of the token"),
        amount: z.string().describe("Amount to transfer"),
        network: z.enum(["mainnet", "testnet"]).optional().describe("Network to use"),
        gasLimit: z.string().optional().describe("Gas limit for the transaction")
    }, async ({ contractAddress, to, mainId, subId, amount, network = "testnet", gasLimit }) => {
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
                            instruction: "Use switch_to_seller or switch_to_buyer to activate a wallet"
                        })
                    }]
                };
            }
            
            const walletClient = await createDynamicWalletClient(walletManager, network);
            if (!walletClient || !walletClient.account) {
                throw new Error("Failed to create wallet client or missing account");
            }
            
            const chain = getChainConfig(network);
            const publicClient = createPublicClient({
                chain,
                transport: http()
            });
            
            const writeParams: WriteContractParameters = {
                address: ensureAddress(contractAddress),
                abi: ERC6960_ABI,
                functionName: 'safeTransferFrom',
                args: [ensureAddress(currentWallet.publicAddress), ensureAddress(to), BigInt(mainId), BigInt(subId), BigInt(amount), "0x"],
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
                        operation: "Transfer ERC-6960 token",
                        transactionHash: hash,
                        blockNumber: receipt.blockNumber.toString(),
                        gasUsed: receipt.gasUsed.toString(),
                        status: receipt.status === "success" ? "Success" : "Failed",
                        from: receipt.from,
                        to: receipt.to,
                        contractAddress,
                        details: {
                            mainId,
                            subId,
                            amount
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
                    text: `Error transferring ERC-6960 token: ${error instanceof Error ? error.message : String(error)}`
                }]
            };
        }
    });
}

// ETH Transfer Tools
function registerETHTools(server: McpServer, deps: ToolDependencies): void {
    const { walletManager } = deps;

    server.tool("send_eth", {
        to: z.string().describe("Recipient address"),
        amount: z.string().describe("Amount in ETH"),
        network: z.enum(["mainnet", "testnet"]).optional().describe("Network to use"),
        gasLimit: z.string().optional().describe("Gas limit for the transaction")
    }, async ({ to, amount, network = "testnet", gasLimit }) => {
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
                            instruction: "Use switch_to_seller or switch_to_buyer to activate a wallet"
                        })
                    }]
                };
            }
            
            const walletClient = await createDynamicWalletClient(walletManager, network);
            if (!walletClient || !walletClient.account) {
                throw new Error("Failed to create wallet client or missing account");
            }
            
            const chain = getChainConfig(network);
            const publicClient = createPublicClient({
                chain,
                transport: http()
            });
            
            const hash = await walletClient.sendTransaction({
                to: ensureAddress(to),
                value: parseEther(amount),
                gas: gasLimit ? BigInt(gasLimit) : undefined,
                chain,
                account: walletClient.account
            });
            
            const receipt = await publicClient.waitForTransactionReceipt({ hash: ensureHash(hash) });
            
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: true,
                        operation: "Send ETH",
                        transactionHash: hash,
                        blockNumber: receipt.blockNumber.toString(),
                        gasUsed: receipt.gasUsed.toString(),
                        status: receipt.status === "success" ? "Success" : "Failed",
                        from: receipt.from,
                        to: receipt.to,
                        amount: `${amount} ${chain.nativeCurrency.symbol}`,
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
                    text: `Error sending ETH: ${error instanceof Error ? error.message : String(error)}`
                }]
            };
        }
    });
}