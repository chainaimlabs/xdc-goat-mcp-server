import { createWalletClient, http, type WalletClient, type Address, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import 'dotenv/config';

// Type definitions
export interface BrowserWallet {
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

export interface ChainConfig {
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

export interface Wallet {
    id: string;
    name: string;
    role: string;
    provider: string;
    privateKey: string;
    publicAddress: string;
    isActive: boolean;
    description: string;
}

// XDC Network Configurations
export const XDC_MAINNET: ChainConfig = {
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

export const XDC_TESTNET: ChainConfig = {
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
export function getChainConfig(network: "mainnet" | "testnet"): ChainConfig {
    return network === "testnet" ? XDC_TESTNET : XDC_MAINNET;
}

// Helper function to ensure hash is properly typed
export function ensureHash(hash: string): Hash {
    return hash as Hash;
}

export function ensureAddress(address: string): Address {
    if (!address.startsWith('0x')) {
        throw new Error(`Invalid address format: ${address}. Address must start with 0x`);
    }
    return address as Address;
}

export function ensurePrivateKey(privateKey: string): `0x${string}` {
    if (!privateKey.startsWith('0x')) {
        return `0x${privateKey}` as `0x${string}`;
    }
    return privateKey as `0x${string}`;
}

// Wallet Manager Class
export class WalletConfigManager {
    private static instance: WalletConfigManager;
    private wallets = new Map<string, Wallet>();
    private currentWallet: Wallet | null = null;
    private lastActiveWalletId: string | null = null;

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
        const configs = [
            // MetaMask wallets
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
        const priorityWallet = loadedWallets.find(w => w.id === 'catmm_seller');
        
        if (priorityWallet) {
            this.currentWallet = priorityWallet;
            this.lastActiveWalletId = priorityWallet.id;
            console.log(`🎯 Set current wallet to priority: ${priorityWallet.name}`);
        } else if (walletsLoaded > 0) {
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

// Helper functions for wallet client creation
export async function createDynamicWalletClient(
    walletManager: WalletConfigManager, 
    network: "mainnet" | "testnet" = "testnet"
): Promise<WalletClient> {
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

export async function createWalletClientForWallet(
    wallet: Wallet, 
    network: "mainnet" | "testnet" = "testnet"
): Promise<WalletClient> {
    const chain = getChainConfig(network);
    const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);
    
    return createWalletClient({
        account,
        transport: http(process.env.RPC_PROVIDER_URL || chain.rpcUrls.default.http[0]),
        chain
    });
}

// Export singleton instance
export const walletManager = WalletConfigManager.getInstance();