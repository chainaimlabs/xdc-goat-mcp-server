import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// GOAT SDK imports
import { getOnChainTools } from "@goat-sdk/adapter-model-context-protocol";
import { viem } from "@goat-sdk/wallet-viem";
import { createWalletClient, http, parseEther, formatEther, parseUnits, formatUnits, custom, WalletClient, PublicClient, Address, Hash, SendTransactionParameters, WriteContractParameters, EstimateGasParameters, DeployContractParameters } from "viem";
import { privateKeyToAccount, Account } from "viem/accounts";
import { createPublicClient } from "viem";

// GOAT Plugin imports for comprehensive functionality
import { erc20 } from "@goat-sdk/plugin-erc20";        // ERC-20 token operations
// Note: These plugins may not be available yet, so we'll implement the functionality directly
// import { sendETH } from "@goat-sdk/plugin-eth";         // ETH sending plugin
// import { erc721 } from "@goat-sdk/plugin-erc721";      // ERC-721 NFT operations

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

// Define wallet interface
interface Wallet {
    id: string;
    name: string;
    role: string;
    provider: string;
    privateKey: string;
    publicAddress: string;
    isActive: boolean;
    description: string;
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

// Wallet Manager Class
class WalletConfigManager {
    private static instance: WalletConfigManager;
    private wallets = new Map<string, Wallet>();
    private currentWallet: Wallet | null = null;
    private lastActiveWalletId: string | null = null; // Track last active wallet

    constructor() {
        this.loadWallets();
    }

    static getInstance(): WalletConfigManager {
        if (!WalletConfigManager.instance) {
            WalletConfigManager.instance = new WalletConfigManager();
        }
        return WalletConfigManager.instance;
    }

    private loadWallets(): void {
        // Comprehensive wallet configurations for all providers
        const configs = [
            // MetaMask wallets - FIXED ENVIRONMENT VARIABLE NAMES
            { env: 'CAT_MM_SELLER_WALLET_PRIVATE_KEY', id: 'catmm_seller', name: 'MetaMask Seller', role: 'seller', provider: 'metamask' },
            { env: 'CAT_MM_BUYER_WALLET_PRIVATE_KEY', id: 'catmm_buyer', name: 'MetaMask Buyer', role: 'buyer', provider: 'metamask' },
            { env: 'CAT_MM_FINANCIER_WALLET_PRIVATE_KEY', id: 'catmm_financier', name: 'MetaMask Financier', role: 'financier', provider: 'metamask' },
            
            // Crossmint wallets
            { env: 'CM_SELLER_WALLET_PRIVATE_KEY', id: 'cm_seller', name: 'Crossmint Seller', role: 'seller', provider: 'crossmint' },
            { env: 'CM_BUYER_WALLET_PRIVATE_KEY', id: 'cm_buyer', name: 'Crossmint Buyer', role: 'buyer', provider: 'crossmint' },
            
            // Civic wallets  
            { env: 'CVC_SELLER_WALLET_PRIVATE_KEY', id: 'cvc_seller', name: 'Civic Seller', role: 'seller', provider: 'civic' },
            { env: 'CVC_BUYER_WALLET_PRIVATE_KEY', id: 'cvc_buyer', name: 'Civic Buyer', role: 'buyer', provider: 'civic' },
            
            // Legacy fallback
            { env: 'WALLET_PRIVATE_KEY', id: 'legacy_main', name: 'Legacy Main Wallet', role: 'legacy', provider: 'legacy' }
        ];

        let walletsLoaded = 0;
        const loadedWallets: Wallet[] = [];

        configs.forEach(config => {
            const pk = process.env[config.env];
            console.log(`🔍 Checking ${config.env}: ${pk ? 'Found' : 'Not found'}`);
            
            if (pk && pk !== '0x' && /^0x[a-fA-F0-9]{64}$/.test(pk)) {
                try {
                    const account = privateKeyToAccount(pk as `0x${string}`);
                    const wallet: Wallet = {
                        id: config.id,
                        name: config.name,
                        role: config.role,
                        provider: config.provider,
                        privateKey: pk,
                        publicAddress: account.address,
                        isActive: false,
                        description: `${config.name} wallet`
                    };
                    
                    this.wallets.set(config.id, wallet);
                    loadedWallets.push(wallet);
                    
                    walletsLoaded++;
                    console.log(`✅ Loaded: ${config.name} (${account.address}) - Role: ${config.role}`);
                } catch (e) {
                    console.warn(`⚠️ Invalid key for ${config.name}: ${e}`);
                }
            } else {
                console.log(`ℹ️ No private key found for ${config.name} (${config.env})`);
            }
        });

        // Set current wallet with proper priority
        // First, look for CAT_MM_SELLER specifically
        const priorityWallet = loadedWallets.find(w => w.id === 'catmm_seller');
        
        if (priorityWallet) {
            this.currentWallet = priorityWallet;
            this.lastActiveWalletId = priorityWallet.id;
            console.log(`🎯 Set current wallet to priority: ${priorityWallet.name}`);
        } else if (walletsLoaded > 0) {
            // Fallback to first seller, then first wallet
            const sellers = loadedWallets.filter(w => w.role === 'seller');
            const fallbackWallet = sellers[0] || loadedWallets[0];
            if (fallbackWallet) {
                this.currentWallet = fallbackWallet;
                this.lastActiveWalletId = fallbackWallet.id;
                console.log(`🎯 Set current wallet to fallback: ${fallbackWallet.name}`);
            }
        }

        console.log(`📱 Wallet Management: ${walletsLoaded} wallets loaded across all providers`);
        
        if (walletsLoaded === 0) {
            console.warn(`⚠️ No valid wallet private keys found. Please set role-based wallet environment variables:`);
            console.warn(`   - CAT_MM_SELLER_WALLET_PRIVATE_KEY for MetaMask seller operations`);
            console.warn(`   - CAT_MM_BUYER_WALLET_PRIVATE_KEY for MetaMask buyer operations`);
            console.warn(`   - And other provider-specific keys as needed`);
        }
    }

