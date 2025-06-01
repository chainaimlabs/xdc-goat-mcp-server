import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// GOAT SDK imports
import { getOnChainTools } from "@goat-sdk/adapter-model-context-protocol";
import { viem } from "@goat-sdk/wallet-viem";
import { createWalletClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient } from "viem";
import 'dotenv/config';

// Global state for browser wallet
let browserWallet = null;

console.log(' env  PK  ', process.env.WALLET_PRIVATE_KEY);
console.log(' env  RPC  ', process.env.RPC_PROVIDER_URL);

// XDC Network Configurations
const XDC_MAINNET = {
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

const XDC_TESTNET = {
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
function getChainConfig(network: string) {
    return network === "testnet" ? XDC_TESTNET : XDC_MAINNET;
}

// Helper function to ensure hash is properly typed
function ensureHash(hash: string): `0x${string}` {
    return hash as `0x${string}`;
}

// Helper function to ensure address is properly typed
function ensureAddress(address: string): `0x${string}` {
    return address as `0x${string}`;
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
            { env: 'CVC_BUYER_WALLET_PRIVATE_KEY', id: 'cvc_buyer', name: 'Civic Buyer', role: 'buyer', provider: 'civic' }
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

    // NEW: Method to restore last active wallet
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
async function createDynamicWalletClient(network: string = "testnet") {
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

async function createWalletClientForWallet(wallet: Wallet, network: string = "testnet") {
    const chain = getChainConfig(network);
    const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);
    
    return createWalletClient({
        account,
        transport: http(process.env.RPC_PROVIDER_URL || chain.rpcUrls.default.http[0]),
        chain
    });
}

// FIXED: Function to get GOAT tools for current wallet with proper reinitialization
async function getGoatToolsForNetwork(network: string) {
    const walletClient = await createDynamicWalletClient(network);
    return await getOnChainTools({
        wallet: viem(walletClient),
        plugins: [],
    });
}

// Create MCP Server
const server = new McpServer({
    name: "XDC-GOAT-MCP-Server-Final",
    version: "4.1.0"
});

// FIXED: Enhanced GOAT tools initialization with proper state tracking
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
            plugins: [],
        });
        
        goatToolsLastWalletId = currentWallet.id;
        console.log("GOAT SDK tools initialized successfully");
        
        // Get available tools from GOAT SDK
        const { listOfTools, toolHandler } = goatTools;
        const availableTools = listOfTools();
        console.log(`Found ${availableTools.length} GOAT tools ready for use`);
        
        return true;
    } catch (error) {
        console.error("Error initializing GOAT tools:", error);
        goatTools = null;
        goatToolsLastWalletId = null;
        return false;
    }
}

// FIXED: Helper function to ensure GOAT tools are available for current wallet
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

// FIXED: Enhanced wallet switching with immediate GOAT tools reinitialization
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

// FIXED: Enhanced current wallet check with GOAT tools status
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

// FIXED: Enhanced wallet info with automatic wallet restoration
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

// Standard Token Contract ABIs
const ERC20_ABI = [
    {
        "constant": true,
        "inputs": [{ "name": "_owner", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "name": "balance", "type": "uint256" }],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [{ "name": "_to", "type": "address" }, { "name": "_value", "type": "uint256" }],
        "name": "transfer",
        "outputs": [{ "name": "", "type": "bool" }],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "name",
        "outputs": [{ "name": "", "type": "string" }],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "symbol",
        "outputs": [{ "name": "", "type": "string" }],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [{ "name": "", "type": "uint8" }],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "totalSupply",
        "outputs": [{ "name": "", "type": "uint256" }],
        "type": "function"
    }
];

// ERC-721 NFT ABI
const ERC721_ABI = [
    {
        "constant": false,
        "inputs": [{ "name": "to", "type": "address" }, { "name": "tokenId", "type": "uint256" }],
        "name": "mint",
        "outputs": [],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [{ "name": "to", "type": "address" }, { "name": "uri", "type": "string" }],
        "name": "safeMint",
        "outputs": [],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [{ "name": "owner", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "name": "", "type": "uint256" }],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [{ "name": "tokenId", "type": "uint256" }],
        "name": "ownerOf",
        "outputs": [{ "name": "", "type": "address" }],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [{ "name": "tokenId", "type": "uint256" }],
        "name": "tokenURI",
        "outputs": [{ "name": "", "type": "string" }],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [{ "name": "from", "type": "address" }, { "name": "to", "type": "address" }, { "name": "tokenId", "type": "uint256" }],
        "name": "transferFrom",
        "outputs": [],
        "type": "function"
    }
];

