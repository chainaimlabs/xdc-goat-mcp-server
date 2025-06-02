
# XDC GOAT MCP Server

A comprehensive Model Context Protocol (MCP) server that provides blockchain services for XDC Network and other EVM-compatible chains. This server enables AI agents to interact with blockchain data, manage wallets, transfer tokens, mint NFTs, and perform various DeFi operations through a unified interface.

## Features

- **Multi-Chain Support**: XDC Network (Chain ID: 51) and other EVM-compatible networks
- **Wallet Management**: Support for MetaMask, Crossmint, and Civic wallet providers
- **Token Operations**: Native tokens, ERC20, ERC721, and advanced ERC-6960 dual layer tokens
- **NFT Minting**: Support for various NFT standards including batch operations
- **DeFi Operations**: Token transfers, approvals, and allowance management
- **ENS Resolution**: Human-readable address resolution
- **Real-time Data**: Balance checking, transaction monitoring, and network status

## Installation

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn package manager
- Git

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/chainaimlabs/xdc-goat-mcp-server.git
   cd xdc-goat-mcp-server
   cd evm-mcp-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Run the server**
   ```bash
   npm start
   ```

### MCP Client Configuration

#### Claude Desktop

Add the following to your Claude Desktop configuration file (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "EVM-MCP-Server": {
            "command": "node",
            "args": [
                "C:\\yourpath\\xdc-goat-mcp-server\\evm-mcp-server\\build\\server\\xdcGoatMain1.js"
            ],
            "env": {
                "WALLET_PRIVATE_KEY": "Your Private Key",
                "RPC_PROVIDER_URL": "https://rpc.apothem.network"
            }
        }
    }
  }
```
