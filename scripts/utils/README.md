# Environment Loader Utility

This utility helps manage contract addresses and configuration from `.env` files with validation and helpful error messages.

## Features

- ✅ Load contract addresses from `.env` files
- ✅ Validate Ethereum address format
- ✅ Check for duplicate addresses
- ✅ Network-specific configuration
- ✅ CLI interface for easy management
- ✅ Comprehensive error handling
- ✅ TypeScript-friendly exports

## Quick Start

### 1. Basic Usage

```javascript
const { loadContractAddresses } = require('./scripts/utils/envLoader');

// Load all addresses (throws error if required addresses missing)
const addresses = loadContractAddresses({ required: true });

console.log('LOP Address:', addresses.lopAddress);
console.log('OptionsNFT Address:', addresses.optionsNFTAddress);
console.log('Chain ID:', addresses.chainId);
```

### 2. Optional Loading

```javascript
// Load addresses without throwing errors for missing ones
const addresses = loadContractAddresses({ required: false });

if (addresses.lopAddress) {
  console.log('LOP Address found:', addresses.lopAddress);
} else {
  console.log('LOP Address not configured');
}
```

### 3. Network-Specific Configuration

```javascript
const { getNetworkAddresses } = require('./scripts/utils/envLoader');

// Get addresses for specific network
const localhostAddresses = getNetworkAddresses('localhost');
const mainnetAddresses = getNetworkAddresses('mainnet');
const sepoliaAddresses = getNetworkAddresses('sepolia');
```

## CLI Commands

### Show All Addresses
```bash
node scripts/utils/envLoaderCLI.js show
```

### Validate Addresses
```bash
node scripts/utils/envLoaderCLI.js validate
```

### Show Network Configuration
```bash
node scripts/utils/envLoaderCLI.js network localhost
node scripts/utils/envLoaderCLI.js network mainnet
node scripts/utils/envLoaderCLI.js network sepolia
```

### Create Sample .env File
```bash
node scripts/utils/envLoaderCLI.js sample
node scripts/utils/envLoaderCLI.js sample .env.example
```

### Get Help
```bash
node scripts/utils/envLoaderCLI.js help
```

## API Reference

### `loadContractAddresses(options)`

Load and validate contract addresses from `.env` file.

**Parameters:**
- `options.required` (boolean): Whether to throw error if addresses are missing (default: true)
- `options.envPath` (string): Path to .env file (default: project root)

**Returns:**
```javascript
{
  // Core contracts
  lopAddress: string,
  optionsNFTAddress: string,
  
  // Token addresses
  mockETHAddress: string,
  mockUSDCAddress: string,
  wethAddress: string,
  dummyTokenAddress: string,
  
  // Network configuration
  chainId: number,
  rpcUrl: string,
  
  // Backend configuration
  backendUrl: string,
  port: number,
  
  // Database configuration
  databasePath: string,
  
  // Security configuration
  rateLimitWindow: number,
  rateLimitMax: number,
  
  // Logging configuration
  logLevel: string,
  enableConsoleLog: boolean,
  enableFileLog: boolean
}
```

### `validateAddresses(addresses)`

Validate Ethereum address format and check for duplicates.

**Parameters:**
- `addresses` (object): Contract addresses object

**Returns:**
```javascript
{
  isValid: boolean,
  errors: string[],
  warnings: string[]
}
```

### `printAddresses(addresses, showValidation)`

Print contract addresses in a formatted way.

**Parameters:**
- `addresses` (object): Contract addresses object
- `showValidation` (boolean): Whether to show validation results (default: true)

### `getNetworkAddresses(network)`

Get contract addresses for a specific network.

**Parameters:**
- `network` (string): Network name (localhost, mainnet, sepolia)

**Returns:** Contract addresses with network-specific overrides

### `createSampleEnv(outputPath)`

Create a sample .env file with placeholder values.

**Parameters:**
- `outputPath` (string): Path to save the sample .env file (default: .env.example)

## Required Environment Variables

Your `.env` file should include these variables:

```env
# Core Contracts
LOP_ADDRESS=0x...
OPTIONS_NFT_ADDRESS=0x...

# Token Addresses
MOCK_ETH_ADDRESS=0x...
MOCK_USDC_ADDRESS=0x...
WETH_ADDRESS=0x...
DUMMY_TOKEN_ADDRESS=0x...

# Network Configuration
CHAIN_ID=31337
RPC_URL=http://localhost:8545

# Backend Configuration
BACKEND_URL=http://localhost:3000
PORT=3000

# Database Configuration
DATABASE_PATH=./data/orders.db

# Security Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
CORS_ORIGIN=*

# Logging Configuration
LOG_LEVEL=info
ENABLE_CONSOLE_LOG=true
ENABLE_FILE_LOG=false
```

## Error Handling

The utility provides comprehensive error handling:

```javascript
try {
  const addresses = loadContractAddresses({ required: true });
  // Use addresses...
} catch (error) {
  if (error.message.includes('Missing required contract addresses')) {
    console.log('Please configure your .env file with the required addresses');
  } else if (error.message.includes('Environment file not found')) {
    console.log('Please create a .env file in your project root');
  }
}
```

## Integration Examples

### In Test Scripts
```javascript
const { loadContractAddresses } = require('../scripts/utils/envLoader');

async function testFunction() {
  const addresses = loadContractAddresses({ required: true });
  
  const lop = await ethers.getContractAt("LimitOrderProtocol", addresses.lopAddress);
  const optionsNFT = await ethers.getContractAt("OptionNFT", addresses.optionsNFTAddress);
  
  // Use contracts...
}
```

### In Deployment Scripts
```javascript
const { loadContractAddresses, printAddresses } = require('./scripts/utils/envLoader');

async function deploy() {
  const addresses = loadContractAddresses({ required: false });
  
  if (addresses.lopAddress) {
    console.log('Using existing LOP address:', addresses.lopAddress);
  } else {
    console.log('Deploying new LOP contract...');
    // Deploy logic...
  }
  
  printAddresses(addresses);
}
```

## Validation Features

The utility automatically validates:

- ✅ Ethereum address format (0x + 40 hex characters)
- ✅ Duplicate addresses detection
- ✅ Required address presence
- ✅ Network-specific configuration

## Network Support

Currently supports these networks:

- **localhost**: Chain ID 31337, RPC http://localhost:8545
- **mainnet**: Chain ID 1, RPC from MAINNET_RPC_URL env var
- **sepolia**: Chain ID 11155111, RPC from SEPOLIA_RPC_URL env var

## Contributing

To add support for new networks or features:

1. Update the `getNetworkAddresses` function
2. Add new environment variables to the sample
3. Update validation logic if needed
4. Add tests for new functionality

## Troubleshooting

### Common Issues

1. **"Environment file not found"**
   - Create a `.env` file in your project root
   - Use `node scripts/utils/envLoaderCLI.js sample` to create a template

2. **"Missing required contract addresses"**
   - Configure your `.env` file with the required addresses
   - Use `node scripts/utils/envLoaderCLI.js show` to see what's missing

3. **"Invalid Ethereum address format"**
   - Check that addresses are 42 characters long (0x + 40 hex)
   - Ensure addresses start with 0x
   - Verify no extra spaces or characters

4. **"Duplicate contract addresses detected"**
   - Review your `.env` file for duplicate values
   - Each contract should have a unique address 