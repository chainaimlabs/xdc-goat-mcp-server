import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// GOAT SDK imports
import { getOnChainTools } from "@goat-sdk/adapter-model-context-protocol";
import { viem } from "@goat-sdk/wallet-viem";
import { erc20 } from "@goat-sdk/plugin-erc20";

// Import our modular components
import { 
    walletManager, 
    createWalletClientForWallet,
    type Wallet,
    ensureHash
} from "../core/wallet_manager.js";
import { 
    registerAllTools, 
    type ToolDependencies 
} from "../core/tools-xdc-goat.js";

import 'dotenv/config';

// Global GOAT tools state
let goatTools: any = null;
let goatToolsLastWalletId: string | null = null;

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
                erc20({
                    tokens: [
                        // Common stablecoins for XDC testnet/mainnet
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
            ],
        });
        
        goatToolsLastWalletId = currentWallet.id;
        console.log("GOAT SDK tools initialized successfully");
        
        // Register GOAT tools dynamically
        const { listOfTools, toolHandler } = goatTools;
        const availableTools = listOfTools();
        console.log(`Found ${availableTools.length} GOAT tools ready for use`);
        
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
    
    // Prepare tool dependencies
    const toolDependencies: ToolDependencies = {
        walletManager,
        ensureGoatToolsForCurrentWallet,
        initializeGoatTools
    };
    
    // Register all tools from the tools module
    registerAllTools(server, toolDependencies);
    
    // Start the server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("✅ XDC GOAT MCP Server with Full Token Support running on stdio");
    
    // Display current status
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