import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerEVMResources } from "../core/resources.js";
import { registerEVMTools } from "../core/tools-evm.js";
import { registerEVMPrompts } from "../core/prompts.js";
import { getSupportedNetworks } from "../core/chains.js";

import { xdcMainnet, xdcApothemTestnet } from './servutil.js' // path to your custom chains

import 'dotenv/config';


// Create and start the MCP server
async function startServer() {
  try {
    // Create a new MCP server instance
    const server = new McpServer({
      //name:"goat-evm",
      name: "Goat-EVM-MCP-Server",
      version: "1.0.0"
    });

    // Register all resources, tools, and prompts
    registerEVMResources(server);
    registerEVMTools(server);
    registerEVMPrompts(server);
    
    // Log server information
    console.error(`GOAT EVM MCP Server initialized`);
    console.error(`Supported networks: ${getSupportedNetworks().join(", ")}`);
    console.error("Server is ready to handle requests");
    
    return server;
  } catch (error) {
    console.error("Failed to initialize server:", error);
    process.exit(1);
  }
}

async function main() {
    try {
        const server = await startServer();
        // Add any additional CLI-specific logic here
    } catch (error) {
        console.error("Server failed:", error);
        process.exit(1);
    }
}

// Execute if run directly from CLI
//if (require.main === module) {
    main();
//}

// Export the server creation function
export default startServer; 