// FIXED: Enhanced NFT minting with proper wallet validation
server.tool("mint_nft_with_confirmation", {
    contractAddress: z.string().describe("NFT contract address"),
    to: z.string().describe("Recipient address"),
    tokenId: z.string().optional().describe("Token ID (if required by contract)"),
    tokenURI: z.string().optional().describe("Token URI/metadata URL"),
    network: z.enum(["mainnet", "testnet"]).optional().describe("Network to use"),
    gasLimit: z.string().optional().describe("Gas limit for the transaction"),
    confirmed: z.boolean().optional().describe("Set to true to execute after reviewing details")
}, async ({ contractAddress, to, tokenId, tokenURI, network = "testnet", gasLimit, confirmed = false }) => {
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
        const goatReady = await ensureGoatToolsForCurrentWallet();
        if (!goatReady) {
            console.warn("GOAT tools not ready, but proceeding with native functionality");
        }
        
        // If not confirmed, show preview
        if (!confirmed) {
            const chain = getChainConfig(network);
            const publicClient = createPublicClient({
                chain,
                transport: http()
            });
            
            // Estimate gas
            let estimatedGas = "Unknown";
            try {
                const gasEstimate = await publicClient.estimateGas({
                    to: ensureAddress(contractAddress),
                    data: "0x" as `0x${string}` // Simplified for preview
                });
                estimatedGas = gasEstimate.toString();
            } catch (e) {
                estimatedGas = gasLimit || "50000";
            }
            
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        preview: true,
                        action: "Mint NFT",
                        details: {
                            wallet: `${currentWallet.name} (${currentWallet.publicAddress})`,
                            contractAddress,
                            recipient: to,
                            tokenId: tokenId || "Generated by contract",
                            tokenURI: tokenURI || "N/A",
                            network: chain.name,
                            estimatedGas,
                            gasLimit: gasLimit || "Default"
                        },
                        confirmation: "To proceed, call this function again with confirmed=true",
                        note: "This will mint the NFT immediately without further confirmation"
                    }, null, 2)
                }]
            };
        }
        
        // Execute the mint
        const walletClient = await createDynamicWalletClient(network);
        const chain = getChainConfig(network);
        const publicClient = createPublicClient({
            chain,
            transport: http()
        });
        
        let hash: string;
        
        if (tokenURI) {
            hash = await walletClient.writeContract({
                address: ensureAddress(contractAddress),
                abi: ERC721_ABI,
                functionName: 'safeMint',
                args: [ensureAddress(to), tokenURI],
                gas: gasLimit ? BigInt(gasLimit) : undefined
            });
        } else if (tokenId) {
            hash = await walletClient.writeContract({
                address: ensureAddress(contractAddress),
                abi: ERC721_ABI,
                functionName: 'mint',
                args: [ensureAddress(to), BigInt(tokenId)],
                gas: gasLimit ? BigInt(gasLimit) : undefined
            });
        } else {
            return {
                content: [{
                    type: "text",
                    text: "Error: Either tokenId or tokenURI must be provided for minting"
                }]
            };
        }
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash: ensureHash(hash) });
        
        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    success: true,
                    confirmed: true,
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

// Enhanced mint_nft tool with the same fixes
server.tool("mint_nft", {
    contractAddress: z.string().describe("NFT contract address"),
    to: z.string().describe("Recipient address"),
    tokenId: z.string().optional().describe("Token ID (if required by contract)"),
    tokenURI: z.string().optional().describe("Token URI/metadata URL"),
    network: z.enum(["mainnet", "testnet"]).optional().describe("Network to use"),
    gasLimit: z.string().optional().describe("Gas limit for the transaction")
}, async ({ contractAddress, to, tokenId, tokenURI, network = "testnet", gasLimit }) => {
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
        
        // Ensure GOAT tools are ready
        await ensureGoatToolsForCurrentWallet();
        
        const walletClient = await createDynamicWalletClient(network);
        const chain = getChainConfig(network);
        const publicClient = createPublicClient({
            chain,
            transport: http()
        });
        
        let hash: string;
        
        // Determine which mint function to use based on parameters
        if (tokenURI) {
            // Use safeMint with URI
            hash = await walletClient.writeContract({
                address: ensureAddress(contractAddress),
                abi: ERC721_ABI,
                functionName: 'safeMint',
                args: [ensureAddress(to), tokenURI],
                gas: gasLimit ? BigInt(gasLimit) : undefined
            });
        } else if (tokenId) {
            // Use mint with specific token ID
            hash = await walletClient.writeContract({
                address: ensureAddress(contractAddress),
                abi: ERC721_ABI,
                functionName: 'mint',
                args: [ensureAddress(to), BigInt(tokenId)],
                gas: gasLimit ? BigInt(gasLimit) : undefined
            });
        } else {
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
        const chain = getChainConfig(network);
        const publicClient = createPublicClient({ chain, transport: http() });
        
        let hash: string;
        
        if (tokenURI) {
            hash = await walletClient.writeContract({
                address: ensureAddress(contractAddress),
                abi: ERC721_ABI,
                functionName: 'safeMint',
                args: [ensureAddress(to), tokenURI]
            });
        } else if (tokenId) {
            hash = await walletClient.writeContract({
                address: ensureAddress(contractAddress),
                abi: ERC721_ABI,
                functionName: 'mint',
                args: [ensureAddress(to), BigInt(tokenId)]
            });
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

// Start the server
async function runServer() {
    console.log('🚀 Starting XDC GOAT MCP Server Final...');
    console.log('📝 Multi-Provider Role-based Wallet Management:');
    console.log('   - MetaMask: CAT_MM_SELLER/BUYER/FINANCIER_WALLET_PRIVATE_KEY');
    console.log('   - Crossmint: CM_SELLER/BUYER_WALLET_PRIVATE_KEY');
    console.log('   - Civic: CVC_SELLER/BUYER_WALLET_PRIVATE_KEY');
    console.log('   - Use switch_to_seller/switch_to_buyer with provider preference');
    console.log('   - Both instant and confirmation-based operations available');
    
    // Initialize GOAT tools with the current wallet
    await initializeGoatTools();
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("✅ XDC GOAT MCP Server Final running on stdio");
    
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
        console.log(`🔧 GOAT SDK Tools: Ready and initialized`);
    }
    
    console.log(`🎉 Server ready with comprehensive wallet management and both instant + confirmation workflows`);
}

runServer().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
