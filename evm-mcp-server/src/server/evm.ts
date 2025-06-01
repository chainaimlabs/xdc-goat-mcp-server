import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { http, createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { getOnChainTools } from "@goat-sdk/adapter-model-context-protocol";
import { viem } from "@goat-sdk/wallet-viem";

import { xdcMainnet, xdcApothemTestnet } from './servutil.js' // path to your custom chains

import 'dotenv/config';

//import { registerEVMTools } from "./evmtools.js";
import { registerEVMResources } from "../core/resources.js";
import { registerEVMTools } from "../core/tools-evm.js";
import { registerEVMPrompts } from "../core/prompts.js";
import { clear } from "console";

// 1. Create the wallet client

console.log(' env  PK  ' , process.env.WALLET_PRIVATE_KEY);
console.log(' env  RPC  ' , process.env.RPC_PROVIDER_URL);

const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`);

const walletClient = createWalletClient({
    account: account,
    transport: http(process.env.RPC_PROVIDER_URL),
    /*chain:  baseSepolia, */
    chain: xdcApothemTestnet, 
});

// 2. Get the onchain tools for the wallet

const toolsPromise = getOnChainTools({
    wallet: viem(walletClient),
    plugins: [],
});


// 3. Create and configure the server


/*const server = new Server(
    {
        name: "goat-evm",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    },
    
);
*/
    const server = new McpServer({
      //name: "EVM-Server",
      //name: "goat-evm",
      name: "Goat-EVM-MCP-Server",
      version: "1.0.0"
    },
    {
        capabilities: {
            tools: {},
        },
    },
    
    );

  // Register all resources, tools, and prompts
    registerEVMResources(server);
    registerEVMTools(server);
    registerEVMPrompts(server);
 

/*
const goatTools = await getOnChainTools({
  wallet: walletClient,
  //plugins: [new UniswapPlugin(), new ERC20Plugin()]
  plugins: []
});
*/


/*
server.setRequestHandler(ListToolsRequestSchema, async () => {
    const { listOfTools } = await toolsPromise;
    return {
        tools: listOfTools(),
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { toolHandler } = await toolsPromise;
    try {
        return toolHandler(request.params.name, request.params.arguments);
    } catch (error) {
        throw new Error(`Tool ${request.params.name} failed: ${error}`);    }
});
*/

/*
goatTools.forEach(tool => {
  server.tool(tool.name, tool.schema, tool.handler);
});
*/


// 4. Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("GOAT EVM MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});