    switchWallet(id: string): boolean {
        const wallet = this.wallets.get(id);
        if (!wallet) return false;
        
        this.currentWallet = wallet;
        this.lastActiveWalletId = id;
        console.log(`🔄 Wallet switched to: ${wallet.name} (${wallet.publicAddress})`);
        return true;
    }

    getCurrentWallet(): Wallet | null {
        return this.currentWallet;
    }

    getWalletsByRole(role: string): Wallet[] {
        return Array.from(this.wallets.values()).filter(w => w.role === role);
    }

    getWalletsByProvider(provider: string): Wallet[] {
        return Array.from(this.wallets.values()).filter(w => w.provider === provider);
    }

    getWalletByRoleAndProvider(role: string, provider: string): Wallet | null {
        return Array.from(this.wallets.values()).find(w => w.role === role && w.provider === provider) || null;
    }

    getAllWallets(): Wallet[] {
        return Array.from(this.wallets.values());
    }

    // Method to restore last active wallet
    restoreLastActiveWallet(): boolean {
        if (this.lastActiveWalletId && this.wallets.has(this.lastActiveWalletId)) {
            const wallet = this.wallets.get(this.lastActiveWalletId);
            if (wallet) {
                this.currentWallet = wallet;
                console.log(`🔄 Restored last active wallet: ${wallet.name}`);
                return true;
            }
        }
        return false;
    }
}

// Global instances
const walletManager = WalletConfigManager.getInstance();
let goatTools: any = null;
let goatToolsLastWalletId: string | null = null; // Track which wallet the GOAT tools were initialized with

// Function to create wallet client from current wallet only
async function createDynamicWalletClient(network: "mainnet" | "testnet" = "testnet"): Promise<WalletClient> {
    const chain = getChainConfig(network);
    const currentWallet = walletManager.getCurrentWallet();
    
    if (!currentWallet) {
        throw new Error("No active wallet. Use switch_to_seller or switch_to_buyer to activate a wallet.");
    }
    
    const account = privateKeyToAccount(currentWallet.privateKey as `0x${string}`);
    const walletClient = createWalletClient({
        account: account,
        transport: http(process.env.RPC_PROVIDER_URL || chain.rpcUrls.default.http[0]),
        chain: chain,
    });
    
    return walletClient;
}

async function createWalletClientForWallet(wallet: Wallet, network: "mainnet" | "testnet" = "testnet"): Promise<WalletClient> {
    const chain = getChainConfig(network);
    const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);
    
