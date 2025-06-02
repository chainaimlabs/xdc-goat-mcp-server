
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