    return createWalletClient({
        account,
        transport: http(process.env.RPC_PROVIDER_URL || chain.rpcUrls.default.http[0]),
        chain
    });
}

// Create MCP Server
const server = new McpServer({
    name: "XDC-GOAT-MCP-Server-Final",
    version: "5.0.0"
});

// Enhanced GOAT tools initialization with proper state tracking
async function initializeGoatTools(forceReinit: boolean = false): Promise<boolean> {
    const currentWallet = walletManager.getCurrentWallet();
    if (!currentWallet) {
        console.log("No wallet found - GOAT tools not initialized");
        goatTools = null;
        goatToolsLastWalletId = null;
        return false;
    }

    // Check if GOAT tools are already initialized for the current wallet
    if (!forceReinit && goatTools && goatToolsLastWalletId === currentWallet.id) {
        console.log(`GOAT tools already initialized for wallet: ${currentWallet.name}`);
        return true;
    }

    try {
        console.log(`🔧 Initializing GOAT tools for wallet: ${currentWallet.name}`);
        const walletClient = await createWalletClientForWallet(currentWallet);
        
        goatTools = await getOnChainTools({
            wallet: viem(walletClient),
            plugins: [
                erc20({       // ERC-20 token operations
                    tokens: [
                        // Common stablecoins for XDC testnet/mainnet - Correct GOAT SDK Token structure
                        { 
                            symbol: "USDC", 
                            name: "USD Coin", 
                            decimals: 6, 
                            chains: {
                                "50": { // XDC Mainnet
                                    contractAddress: "0x6a9b4cbf7ba131daeaf6b43ad7d24e066bb01654"
                                },
                                "51": { // XDC Testnet
                                    contractAddress: "0x6a9b4cbf7ba131daeaf6b43ad7d24e066bb01654"
                                }
                            }
                        },
                        { 
                            symbol: "USDT", 
                            name: "Tether USD", 
                            decimals: 6, 
                            chains: {
                                "50": { // XDC Mainnet
                                    contractAddress: "0x48a0c6f2bc64f0acce5065b44b9b85af1b32c02f"
                                },
                                "51": { // XDC Testnet
                                    contractAddress: "0x48a0c6f2bc64f0acce5065b44b9b85af1b32c02f"
                                }
                            }
                        },
                    ]
                }),
                // We'll implement ETH and NFT functionality directly since plugins aren't available
            ],
        });
        
        goatToolsLastWalletId = currentWallet.id;
        console.log("GOAT SDK tools initialized successfully");
        
        // Get available tools from GOAT SDK and register them
        const { listOfTools, toolHandler } = goatTools;
        const availableTools = listOfTools();
        console.log(`Found ${availableTools.length} GOAT tools ready for use`);
        
        // Register each GOAT tool dynamically
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
            } else {
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
        
        return true;
    } catch (error) {
        console.error("Error initializing GOAT tools:", error);
        goatTools = null;
        goatToolsLastWalletId = null;
        return false;
    }
}

// Helper function to ensure GOAT tools are available for current wallet
async function ensureGoatToolsForCurrentWallet(): Promise<boolean> {
    const currentWallet = walletManager.getCurrentWallet();
    if (!currentWallet) {
        return false;
    }
    
    // If GOAT tools are not initialized or initialized for a different wallet, reinitialize
    if (!goatTools || goatToolsLastWalletId !== currentWallet.id) {
        return await initializeGoatTools(true);
    }
    
    return true;
}

// Enhanced wallet switching with immediate GOAT tools reinitialization
server.tool("switch_to_seller", {
    provider: z.enum(['metamask', 'crossmint', 'civic']).optional().describe("Wallet provider preference")
}, async ({ provider = 'metamask' }) => {
    try {
        console.log(`🔄 Switching to seller with provider: ${provider}`);
        let target: Wallet | null = null;
        
        // Try to find the specific provider wallet
        if (provider === 'metamask') {
            target = walletManager.getWalletByRoleAndProvider('seller', 'metamask');
        } else if (provider === 'crossmint') {
            target = walletManager.getWalletByRoleAndProvider('seller', 'crossmint');
        } else if (provider === 'civic') {
            target = walletManager.getWalletByRoleAndProvider('seller', 'civic');
        }
        
        // If specific provider not found, look for any seller
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
                        availableWallets: walletManager.getAllWallets().map((w) => ({
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
        
        // Switch to the target wallet
        const switchSuccess = walletManager.switchWallet(target.id);
        if (!switchSuccess) {
            throw new Error(`Failed to switch to wallet ${target.id}`);
        }
        
        console.log(`✅ Switched to: ${target.name} (${target.publicAddress})`);
        
        // CRITICAL: Immediately reinitialize GOAT tools with new wallet
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
        
        // Try to find the specific provider wallet
        if (provider === 'metamask') {
            target = walletManager.getWalletByRoleAndProvider('buyer', 'metamask');
        } else if (provider === 'crossmint') {
            target = walletManager.getWalletByRoleAndProvider('buyer', 'crossmint');
        } else if (provider === 'civic') {
            target = walletManager.getWalletByRoleAndProvider('buyer', 'civic');
        }
        
        // If specific provider not found, look for any buyer
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
                        availableWallets: walletManager.getAllWallets().map((w) => ({
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
        
        // Switch to the target wallet
        const switchSuccess = walletManager.switchWallet(target.id);
        if (!switchSuccess) {
            throw new Error(`Failed to switch to wallet ${target.id}`);
        }
        
        console.log(`✅ Switched to: ${target.name} (${target.publicAddress})`);
        
        // CRITICAL: Immediately reinitialize GOAT tools with new wallet
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

// Enhanced current wallet check with GOAT tools status
server.tool("get_current_wallet", {}, async () => {
    try {
        // Attempt to restore wallet if none is active
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
        
        // Ensure GOAT tools are available
        const goatReady = await ensureGoatToolsForCurrentWallet();
        
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
                    goatToolsWalletMatch: goatToolsLastWalletId === wallet.id,
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
                    wallets: wallets.map((w) => ({
                        id: w.id,
                        name: w.name,
                        role: w.role,
                        provider: w.provider,
                        address: w.publicAddress,
                        isActive: w.id === current?.id
                    })),
                    byProvider: {
                        metamask: wallets.filter((w) => w.provider === 'metamask').length,
                        crossmint: wallets.filter((w) => w.provider === 'crossmint').length,
                        civic: wallets.filter((w) => w.provider === 'civic').length
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

// Enhanced wallet info with automatic wallet restoration
server.tool("get_wallet_info", {
    network: z.enum(["mainnet", "testnet"]).optional().describe("XDC network (defaults to testnet)")
}, async ({ network = "testnet" }) => {
    try {
        // Attempt to restore wallet if none is active
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
            
            // Ensure GOAT tools are ready
            const goatReady = await ensureGoatToolsForCurrentWallet();
            
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
                            goatToolsWalletMatch: goatToolsLastWalletId === currentWallet.id,
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
                            goatToolsWalletMatch: goatToolsLastWalletId === currentWallet.id,
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

// ERC-6960 Dual Layer Token ABI (Polytrade Finance standard)
const ERC6960_ABI = [
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

// ERC-721 ABI for NFT operations - Fixed name
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

// Enhanced ERC-721A ABI for batch minting (gas-optimized NFTs)
const ERC721A_ABI = [
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

// Enhanced NFT minting with proper wallet validation - SUPPORTS ERC-721, ERC-721A, AND ERC-6960
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
        // Attempt to restore wallet if none is active
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
        
        // Ensure GOAT tools are ready
        await ensureGoatToolsForCurrentWallet();
        
        const walletClient = await createDynamicWalletClient(network);
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
        
        // Handle different token standards
        switch (standard) {
            case "erc721a":
                // ERC-721A batch minting
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
                // ERC-6960 Dual Layer Token minting
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
                // Standard ERC-721 minting
                if (tokenURI) {
                    const writeParams: WriteContractParameters = {
                        address: ensureAddress(contractAddress),
                        abi: ERC721_ABI, // Use standard ERC721_ABI
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
                        abi: ERC721_ABI, // Use standard ERC721_ABI
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
        
        // Wait for transaction receipt
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

// ERC-6960 Dual Layer Token Tools for Polytrade Finance
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
        
        const walletClient = await createDynamicWalletClient(network);
        if (!walletClient || !walletClient.account) {
            throw new Error("Failed to create wallet client or missing account");
        }
        
        const chain = getChainConfig(network);
        const publicClient = createPublicClient({
            chain,
            transport: http()
        });
        
        // Parse the comma-separated values
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

// Add mint_nft_with_active_wallet for compatibility
server.tool("mint_nft_with_active_wallet", {
    contractAddress: z.string().describe("NFT contract address"),
    to: z.string().describe("Recipient address"),
    tokenURI: z.string().optional().describe("Token URI/metadata URL"),
    tokenId: z.string().optional().describe("Token ID (if required by contract)"),
    network: z.enum(["mainnet", "testnet"]).optional().describe("Network to use")
}, async ({ contractAddress, to, tokenURI, tokenId, network = "testnet" }) => {
    try {
        // Attempt to restore wallet if none is active
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
        
        const walletClient = await createDynamicWalletClient(network);
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

// ETH transfer function since the plugin isn't available
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
        
        const walletClient = await createDynamicWalletClient(network);
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

// Start the server
async function runServer(): Promise<void> {
    console.log('🚀 Starting XDC GOAT MCP Server with Comprehensive Token Support...');
    console.log('📝 Multi-Provider Role-based Wallet Management:');
    console.log('   - MetaMask: CAT_MM_SELLER/BUYER/FINANCIER_WALLET_PRIVATE_KEY');
    console.log('   - Crossmint: CM_SELLER/BUYER_WALLET_PRIVATE_KEY');
    console.log('   - Civic: CVC_SELLER/BUYER_WALLET_PRIVATE_KEY');
    console.log('   - Use switch_to_seller/switch_to_buyer with provider preference');
    console.log('🎯 Token Standards Supported:');
    console.log('   - ETH: Native token sending and receiving');
    console.log('   - ERC-20: Token transfers and management');
    console.log('   - ERC-721: Standard NFT minting and transfers');
    console.log('   - ERC-721A: Gas-optimized batch NFT minting');
    console.log('   - ERC-6960: Polytrade Finance dual-layer tokens');
    console.log('🔧 Agentic Minting Capabilities:');
    console.log('   - mint_nft_advanced: Multi-standard minting (ERC-721/721A/6960)');
    console.log('   - mint_erc6960_batch: Batch mint dual-layer tokens');
    console.log('   - transfer_erc6960: Transfer fractionalized assets');
    console.log('   - send_eth: Send native XDC tokens');
    console.log('   - Comprehensive wallet management and switching');
    
    // Initialize GOAT tools with the current wallet
    await initializeGoatTools();
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("✅ XDC GOAT MCP Server with Full Token Support running on stdio");
    
    const current = walletManager.getCurrentWallet();
    if (current) {
        console.log(`🎯 Active Wallet: ${current.name} (${current.publicAddress}) - Role: ${current.role} - Provider: ${current.provider}`);
    } else {
        console.log("⚠️ No active wallet - use switch_to_seller/switch_to_buyer to activate");
    }
    
    const totalWallets = walletManager.getAllWallets().length;
    const providers = {
        metamask: walletManager.getWalletsByProvider('metamask').length,
        crossmint: walletManager.getWalletsByProvider('crossmint').length,
        civic: walletManager.getWalletsByProvider('civic').length
    };
    
    console.log(`📱 Total Configured Wallets: ${totalWallets} (MetaMask: ${providers.metamask}, Crossmint: ${providers.crossmint}, Civic: ${providers.civic})`);
    
    if (goatTools) {
        const { listOfTools } = goatTools;
        const availableTools = listOfTools();
        console.log(`🔧 GOAT SDK Tools: ${availableTools.length} tools ready (ETH + ERC-20 + Custom NFT)`);
    }
    
    console.log(`🎉 Server ready with comprehensive agentic minting for ERC-721, ERC-721A, and ERC-6960!`);
    console.log(`🏦 Polytrade Finance ERC-6960 dual-layer token support enabled`);
}

runServer().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});